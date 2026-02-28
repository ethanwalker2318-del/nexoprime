import { createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { Admin, User } from "@prisma/client";

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface TgInitData {
  auth_date: number;
  hash:      string;
  user?:     TgUser;
  start_param?: string; // Deep linking параметр: "cl_<invite_code>"
}

export interface TgUser {
  id:         number;
  first_name: string;
  last_name?: string;
  username?:  string;
  language_code?: string;
}

// Расширяем Express Request
declare global {
  namespace Express {
    interface Request {
      tgUser:   User;
      tgAdmin?: Admin;
    }
  }
}

// ─── Валидация подписи initData ───────────────────────────────────────────────

function verifyTelegramInitData(rawInitData: string, botToken: string): TgInitData | null {
  const params = new URLSearchParams(rawInitData);
  const hash   = params.get("hash");
  if (!hash) return null;

  // Убираем hash из строки перед проверкой
  params.delete("hash");

  // Сортируем ключи
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // HMAC-SHA256: секретный ключ = HMAC-SHA256("WebAppData", botToken)
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (expectedHash !== hash) return null;

  // Проверяем свежесть (не старше 24 часа — Mini App может быть открыт долго)
  const authDate  = parseInt(params.get("auth_date") ?? "0", 10);
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > 86400) return null;

  const userRaw = params.get("user");
  const user    = userRaw ? (JSON.parse(userRaw) as TgUser) : undefined;

  return {
    auth_date:   authDate,
    hash,
    user,
    start_param: params.get("start_param") ?? undefined,
  };
}

// ─── Найти или создать пользователя ───────────────────────────────────────────

async function findOrCreateUser(initData: TgInitData): Promise<User> {
  const tgUser = initData.user;
  if (!tgUser) throw new Error("No user in initData");

  const tgId = BigInt(tgUser.id);

  // Пробуем найти уже существующего
  const existing = await prisma.user.findUnique({
    where: { tg_id: tgId },
  });
  if (existing) {
    // Обновляем last_seen и language_code при каждом запросе
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        last_seen:     new Date(),
        language_code: tgUser.language_code ?? existing.language_code,
        username:      tgUser.username     ?? existing.username,
        first_name:    tgUser.first_name   ?? existing.first_name,
      },
    }).catch(() => null);
    return existing;
  }

  // ── Определяем owner ──────────────────────────────────────────────────────
  let ownerId: string | null = null;

  const startParam = initData.start_param ?? "";

  if (startParam.startsWith("cl_")) {
    // start=cl_<invite_code> → привязываем к CLOSER
    const inviteCode = startParam.slice(3);
    const closer = await prisma.admin.findFirst({
      where: { invite_code: inviteCode, is_active: true },
    });
    if (closer) ownerId = closer.id;
  }

  // Если не нашли клоузера — привязываем к SUPER_ADMIN
  if (!ownerId) {
    const superAdmin = await prisma.admin.findFirst({
      where: { role: "SUPER_ADMIN", is_active: true },
    });
    ownerId = superAdmin?.id ?? null;
  }

  // ── Создаём пользователя + стартовые балансы (USDT, BTC, ETH) ─────────────
  const newUser = await prisma.user.create({
    data: {
      tg_id:         tgId,
      username:      tgUser.username      ?? null,
      first_name:    tgUser.first_name    ?? null,
      last_name:     tgUser.last_name     ?? null,
      language_code: tgUser.language_code  ?? null,
      owner_id:      ownerId,
      last_seen:     new Date(),
      balances: {
        create: [
          { symbol: "USDT", available: 0 },
          { symbol: "BTC",  available: 0 },
          { symbol: "ETH",  available: 0 },
        ],
      },
    },
  });

  return newUser;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export function tgAuthMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    res.status(500).json({ error: "Server misconfiguration: BOT_TOKEN missing" });
    return;
  }

  // initData передаётся в заголовке X-Telegram-Init-Data
  const rawInitData = _req.headers["x-telegram-init-data"] as string | undefined;

  // В режиме разработки — разрешаем dev-bypass через заголовок X-Dev-Tg-Id
  if (process.env.NODE_ENV === "development" && !rawInitData) {
    const devTgId = _req.headers["x-dev-tg-id"] as string | undefined;
    if (devTgId) {
      prisma.user.findUnique({ where: { tg_id: BigInt(devTgId) } }).then(user => {
        if (!user) { res.status(404).json({ error: "Dev user not found" }); return; }
        _req.tgUser = user;
        next();
      }).catch(next);
      return;
    }
  }

  if (!rawInitData) {
    console.log("[AUTH] No initData in request", _req.method, _req.path);
    res.status(401).json({ error: "Missing Telegram initData" });
    return;
  }

  const initData = verifyTelegramInitData(rawInitData, botToken);
  if (!initData) {
    console.log("[AUTH] Invalid/expired initData", _req.method, _req.path);
    res.status(401).json({ error: "Invalid or expired Telegram initData" });
    return;
  }

  findOrCreateUser(initData)
    .then(user => {
      // Блокировка: если is_blocked — отказ
      if (user.is_blocked) {
        res.status(403).json({ error: "Account blocked" });
        return;
      }
      _req.tgUser = user;
      next();
    })
    .catch(next);
}

// ─── Admin Guard (только SUPER_ADMIN или прикреплённый CLOSER) ────────────────

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (!adminId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  prisma.admin.findUnique({ where: { id: adminId } })
    .then(admin => {
      if (!admin || !admin.is_active) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      req.tgAdmin = admin;
      next();
    })
    .catch(next);
}
