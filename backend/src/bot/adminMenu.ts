// ─── SUPER_ADMIN Bot Menu ─────────────────────────────────────────────────────
// /closers — список клоузеров
// /all_leads — глобальный мониторинг
// Reassign, Block/Unblock, Delete Closer

import { InlineKeyboard } from "grammy";
import type { Context, SessionFlavor } from "grammy";
import { prisma } from "../lib/prisma";
import { randomBytes } from "crypto";
import type { SessionData } from "./relay";
import { getBotUsername } from "./relay";

type BotCtx = Context & SessionFlavor<SessionData>;

function dec(v: unknown): string { return Number(v ?? 0).toFixed(2); }

// ─── /closers ─────────────────────────────────────────────────────────────────

export async function handleClosers(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }

  const closers = await prisma.admin.findMany({
    where: { role: "CLOSER" },
    include: { _count: { select: { leads: true } } },
    orderBy: { created_at: "desc" },
  });

  if (closers.length === 0) {
    await ctx.reply("Клоузеров пока нет.");
    return;
  }

  for (const cl of closers) {
    const active = cl.is_active ? "🟢 Активен" : "🔴 Заблокирован";
    const kb = new InlineKeyboard()
      .text(cl.is_active ? "🔒 Заблокировать" : "🔓 Разблокировать", `cl_toggle:${cl.id}`)
      .text("🗑 Удалить", `cl_delete:${cl.id}`).row()
      .text(`👥 Лиды (${cl._count.leads})`, `cl_leads:${cl.id}`)
      .text("📊 Стат", `cl_stats:${cl.id}`).row()
      .text("🔄 Сменить Invite", `rotate_inv:${cl.id}`);

    await ctx.reply(
      [
        `🧑‍💼 <b>${cl.username ?? "—"}</b> [${cl.tg_id}]`,
        `${active} | Лидов: ${cl._count.leads}`,
        `🔗 Invite: <code>cl_${cl.invite_code}</code>`,
        `🔗 Ссылка: <code>https://t.me/${getBotUsername()}?start=cl_${cl.invite_code}</code>`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
}

// ─── Toggle Closer active/blocked ─────────────────────────────────────────────

export async function handleCloserToggle(ctx: BotCtx): Promise<void> {
  const closerId = ctx.callbackQuery?.data?.split(":")[1];
  if (!closerId) return;

  const cl = await prisma.admin.findUnique({ where: { id: closerId } });
  if (!cl) { await ctx.answerCallbackQuery({ text: "Не найден", show_alert: true }); return; }

  await prisma.admin.update({ where: { id: closerId }, data: { is_active: !cl.is_active } });

  // Если блокируем — все его лиды потеряют trading
  if (cl.is_active) {
    await prisma.user.updateMany({
      where: { owner_id: closerId },
      data: { trading_enabled: false },
    });
  }

  await ctx.answerCallbackQuery({ text: cl.is_active ? "Заблокирован" : "Разблокирован" });
  await ctx.editMessageText(
    (ctx.callbackQuery!.message!.text ?? "") + `\n\n→ ${cl.is_active ? "🔴 BLOCKED" : "🟢 UNBLOCKED"}`,
    { parse_mode: "HTML" }
  ).catch(() => null);
}

// ─── Delete Closer ────────────────────────────────────────────────────────────

export async function handleCloserDelete(ctx: BotCtx): Promise<void> {
  const closerId = ctx.callbackQuery?.data?.split(":")[1];
  if (!closerId) return;

  // Переприкрепляем лидов к SUPER_ADMIN
  const sa = await prisma.admin.findFirst({ where: { role: "SUPER_ADMIN", is_active: true } });
  await prisma.user.updateMany({
    where: { owner_id: closerId },
    data: { owner_id: sa?.id ?? null },
  });

  await prisma.admin.delete({ where: { id: closerId } });
  await ctx.answerCallbackQuery({ text: "Удалён. Лиды переданы SUPER_ADMIN." });
  await ctx.editMessageText(
    (ctx.callbackQuery!.message!.text ?? "") + "\n\n🗑 <b>УДАЛЁН</b>",
    { parse_mode: "HTML" }
  ).catch(() => null);
}

// ─── View Closer's leads ──────────────────────────────────────────────────────

export async function handleCloserLeads(ctx: BotCtx): Promise<void> {
  const closerId = ctx.callbackQuery?.data?.split(":")[1];
  if (!closerId) return;

  const leads = await prisma.user.findMany({
    where: { owner_id: closerId },
    include: { balances: true },
    take: 30,
  });

  if (leads.length === 0) {
    await ctx.answerCallbackQuery({ text: "Нет лидов" });
    return;
  }

  await ctx.answerCallbackQuery();

  for (const lead of leads) {
    const usdt = lead.balances.find(b => b.symbol === "USDT");
    const kb = new InlineKeyboard()
      .text("⚙️ Управление", `manage:${lead.id}`)
      .text("🔄 Перепривязать", `reassign:${lead.id}`);

    const name = lead.first_name ?? "Аноним";
    await ctx.reply(
      `👤 ${name}${lead.username ? ` (@${lead.username})` : ""} [${lead.tg_id}]\n💰 ${dec(usdt?.available)} USDT`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
}

// ─── /all_leads — глобальный мониторинг ───────────────────────────────────────

export async function handleAllLeads(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }

  const leads = await prisma.user.findMany({
    include: { balances: true, owner: { select: { username: true, role: true } } },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  if (leads.length === 0) { await ctx.reply("Лидов нет."); return; }

  const lines: string[] = ["📋 <b>Все лиды</b> (последние 50)\n"];
  for (const lead of leads) {
    const usdt = lead.balances.find(b => b.symbol === "USDT");
    const owner = lead.owner ? `→ ${lead.owner.username ?? "—"}` : "⚠️ нет менеджера";
    lines.push(
      `• ${lead.first_name ?? "—"}${lead.username ? ` @${lead.username}` : ""} | ${dec(usdt?.available)} USDT | ${owner}`
    );
  }

  // Telegram ограничивает сообщение 4096 символами — разбиваем
  const text = lines.join("\n");
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [text];
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }
}

// ─── Reassign Lead → set session ──────────────────────────────────────────────

export async function handleReassign(ctx: BotCtx): Promise<void> {
  const userId = ctx.callbackQuery?.data?.split(":")[1];
  if (!userId) return;

  ctx.session.pendingAction = { type: "reassign", userId };
  await ctx.answerCallbackQuery();
  await ctx.reply("🔄 Введите TG ID нового клоузера (или invite_code без cl_):");
}

export async function processReassign(ctx: BotCtx, text: string): Promise<boolean> {
  const action = ctx.session.pendingAction;
  if (!action || action.type !== "reassign") return false;
  ctx.session.pendingAction = undefined;

  // Ищем клоузера по tg_id или invite_code
  const input = text.trim();
  let closer = await prisma.admin.findFirst({
    where: { tg_id: BigInt(isNaN(Number(input)) ? 0 : Number(input)) },
  });
  if (!closer) {
    closer = await prisma.admin.findFirst({ where: { invite_code: input } });
  }
  if (!closer) {
    await ctx.reply("❌ Клоузер не найден.");
    return true;
  }

  await prisma.user.update({
    where: { id: action.userId },
    data: { owner_id: closer.id },
  });

  const lead = await prisma.user.findUnique({ where: { id: action.userId } });
  await ctx.reply(
    `✅ Лид ${lead?.first_name ?? "—"} перепривязан к <b>${closer.username ?? String(closer.tg_id)}</b>`,
    { parse_mode: "HTML" }
  );
  return true;
}

// ─── /add_closer  — создать нового клоузера ──────────────────────────────────

export async function handleAddCloser(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }

  ctx.session.pendingAction = { type: "add_closer", userId: "" };
  await ctx.reply("🧑‍💼 Введите TG ID нового клоузера:");
}

export async function processAddCloser(ctx: BotCtx, text: string): Promise<boolean> {
  const action = ctx.session.pendingAction;
  if (!action || action.type !== "add_closer") return false;
  ctx.session.pendingAction = undefined;

  const tgIdNum = Number(text.trim());
  if (isNaN(tgIdNum)) {
    await ctx.reply("❌ Неверный TG ID.");
    return true;
  }

  const exists = await prisma.admin.findFirst({ where: { tg_id: BigInt(tgIdNum) } });
  if (exists) {
    await ctx.reply("❌ Этот TG ID уже является админом/клоузером.");
    return true;
  }

  const inviteCode = randomBytes(6).toString("hex");
  const closer = await prisma.admin.create({
    data: {
      tg_id: BigInt(tgIdNum),
      role: "CLOSER",
      invite_code: inviteCode,
    },
  });

  await ctx.reply(
    [
      `✅ <b>Клоузер создан!</b>`,
      `TG ID: <code>${tgIdNum}</code>`,
      `Invite code: <code>${inviteCode}</code>`,
      `Deep Link: <code>https://t.me/${getBotUsername()}?start=cl_${inviteCode}</code>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
  return true;
}

// ─── /block_user — заблокировать лида по TG ID ───────────────────────────────

export async function handleBlockUserCmd(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }

  const param = (ctx.match as string) ?? "";
  if (!param) {
    await ctx.reply("Использование: /block_user <TG_ID>");
    return;
  }

  const user = await prisma.user.findUnique({ where: { tg_id: BigInt(param.trim()) } });
  if (!user) { await ctx.reply("❌ Пользователь не найден."); return; }

  await prisma.user.update({ where: { id: user.id }, data: { is_blocked: true } });

  // Socket: форсированный выход
  const { emitToUser } = await import("../socket");
  emitToUser(user.id, "FORCE_LOGOUT", { reason: "Account blocked by admin" });

  await ctx.reply(`🔒 Пользователь ${user.first_name ?? String(user.tg_id)} заблокирован.`);
}

// ─── /broadcast — глобальное сообщение всем лидам ─────────────────────────────

export async function handleBroadcast(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }
  ctx.session.pendingAction = { type: "broadcast", userId: "" };
  await ctx.reply("📢 Введите текст для рассылки ВСЕМ пользователям:");
}

export async function processBroadcast(ctx: BotCtx, text: string): Promise<boolean> {
  const action = ctx.session.pendingAction;
  if (!action || action.type !== "broadcast") return false;
  ctx.session.pendingAction = undefined;

  const { broadcastMessage } = await import("../socket");
  broadcastMessage("📢 Уведомление", text);

  // Также отправляем через бот всем лидам
  const users = await prisma.user.findMany({ where: { is_blocked: false } });
  let sent = 0;
  const { getBotInstance } = await import("./relay");
  const bot = getBotInstance();
  for (const u of users) {
    try {
      await bot.api.sendMessage(String(u.tg_id), `📢 <b>Уведомление:</b>\n\n${text}`, { parse_mode: "HTML" });
      sent++;
    } catch { /* skip */ }
  }

  await ctx.reply(`✅ Рассылка отправлена: ${sent}/${users.length} пользователей`);
  return true;
}

// ─── /transfer — перевод лида по TG ID ────────────────────────────────────────

export async function handleTransfer(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }

  const param = (ctx.match as string) ?? "";
  const parts = param.trim().split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Использование: /transfer <LeadTgID> <CloserTgID>");
    return;
  }

  const leadTgId   = BigInt(parts[0]!);
  const closerTgId = BigInt(parts[1]!);

  const lead = await prisma.user.findUnique({ where: { tg_id: leadTgId } });
  if (!lead) { await ctx.reply("❌ Лид не найден."); return; }

  const closer = await prisma.admin.findFirst({ where: { tg_id: closerTgId } });
  if (!closer) { await ctx.reply("❌ Клоузер не найден."); return; }

  await prisma.user.update({ where: { id: lead.id }, data: { owner_id: closer.id } });
  await ctx.reply(`✅ Лид ${lead.first_name ?? String(leadTgId)} → ${closer.username ?? String(closerTgId)}`);
}

// ─── Смена invite_code клоузера ───────────────────────────────────────────────

export async function handleRotateInvite(ctx: BotCtx): Promise<void> {
  const closerId = ctx.callbackQuery?.data?.split(":")[1];
  if (!closerId) return;

  const newCode = randomBytes(6).toString("hex");
  await prisma.admin.update({
    where: { id: closerId },
    data: { invite_code: newCode },
  });

  await ctx.answerCallbackQuery({ text: `Новый код: ${newCode}` });
  await ctx.reply(
    [
      `🔗 Новый Invite: <code>cl_${newCode}</code>`,
      `🔗 Ссылка: <code>https://t.me/${getBotUsername()}?start=cl_${newCode}</code>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}

// ─── Статистика клоузера (депозиты) ───────────────────────────────────────────

export async function handleCloserStats(ctx: BotCtx): Promise<void> {
  const closerId = ctx.callbackQuery?.data?.split(":")[1];
  if (!closerId) return;

  const leads = await prisma.user.findMany({
    where: { owner_id: closerId },
    include: { transactions: { where: { type: "DEPOSIT", status: "SUCCESS" } } },
  });

  let totalDeposits = 0;
  leads.forEach(l => l.transactions.forEach(t => totalDeposits += Number(t.amount)));

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `📊 <b>Статистика клоузера</b>\nЛидов: ${leads.length}\nОбщая сумма депозитов: <code>${totalDeposits.toFixed(2)}</code> USDT`,
    { parse_mode: "HTML" }
  );
}

// ─── /panel — SuperAdmin Dashboard ────────────────────────────────────────────

export async function handlePanel(ctx: BotCtx): Promise<void> {
  const tgId = BigInt(ctx.from!.id);
  const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    await ctx.reply("❌ Команда доступна только SUPER_ADMIN.");
    return;
  }

  // Собираем общую статистику
  const [totalUsers, totalClosers, blockedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.admin.count({ where: { role: "CLOSER" } }),
    prisma.user.count({ where: { is_blocked: true } }),
  ]);

  // Онлайн за последние 5 минут
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsers = await prisma.user.count({
    where: { last_seen: { gte: fiveMinAgo } },
  });

  // Финансовая сводка
  const deposits = await prisma.transaction.aggregate({
    where: { type: "DEPOSIT", status: "SUCCESS" },
    _sum: { amount: true },
    _count: true,
  });

  const withdrawals = await prisma.transaction.aggregate({
    where: { type: "WITHDRAWAL", status: "SUCCESS" },
    _sum: { amount: true },
    _count: true,
  });

  const pendingWd = await prisma.transaction.count({
    where: { type: "WITHDRAWAL", status: "PENDING" },
  });

  const totalTrades = await prisma.binaryTrade.count();

  // Пер-клоузер статистика
  const closers = await prisma.admin.findMany({
    where: { role: "CLOSER" },
    include: {
      _count: { select: { leads: true } },
      leads: {
        select: {
          last_seen: true,
          transactions: {
            where: { type: "DEPOSIT", status: "SUCCESS" },
            select: { amount: true },
          },
        },
      },
    },
  });

  const closerLines: string[] = [];
  for (const cl of closers) {
    const depSum = cl.leads.reduce(
      (sum, lead) => sum + lead.transactions.reduce((s, tx) => s + Number(tx.amount), 0),
      0
    );
    const activeLeads = cl.leads.filter(l => l.last_seen && l.last_seen >= fiveMinAgo).length;
    const status = cl.is_active ? "🟢" : "🔴";
    closerLines.push(
      `${status} <b>${cl.username ?? String(cl.tg_id)}</b> — Лидов: ${cl._count.leads} (онлайн: ${activeLeads}) | Деп: <code>${depSum.toFixed(2)}</code>`
    );
  }

  const text = [
    `📊 <b>NEXO — SUPER ADMIN PANEL</b>`,
    ``,
    `👥 Всего лидов: <b>${totalUsers}</b>`,
    `🟢 Онлайн (5 мин): <b>${onlineUsers}</b>`,
    `🔴 Заблокировано: <b>${blockedUsers}</b>`,
    `🧑‍💼 Клоузеров: <b>${totalClosers}</b>`,
    ``,
    `💰 <b>Финансы</b>`,
    `📥 Депозиты: <code>${Number(deposits._sum.amount ?? 0).toFixed(2)}</code> (${deposits._count} шт)`,
    `📤 Выводы (одобрено): <code>${Number(withdrawals._sum.amount ?? 0).toFixed(2)}</code> (${withdrawals._count} шт)`,
    `⏳ Заявок на вывод: <b>${pendingWd}</b>`,
    `📈 Всего сделок: <b>${totalTrades}</b>`,
    ``,
    `🧑‍💼 <b>Клоузеры:</b>`,
    ...closerLines,
    ``,
    `⏰ ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
  ].join("\n");

  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [text];
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }
}
