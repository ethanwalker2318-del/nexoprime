// ─── Event Logger — трекинг действий лида → уведомления клоузеру ─────────────

import { prisma } from "../lib/prisma";

// Тип событий
export type EventType =
  | "APP_OPEN"
  | "TRADE_OPEN"
  | "TRADE_CLOSE"
  | "WITHDRAW_PAGE"
  | "DEPOSIT_PAGE"
  | "KYC_SUBMIT"
  | "PROFILE_VIEW"
  | "SUPPORT_MESSAGE"
  | "TRADE_PAGE_VIEW";

const EVENT_LABELS: Record<EventType, string> = {
  APP_OPEN:         "📱 Открыл приложение",
  TRADE_OPEN:       "📈 Открыл сделку",
  TRADE_CLOSE:      "📉 Закрыл сделку",
  WITHDRAW_PAGE:    "💸 Перешёл на страницу вывода",
  DEPOSIT_PAGE:     "💰 Перешёл на страницу депозита",
  KYC_SUBMIT:       "🪪 Подал заявку на KYC",
  PROFILE_VIEW:     "👤 Открыл профиль",
  SUPPORT_MESSAGE:  "✉️ Написал в поддержку",
  TRADE_PAGE_VIEW:  "📊 Открыл торговый экран",
};

// ─── Записать событие и уведомить клоузера ────────────────────────────────────

export async function logEvent(
  userId: string,
  event:  EventType,
  meta?:  Record<string, unknown>
): Promise<void> {
  // Сохраняем в БД
  await prisma.eventLog.create({
    data: {
      user_id: userId,
      event,
      meta: meta ? (meta as any) : undefined,
    },
  });

  // Получаем пользователя и менеджера
  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { owner: true },
  });
  if (!user?.owner) return;

  // Формируем уведомление клоузеру
  const label = EVENT_LABELS[event] ?? event;
  const name  = user.first_name ?? "Аноним";
  const tag   = user.username ? ` (@${user.username})` : "";

  // Фильтр: не спамим при каждом APP_OPEN (отправляем не чаще 1 раз в 5 мин)
  if (event === "APP_OPEN") {
    const recent = await prisma.eventLog.findFirst({
      where: {
        user_id: userId,
        event:   "APP_OPEN",
        created_at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        id: { not: undefined }, // workaround
      },
      orderBy: { created_at: "desc" },
      skip: 1, // пропускаем текущую запись
    });
    if (recent) return; // недавно уже отправляли
  }

  // Важные события → отправляем мгновенно
  const isHot = ["WITHDRAW_PAGE", "DEPOSIT_PAGE", "KYC_SUBMIT", "TRADE_OPEN"].includes(event);

  let text = `${label}\n👤 ${name}${tag}\n`;
  if (meta) {
    const metaStr = Object.entries(meta)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    text += `📋 ${metaStr}`;
  }
  if (isHot) {
    text = `🔥 <b>ГОРЯЧИЙ ЛИД!</b>\n${text}`;
  }

  try {
    const { getBotInstance } = await import("../bot/relay");
    const bot = getBotInstance();
    await bot.api.sendMessage(String(user.owner.tg_id), text, { parse_mode: "HTML" });
  } catch (e) {
    console.error("[EventLogger] Failed to notify closer:", (e as Error).message);
  }
}

// ─── Получить историю событий пользователя ───────────────────────────────────

export async function getUserEvents(userId: string, limit = 100) {
  return prisma.eventLog.findMany({
    where:   { user_id: userId },
    orderBy: { created_at: "desc" },
    take:    limit,
  });
}
