import { Bot, InlineKeyboard, session } from "grammy";
import type { Context, SessionFlavor } from "grammy";
import { prisma } from "../lib/prisma";

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface SessionData {
  replyToUserId?: string;
  pendingAction?: {
    type: string;   // "balance_add" | "balance_sub" | "reassign" | "add_closer"
    userId?: string;
  };
}

export type BotCtx = Context & SessionFlavor<SessionData>;

// ─── Singleton экземпляр бота ─────────────────────────────────────────────────

let botInstance: Bot<BotCtx> | null = null;

export function getBotInstance(): Bot<BotCtx> {
  if (!botInstance) {
    const token = process.env.BOT_TOKEN;
    if (!token) throw new Error("BOT_TOKEN is not set");
    botInstance = new Bot<BotCtx>(token);
    setupBot(botInstance);
  }
  return botInstance;
}

/** Алиас для внешних модулей (closerMenu, adminMenu, financeService) */
export const getBot = getBotInstance;

// ─── Кеш username бота (определяется один раз при старте) ─────────────────────

let _botUsername = "";

export async function resolveBotUsername(): Promise<string> {
  if (_botUsername) return _botUsername;
  const bot = getBotInstance();
  const me = await bot.api.getMe();
  _botUsername = me.username;
  return _botUsername;
}

export function getBotUsername(): string {
  return _botUsername || "nexo_prime_bot";
}

// ─── Утилиты ──────────────────────────────────────────────────────────────────

function fmtUser(u: { first_name?: string | null; username?: string | null; tg_id: bigint }) {
  const name = u.first_name ?? "Аноним";
  const tag  = u.username ? ` (@${u.username})` : "";
  return `${name}${tag} [${u.tg_id}]`;
}

// ─── Настройка бота ───────────────────────────────────────────────────────────

