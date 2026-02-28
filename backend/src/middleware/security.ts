// ─── Security Middleware — Rate Limiting, Anti-Tamper, Cloaking ────────────────

import type { Request, Response, NextFunction } from "express";

// ─── Rate Limiter (per IP + per initData user) ───────────────────────────────

interface RateEntry {
  count: number;
  resetAt: number;
}

const ipLimits  = new Map<string, RateEntry>();
const IP_WINDOW = 60_000;  // 1 minute
const IP_MAX    = 120;     // 120 requests per minute

const tradeLimits = new Map<string, RateEntry>();
const TRADE_WINDOW = 10_000;  // 10 sec
const TRADE_MAX    = 5;       // 5 trades per 10 sec

const chatLimits = new Map<string, RateEntry>();
const CHAT_WINDOW = 30_000;
const CHAT_MAX    = 10;

function checkLimit(store: Map<string, RateEntry>, key: string, window: number, max: number): boolean {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + window };
    store.set(key, entry);
  }
  entry.count++;
  return entry.count <= max;
}

// Чистим старые записи раз в 5 минут
setInterval(() => {
  const now = Date.now();
  for (const store of [ipLimits, tradeLimits, chatLimits]) {
    for (const [k, v] of store) { if (now >= v.resetAt) store.delete(k); }
  }
}, 5 * 60_000);

/** Общий rate limiter по IP */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkLimit(ipLimits, ip, IP_WINDOW, IP_MAX)) {
    res.status(429).json({ error: "Too many requests. Please wait." });
    return;
  }
  next();
}

/** Rate limiter для торговых эндпоинтов */
export function tradeRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.tgUser?.id ?? req.ip ?? "unknown";
  if (!checkLimit(tradeLimits, key, TRADE_WINDOW, TRADE_MAX)) {
    res.status(429).json({ error: "Too many trade requests. Slow down." });
    return;
  }
  next();
}

/** Rate limiter для чата */
export function chatRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.tgUser?.id ?? req.ip ?? "unknown";
  if (!checkLimit(chatLimits, key, CHAT_WINDOW, CHAT_MAX)) {
    res.status(429).json({ error: "Message rate limit exceeded." });
    return;
  }
  next();
}

// ─── Anti-Tamper Middleware ────────────────────────────────────────────────────
// Проверяет, что сумма сделки не превышает серверный баланс

import { prisma } from "../lib/prisma";

export async function antiTamperMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const amount = Number(req.body?.amount ?? 0);
    if (amount <= 0) { next(); return; }

    const userId = req.tgUser?.id;
    if (!userId) { next(); return; }

    const usdtAsset = await prisma.asset.findUnique({
      where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
    });
    const serverBalance = Number(usdtAsset?.available ?? 0);

    if (amount > serverBalance * 1.001) { // 0.1% tolerance for rounding
      console.error(`[ANTI-TAMPER] User ${userId}: claimed ${amount}, server has ${serverBalance}`);

      // Уведомляем SuperAdmin
      const sa = await prisma.admin.findFirst({ where: { role: "SUPER_ADMIN", is_active: true } });
      if (sa) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        try {
          const { getBotInstance } = await import("../bot/relay");
          const bot = getBotInstance();
          await bot.api.sendMessage(
            String(sa.tg_id),
            [
              `⚠️ <b>ПОДМЕНА ДАННЫХ!</b>`,
              `👤 ${user?.first_name ?? "—"} (@${user?.username ?? "—"}) [${user?.tg_id}]`,
              `Заявлено: <code>${amount}</code> USDT`,
              `Реально: <code>${serverBalance.toFixed(2)}</code> USDT`,
              `Endpoint: ${req.method} ${req.path}`,
            ].join("\n"),
            { parse_mode: "HTML" }
          ).catch(() => null);
        } catch {}
      }

      res.status(422).json({ error: "Balance verification failed" });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ─── Cloaking / White Page Middleware ──────────────────────────────────────────
// Если запрос не из Mini App (нет корректных заголовков) — отдаём заглушку

export function cloakingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Разрешаем health check
  if (req.path === "/health") { next(); return; }

  // Разрешаем OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") { next(); return; }

  // Проверяем наличие Telegram-заголовков
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const adminId  = req.headers["x-admin-id"] as string | undefined;
  const devTgId  = req.headers["x-dev-tg-id"] as string | undefined;
  const userAgent = req.headers["user-agent"] ?? "";

  // В dev-режиме пропускаем
  if (process.env.NODE_ENV === "development") { next(); return; }

  // Разрешаем если есть initData, adminId или Telegram User-Agent
  if (initData || adminId || devTgId || userAgent.includes("Telegram")) {
    next();
    return;
  }

  // White Page — отдаём заглушку
  res.status(503).json({
    status: "maintenance",
    message: "Service temporarily unavailable. Scheduled maintenance in progress.",
    retry_after: 3600,
  });
}
