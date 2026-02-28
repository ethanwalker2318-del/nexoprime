import type { Request, Response } from "express";
import { placeBinaryTrade, settleBinaryTrade, getActiveTrades, getTradeHistory } from "../services/tradeService";
import { logEvent } from "../services/eventLogger";

// ─── POST /trade/place — размещение бинарки ──────────────────────────────────

export async function placeTrade(req: Request, res: Response): Promise<void> {
  try {
    const user = req.tgUser;
    if (user.is_blocked) {
      res.status(403).json({ error: "Account blocked" });
      return;
    }
    if (!user.trading_enabled) {
      res.status(403).json({ error: "Trading is disabled for your account" });
      return;
    }

    const { symbol, direction, amount, entryPrice, expiryMs } = req.body;
    if (!symbol || !direction || !amount || !entryPrice || !expiryMs) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await placeBinaryTrade({
      userId: user.id,
      symbol,
      direction,
      amount: Number(amount),
      entryPrice: Number(entryPrice),
      expiryMs: Number(expiryMs),
    });

    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    // Логируем событие
    await logEvent(user.id, "TRADE_OPEN", { symbol, direction, amount });

    res.json(result);
  } catch (err) {
    console.error("[placeTrade]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /trade/calculate — расчёт результата ───────────────────────────────
// Вызывается при экспирации (или по таймеру)

export async function calculateTrade(req: Request, res: Response): Promise<void> {
  try {
    const { tradeId, marketPrice } = req.body;
    if (!tradeId || marketPrice == null) {
      res.status(400).json({ error: "tradeId and marketPrice required" });
      return;
    }

    const result = await settleBinaryTrade(tradeId, Number(marketPrice));
    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    // Логируем
    await logEvent(req.tgUser.id, "TRADE_CLOSE", {
      tradeId, status: result.status, pnl: result.pnl,
    });

    res.json(result);
  } catch (err) {
    console.error("[calculateTrade]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── GET /trade/active ────────────────────────────────────────────────────────

export async function activeTrades(req: Request, res: Response): Promise<void> {
  try {
    const trades = await getActiveTrades(req.tgUser.id);
    res.json(trades.map(t => ({
      ...t,
      amount:      Number(t.amount),
      entry_price: Number(t.entry_price),
      exit_price:  t.exit_price ? Number(t.exit_price) : null,
      pnl:         Number(t.pnl),
    })));
  } catch (err) {
    console.error("[activeTrades]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── GET /trade/history ───────────────────────────────────────────────────────

export async function tradeHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = Number(req.query.limit ?? 50);
    const trades = await getTradeHistory(req.tgUser.id, limit);
    res.json(trades.map(t => ({
      ...t,
      amount:      Number(t.amount),
      entry_price: Number(t.entry_price),
      exit_price:  t.exit_price ? Number(t.exit_price) : null,
      pnl:         Number(t.pnl),
    })));
  } catch (err) {
    console.error("[tradeHistory]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