function setupBot(bot: Bot<BotCtx>): void {

  // In-memory сессии для хранения состояния ответа CLOSER'а
  bot.use(session({ initial: (): SessionData => ({}) }));

  // ─── Импорт CLOSER и ADMIN меню (ленивый для избежания циклов) ──────────
  let _closerMenu: typeof import("./closerMenu") | null = null;
  let _adminMenu:  typeof import("./adminMenu")  | null = null;

  async function getCloserMenu() {
    if (!_closerMenu) _closerMenu = await import("./closerMenu");
    return _closerMenu;
  }
  async function getAdminMenu() {
    if (!_adminMenu) _adminMenu = await import("./adminMenu");
    return _adminMenu;
  }

  // ─── CLOSER команды ─────────────────────────────────────────────────────────
  bot.command("my_leads", async ctx => { const m = await getCloserMenu(); await m.handleMyLeads(ctx); });
  bot.command("mylink", async ctx => { const m = await getCloserMenu(); await m.handleMyLink(ctx); });

  // ─── ADMIN (SUPER_ADMIN) команды ────────────────────────────────────────────
  bot.command("closers",    async ctx => { const m = await getAdminMenu(); await m.handleClosers(ctx); });
  bot.command("all_leads",  async ctx => { const m = await getAdminMenu(); await m.handleAllLeads(ctx); });
  bot.command("add_closer", async ctx => { const m = await getAdminMenu(); await m.handleAddCloser(ctx); });
  bot.command("block_user", async ctx => { const m = await getAdminMenu(); await m.handleBlockUserCmd(ctx); });
  bot.command("broadcast",  async ctx => { const m = await getAdminMenu(); await m.handleBroadcast(ctx); });
  bot.command("transfer",   async ctx => { const m = await getAdminMenu(); await m.handleTransfer(ctx); });
  bot.command("panel",      async ctx => { const m = await getAdminMenu(); await m.handlePanel(ctx); });

  // ─── Callback queries: CLOSER panel ─────────────────────────────────────────
  bot.callbackQuery(/^manage:(.+)$/,       async ctx => { const m = await getCloserMenu(); await m.handleManageLead(ctx); });
  bot.callbackQuery(/^bal_add:(.+)$/,      async ctx => { const m = await getCloserMenu(); await m.handleBalanceAdd(ctx); });
  bot.callbackQuery(/^bal_sub:(.+)$/,      async ctx => { const m = await getCloserMenu(); await m.handleBalanceSub(ctx); });
  bot.callbackQuery(/^toggle_trade:(.+)$/, async ctx => { const m = await getCloserMenu(); await m.handleToggleTrading(ctx); });
  bot.callbackQuery(/^set_force:(.+)$/,    async ctx => { const m = await getCloserMenu(); await m.handleSetForce(ctx); });
  bot.callbackQuery(/^force_set:(.+):(.+)$/,    async ctx => { const m = await getCloserMenu(); await m.handleForceSet(ctx); });
  bot.callbackQuery(/^force_always:(.+)$/,       async ctx => { const m = await getCloserMenu(); await m.handleForceAlways(ctx); });
  bot.callbackQuery(/^kyc_ctl:(.+)$/,      async ctx => { const m = await getCloserMenu(); await m.handleKycControl(ctx); });
  bot.callbackQuery(/^kyc_set:(.+):(.+)$/, async ctx => { const m = await getCloserMenu(); await m.handleKycSet(ctx); });
  bot.callbackQuery(/^wd_list:(.+)$/,      async ctx => { const m = await getCloserMenu(); await m.handleWithdrawalList(ctx); });
  bot.callbackQuery(/^wd_approve:(.+)$/,   async ctx => { const m = await getCloserMenu(); await m.handleWdApprove(ctx); });
  bot.callbackQuery(/^wd_reject:(.+)$/,    async ctx => { const m = await getCloserMenu(); await m.handleWdReject(ctx); });
  bot.callbackQuery(/^wd_reject_tax:(.+)$/,async ctx => { const m = await getCloserMenu(); await m.handleWdRejectTax(ctx); });
  bot.callbackQuery(/^wd_reject_kyc:(.+)$/,async ctx => { const m = await getCloserMenu(); await m.handleWdRejectKyc(ctx); });
  bot.callbackQuery(/^block_toggle:(.+)$/, async ctx => { const m = await getCloserMenu(); await m.handleBlockToggle(ctx); });
  bot.callbackQuery("back_leads",          async ctx => { const m = await getCloserMenu(); await m.handleMyLeads(ctx); });

  // Scenario, trade history, delete, force reload, modal, presets, full data, txs
  bot.callbackQuery(/^scenario:(.+):(.+)$/,   async ctx => { const m = await getCloserMenu(); await m.handleSetScenario(ctx); });
  bot.callbackQuery(/^trade_hist:(.+)$/,       async ctx => { const m = await getCloserMenu(); await m.handleTradeHistory(ctx); });
  bot.callbackQuery(/^del_trade:(.+)$/,        async ctx => { const m = await getCloserMenu(); await m.handleDeleteTrade(ctx); });
  bot.callbackQuery(/^force_reload:(.+)$/,     async ctx => { const m = await getCloserMenu(); await m.handleForceReload(ctx); });
  bot.callbackQuery(/^show_modal:(.+)$/,       async ctx => { const m = await getCloserMenu(); await m.handleShowModal(ctx); });
  bot.callbackQuery(/^presets:(.+)$/,          async ctx => { const m = await getCloserMenu(); await m.handlePresetScripts(ctx); });
  bot.callbackQuery(/^preset_send:(.+):(.+)$/,async ctx => { const m = await getCloserMenu(); await m.handlePresetSend(ctx); });
  bot.callbackQuery(/^lead_data:(.+)$/,        async ctx => { const m = await getCloserMenu(); await m.handleLeadFullData(ctx); });
  bot.callbackQuery(/^lead_txs:(.+)$/,         async ctx => { const m = await getCloserMenu(); await m.handleLeadTransactions(ctx); });

  // ─── Callback queries: ADMIN panel ──────────────────────────────────────────
  bot.callbackQuery(/^cl_toggle:(.+)$/,  async ctx => { const m = await getAdminMenu(); await m.handleCloserToggle(ctx); });
  bot.callbackQuery(/^cl_delete:(.+)$/,  async ctx => { const m = await getAdminMenu(); await m.handleCloserDelete(ctx); });
  bot.callbackQuery(/^cl_leads:(.+)$/,   async ctx => { const m = await getAdminMenu(); await m.handleCloserLeads(ctx); });
  bot.callbackQuery(/^reassign:(.+)$/,   async ctx => { const m = await getAdminMenu(); await m.handleReassign(ctx); });
  bot.callbackQuery(/^rotate_inv:(.+)$/, async ctx => { const m = await getAdminMenu(); await m.handleRotateInvite(ctx); });
  bot.callbackQuery(/^cl_stats:(.+)$/,   async ctx => { const m = await getAdminMenu(); await m.handleCloserStats(ctx); });

  // ─── Callback queries: Finance (deposit confirm from bot) ───────────────────
  bot.callbackQuery(/^dep_confirm:(.+)$/, async ctx => {
    const txId = ctx.match[1];
    const tgId = BigInt(ctx.from!.id);
    const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
    if (!admin) {
      await ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
      return;
    }
    try {
      const { confirmDeposit } = await import("../services/financeService");
      const result = await confirmDeposit(txId, admin.id);
      if (result.ok) {
        await ctx.answerCallbackQuery({ text: "✅ Депозит подтверждён" });
        await ctx.editMessageText(`✅ Депозит #${txId.slice(-8)} подтверждён`);
      } else {
        await ctx.answerCallbackQuery({ text: result.error ?? "Ошибка", show_alert: true });
      }
    } catch (e) {
      await ctx.answerCallbackQuery({ text: "Ошибка подтверждения", show_alert: true });
    }
  });

  // ─── /start ─────────────────────────────────────────────────────────────────
  //
  // Обрабатывает:
  //   • /start                — обычный старт
  //   • /start cl_<code>      — Deep Link от CLOSER (привязка лида)
  //   • /start joincl_<token> — Регистрация нового CLOSER по ссылке-приглашению
  //
  bot.command("start", async ctx => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    const startParam = ctx.match ?? ""; // текст после /start
    const tgId = BigInt(tgUser.id);

    // ── Приглашение стать клоузером ─────────────────────────────────────────
    if (startParam.startsWith("joincl_")) {
      const joinToken = startParam.slice(7);
      // Ищем pending-запись (отрицательный tg_id + username __pending__)
      const pending = await prisma.admin.findFirst({
        where: { invite_code: joinToken, tg_id: { lt: BigInt(0) }, username: "__pending__" },
      });

      if (!pending) {
        await ctx.reply("❌ Ссылка недействительна или уже использована.");
        return;
      }

      // Проверяем, не является ли уже админом/клоузером
      const alreadyAdmin = await prisma.admin.findFirst({
        where: { tg_id: tgId, NOT: { id: pending.id } },
      });
      if (alreadyAdmin) {
        await ctx.reply("❌ Вы уже зарегистрированы как админ/клоузер.");
        return;
      }

      // Генерируем invite_code для лидов этого клоузера
      const { randomBytes } = await import("crypto");
      const inviteCode = randomBytes(6).toString("hex");

      // Активируем клоузера
      await prisma.admin.update({
        where: { id: pending.id },
        data: {
          tg_id:       tgId,
          username:    tgUser.username ?? null,
          is_active:   true,
          invite_code: inviteCode,
        },
      });

      const refLink = `https://t.me/${getBotUsername()}?start=cl_${inviteCode}`;

      await ctx.reply(
        [
          `✅ <b>Добро пожаловать, ${tgUser.first_name ?? ''}!</b>`,
          ``,
          `Вы зарегистрированы как <b>CLOSER</b>.`,
          ``,
          `🔗 Ваша реферальная ссылка для лидов:`,
          `<code>${refLink}</code>`,
          ``,
          `Команды:`,
          `/my_leads — ваши лиды`,
          `/mylink — ваша ссылка`,
        ].join("\n"),
        { parse_mode: "HTML" }
      );

      // Уведомляем SuperAdmin
      const sa = await prisma.admin.findFirst({ where: { role: "SUPER_ADMIN", is_active: true } });
      if (sa) {
        await bot.api.sendMessage(
          String(sa.tg_id),
          [
            `🆕 <b>Новый клоузер активирован!</b>`,
            `👤 ${tgUser.first_name ?? '—'} (@${tgUser.username ?? '—'}) [${tgUser.id}]`,
            `🔗 Ref: <code>${refLink}</code>`,
          ].join("\n"),
          { parse_mode: "HTML" }
        ).catch(() => null);
      }

      return;
    }

    // ── Найти или создать пользователя ──────────────────────────────────────
    let user = await prisma.user.findUnique({ where: { tg_id: tgId } });

    if (!user) {
      let ownerId: string | null = null;

      if (startParam.startsWith("cl_")) {
        const inviteCode = startParam.slice(3);
        const closer = await prisma.admin.findFirst({
          where: { invite_code: inviteCode, is_active: true },
        });
        if (closer) ownerId = closer.id;
      }

      // Fallback → SUPER_ADMIN
      if (!ownerId) {
        const sa = await prisma.admin.findFirst({ where: { role: "SUPER_ADMIN", is_active: true } });
        ownerId = sa?.id ?? null;
      }

      user = await prisma.user.create({
        data: {
          tg_id:      tgId,
          username:   tgUser.username   ?? null,
          first_name: tgUser.first_name ?? null,
          last_name:  tgUser.last_name  ?? null,
          owner_id:   ownerId,
          balances: {
            create: [
              { symbol: "USDT", available: 0 },
              { symbol: "BTC",  available: 0 },
              { symbol: "ETH",  available: 0 },
            ],
          },
        },
        include: { owner: true },
      });

      // Уведомляем менеджера о новом лиде
      const owner = (user as typeof user & { owner?: { tg_id: bigint; username?: string | null } | null }).owner;
      if (owner) {
        await bot.api.sendMessage(
          String(owner.tg_id),
          [
            "🎯 <b>Новый лид прикреплён!</b>",
            "",
            `👤 ${fmtUser(user)}`,
            `🔗 via invite_code: <code>${startParam || "—"}</code>`,
          ].join("\n"),
          { parse_mode: "HTML" }
        ).catch(() => null);
      }
    }

    // ── Ответ пользователю ───────────────────────────────────────────────────
    if (user.is_blocked) {
      await ctx.reply("❌ Ваш аккаунт заблокирован. Обратитесь в поддержку.");
      return;
    }

    await ctx.reply(
      [
        `👋 Привет, ${tgUser.first_name ?? ""}!`,
        "",
        "Добро пожаловать в <b>NEXO</b>.",
        "Откройте Mini App, чтобы начать торговать.",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  });

  // ─── Обработка текстовых сообщений ──────────────────────────────────────────
  //
  // Логика relay:
  //   • Если пишет USER → пересылаем его CLOSER'у с кнопкой «Ответить»
  //   • Если CLOSER находится в режиме ответа (session.replyToUserId) → отправляем ответ лиду

  bot.on("message:text", async ctx => {
    const tgId = BigInt(ctx.from!.id);

    // ── Проверяем: это CLOSER? ───────────────────────────────────────────────
    const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });

    if (admin) {
      // ── Проверяем pending actions из closerMenu / adminMenu ───────────────
      const pending = ctx.session.pendingAction;
      if (pending) {
        if (pending.type === "balance_add" || pending.type === "balance_sub" || pending.type === "bal_add" || pending.type === "bal_sub" || pending.type === "show_modal") {
          const cm = await getCloserMenu();
          await cm.processPendingAction(ctx, ctx.message.text);
          return;
        }
        if (pending.type === "reassign") {
          const am = await getAdminMenu();
          await am.processReassign(ctx, ctx.message.text);
          return;
        }
        if (pending.type === "add_closer") {
          const am = await getAdminMenu();
          await am.processAddCloser(ctx, ctx.message.text);
          return;
        }
        if (pending.type === "broadcast") {
          const am = await getAdminMenu();
          await am.processBroadcast(ctx, ctx.message.text);
          return;
        }
      }

      // ── Режим ответа: CLOSER только что нажал «Ответить» ─────────────────
      const replyToId = ctx.session.replyToUserId;
      if (replyToId) {
        ctx.session.replyToUserId = undefined;

        const lead = await prisma.user.findUnique({ where: { id: replyToId } });
        if (!lead) {
          await ctx.reply("❌ Пользователь не найден.");
          return;
        }

        // Сохраняем сообщение в лог
        await prisma.supportMessage.create({
          data: {
            user_id: lead.id,
            sender:  "CLOSER",
            text:    ctx.message.text,
          },
        });

        // Отправляем лиду сообщение от имени бота
        try {
          await bot.api.sendMessage(
            String(lead.tg_id),
            [
              "💬 <b>Сообщение от вашего менеджера:</b>",
              "",
              ctx.message.text,
            ].join("\n"),
            { parse_mode: "HTML" }
          );
          await ctx.reply(`✅ Сообщение отправлено лиду ${fmtUser(lead)}`);
        } catch {
          await ctx.reply("❌ Не удалось доставить сообщение. Возможно, пользователь заблокировал бота.");
        }
        return;
      }

      // CLOSER написал просто так — ничего не делаем
      await ctx.reply("ℹ️ Используйте кнопку «Ответить» под сообщением лида для ответа.");
      return;
    }

    // ── Это USER → пересылаем CLOSER'у ───────────────────────────────────────
    const user = await prisma.user.findUnique({
      where:   { tg_id: tgId },
      include: { owner: true },
    });

    if (!user) {
      await ctx.reply("🔒 Вы не зарегистрированы. Введите /start");
      return;
    }

    if (user.is_blocked) {
      await ctx.reply("❌ Ваш аккаунт заблокирован.");
      return;
    }

    const owner = (user as typeof user & { owner?: { tg_id: bigint } | null }).owner;
    if (!owner) {
      // Нет менеджера — сохраняем, но никому не пересылаем (виден только SUPER_ADMIN)
      await prisma.supportMessage.create({
        data: { user_id: user.id, sender: "USER", text: ctx.message.text },
      });
      await ctx.reply("📨 Ваше сообщение получено. Мы свяжемся с вами.");
      return;
    }

    // Сохраняем сообщение в лог
    await prisma.supportMessage.create({
      data: {
        user_id:   user.id,
        sender:    "USER",
        text:      ctx.message.text,
        tg_msg_id: ctx.message.message_id,
      },
    });

    // Inline-кнопка «Ответить»: callback_data = reply:<userId>
    const keyboard = new InlineKeyboard()
      .text("✉️ Ответить", `reply:${user.id}`)
      .text("📑 Скрипты", `presets:${user.id}`).row()
      .text("⚙️ Управление", `manage:${user.id}`);

    const relayText = [
      `📩 <b>Сообщение от лида:</b>`,
      `👤 ${fmtUser(user)}`,
      "",
      `<blockquote>${ctx.message.text}</blockquote>`,
    ].join("\n");

    try {
      await bot.api.sendMessage(String(owner.tg_id), relayText, {
        parse_mode:   "HTML",
        reply_markup: keyboard,
      });
      await ctx.reply("📨 Ваше сообщение отправлено менеджеру.");
    } catch {
      await ctx.reply("⚠️ Не удалось доставить сообщение менеджеру. Попробуйте позже.");
    }
  });

  // ─── Callback: «Ответить» ────────────────────────────────────────────────────
  //
  // Когда CLOSER нажимает кнопку «Ответить» под сообщением лида

  bot.callbackQuery(/^reply:(.+)$/, async ctx => {
    const userId = ctx.match[1];
    const tgId   = BigInt(ctx.from!.id);

    // Проверяем, что это действительно CLOSER
    const admin = await prisma.admin.findUnique({ where: { tg_id: tgId } });
    if (!admin) {
      await ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
      return;
    }

    // Проверяем, что этот лид прикреплён к CLOSURE
    const lead = await prisma.user.findFirst({
      where: {
        id:       userId,
        owner_id: admin.role === "SUPER_ADMIN" ? undefined : admin.id,
      },
    });
    if (!lead) {
      await ctx.answerCallbackQuery({ text: "Лид не найден или не ваш", show_alert: true });
      return;
    }

    // Сохраняем в сессию — следующее сообщение CLOSER'а уйдёт этому лиду
    ctx.session.replyToUserId = userId;

    await ctx.answerCallbackQuery({ text: "✏️ Напишите ваш ответ" });
    await ctx.reply(
      `✏️ Напишите ответ для лида <b>${fmtUser(lead)}</b>.\n\nСледующее сообщение будет отправлено ему:`,
      { parse_mode: "HTML" }
    );
  });

  // ─── Глобальный обработчик ошибок ────────────────────────────────────────────
  bot.catch(err => {
    console.error("[Bot error]", err.message);
  });
}

// ─── Запуск бота ─────────────────────────────────────────────────────────────

export async function startBot(): Promise<void> {
  const bot = getBotInstance();
  // Кешируем username бота при старте
  await resolveBotUsername();
  console.log(`[Bot] Resolved username: @${getBotUsername()}`);
  console.log("[Bot] Starting long polling...");
  bot.start({ onStart: info => console.log(`[Bot] @${info.username} ready`) });
}
