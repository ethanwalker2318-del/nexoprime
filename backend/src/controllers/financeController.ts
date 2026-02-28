import type { Request, Response } from "express";
import { createDeposit, confirmDeposit, createWithdrawal, cancelWithdrawal } from "../services/financeService";
import { logEvent } from "../services/eventLogger";

// ─── POST /finance/deposit — запрос на депозит ────────────────────────────────

export async function requestDeposit(req: Request, res: Response): Promise<void> {
  try {
    const { asset, amount } = req.body;
    if (!asset || !amount) {
      res.status(400).json({ error: "asset and amount required" });
      return;
    }

    const result = await createDeposit({
      userId: req.tgUser.id,
      asset,
      amount: Number(amount),
    });

    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    await logEvent(req.tgUser.id, "DEPOSIT_PAGE", { asset, amount });
    res.json(result);
  } catch (err) {
    console.error("[requestDeposit]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /finance/deposit/confirm — подтверждение депозита (admin/closer) ────

export async function confirmDepositCtrl(req: Request, res: Response): Promise<void> {
  try {
    const { txId } = req.body;
    if (!txId) {
      res.status(400).json({ error: "txId required" });
      return;
    }

    const result = await confirmDeposit(txId, req.tgAdmin!.id);
    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    res.json(result);
  } catch (err) {
    console.error("[confirmDeposit]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /finance/withdraw — запрос на вывод ─────────────────────────────────

export async function requestWithdrawal(req: Request, res: Response): Promise<void> {
  try {
    const { asset, amount, address, fee } = req.body;
    if (!asset || !amount || !address) {
      res.status(400).json({ error: "asset, amount and address required" });
      return;
    }

    const result = await createWithdrawal({
      userId: req.tgUser.id,
      asset,
      amount: Number(amount),
      address,
      fee: Number(fee ?? 0),
    });

    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    await logEvent(req.tgUser.id, "WITHDRAW_PAGE", { asset, amount, address });
    res.json(result);
  } catch (err) {
    console.error("[requestWithdrawal]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /finance/withdraw/cancel — отмена вывода пользователем ──────────────

export async function cancelWithdrawalCtrl(req: Request, res: Response): Promise<void> {
  try {
    const { txId } = req.body;
    if (!txId) {
      res.status(400).json({ error: "txId required" });
      return;
    }

    const result = await cancelWithdrawal(txId, req.tgUser.id);
    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    res.json(result);
  } catch (err) {
    console.error("[cancelWithdrawal]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
