import { prisma } from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { TransactionType, TransactionStatus } from "@prisma/client";

// ─── Получить все балансы пользователя ───────────────────────────────────────

export async function getUserBalances(userId: string) {
  return prisma.asset.findMany({
    where: { user_id: userId },
    orderBy: { symbol: "asc" },
  });
}

// ─── Получить баланс по символу ──────────────────────────────────────────────

export async function getAsset(userId: string, symbol: string) {
  return prisma.asset.findUnique({
    where: { user_id_symbol: { user_id: userId, symbol } },
  });
}

// ─── Создать или обновить баланс (upsert) ─────────────────────────────────────
//
// Вызывать может только SUPER_ADMIN или прикреплённый CLOSER (проверяется в контроллере)
// delta: положительное — зачислить, отрицательное — списать
//
export async function adjustBalance(
  userId: string,
  symbol: string,
  delta: number,
  options?: { lock?: boolean } // true → в locked, false → в available
): Promise<{ ok: boolean; error?: string }> {
  return prisma.$transaction(async tx => {
    const asset = await tx.asset.findUnique({
      where: { user_id_symbol: { user_id: userId, symbol } },
    });

    const available = asset ? Number(asset.available) : 0;
    const locked    = asset ? Number(asset.locked)    : 0;

    const lockMode = options?.lock ?? false;

    if (!lockMode && delta < 0 && available + delta < 0) {
      return { ok: false, error: "Insufficient available balance" };
    }
    if (lockMode && delta < 0 && locked + delta < 0) {
      return { ok: false, error: "Insufficient locked balance" };
    }

    await tx.asset.upsert({
      where:  { user_id_symbol: { user_id: userId, symbol } },
      create: {
        user_id:   userId,
        symbol,
        available: lockMode ? 0             : new Decimal(delta),
        locked:    lockMode ? new Decimal(delta) : 0,
      },
      update: lockMode
        ? { locked:    { increment: delta } }
        : { available: { increment: delta } },
    });

    return { ok: true };
  });
}

// ─── Создать транзакцию (депозит / вывод) ─────────────────────────────────────

export async function createTransaction(data: {
  userId:   string;
  type:     TransactionType;
  asset:    string;
  amount:   number;
  address?: string;
  fee?:     number;
}) {
  return prisma.transaction.create({
    data: {
      user_id: data.userId,
      type:    data.type,
      asset:   data.asset,
      amount:  new Decimal(data.amount),
      fee:     data.fee ? new Decimal(data.fee) : new Decimal(0),
      address: data.address ?? null,
      status:  "PENDING",
    },
  });
}

// ─── Обновить статус транзакции ────────────────────────────────────────────────

export async function updateTransactionStatus(
  txId:         string,
  status:       TransactionStatus,
  processedBy?: string,
  errorMsg?:    string,
  txHash?:      string
) {
  // При успешном депозите — зачисляем деньги
  return prisma.$transaction(async tx => {
    const transaction = await tx.transaction.findUnique({ where: { id: txId } });
    if (!transaction) throw new Error("Transaction not found");

    if (status === "SUCCESS" && transaction.type === "DEPOSIT") {
      await tx.asset.upsert({
        where:  { user_id_symbol: { user_id: transaction.user_id, symbol: transaction.asset } },
        create: {
          user_id:   transaction.user_id,
          symbol:    transaction.asset,
          available: transaction.amount,
          locked:    0,
        },
        update: { available: { increment: transaction.amount } },
      });
    }

    return tx.transaction.update({
      where: { id: txId },
      data: {
        status,
        processed_by:  processedBy ?? null,
        error_message: errorMsg    ?? null,
        tx_hash:       txHash      ?? null,
        updated_at: new Date(),
      },
    });
  });
}

// ─── История транзакций пользователя ──────────────────────────────────────────

export async function getUserTransactions(userId: string, limit = 50) {
  return prisma.transaction.findMany({
    where:   { user_id: userId },
    orderBy: { created_at: "desc" },
    take:    limit,
  });
}
