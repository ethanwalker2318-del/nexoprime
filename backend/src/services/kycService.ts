import { prisma } from "../lib/prisma";
import type { Bot } from "grammy";
import type { KycStatus } from "@prisma/client";

// ─── Создать заявку на верификацию ────────────────────────────────────────────
// Вызывается из Mini App при отправке формы KYC
//
// После создания → уведомляем:
//   1. SUPER_ADMIN (ADMIN_NOTIFY_CHAT_ID)
//   2. Персональный менеджер (CLOSER) пользователя

export async function createKycRequest(
  userId:      string,
  fullName:    string,
  documentUrl: string,
  selfieUrl?:  string,
  bot?:        Bot<any>
): Promise<{ ok: boolean; error?: string }> {
  // Проверяем: нет ли уже активной заявки
  const pending = await prisma.kycRequest.findFirst({
    where: { user_id: userId, status: "PENDING" },
  });
  if (pending) return { ok: false, error: "Verification request already pending" };

  // Получаем пользователя с балансами и менеджером
  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { balances: true, owner: true },
  });
  if (!user) return { ok: false, error: "User not found" };

  // Создаём заявку
  const request = await prisma.kycRequest.create({
    data: {
      user_id:      userId,
      full_name:    fullName,
      document_url: documentUrl,
      selfie_url:   selfieUrl ?? null,
      status:       "PENDING",
    },
  });

  // Обновляем KYC-статус у пользователя
  await prisma.user.update({
    where: { id: userId },
    data:  { kyc_status: "PENDING" },
  });

  // ── Отправка уведомлений через бота ────────────────────────────────────────
  if (bot) {
    const usdtBalance = user.balances.find(b => b.symbol === "USDT");
    const btcBalance  = user.balances.find(b => b.symbol === "BTC");

    const msg = [
      "🔔 <b>Новая заявка на верификацию</b>",
      "",
      `👤 <b>Лид:</b> ${user.first_name ?? ""} ${user.last_name ?? ""}${user.username ? ` (@${user.username})` : ""}`,
      `🆔 <b>TG ID:</b> <code>${user.tg_id}</code>`,
      `📋 <b>Имя (документ):</b> ${fullName}`,
      "",
      "💰 <b>Балансы:</b>",
      `  • USDT: <code>${usdtBalance ? Number(usdtBalance.available).toFixed(2) : "0.00"}</code>`,
      `  • BTC:  <code>${btcBalance  ? Number(btcBalance.available).toFixed(8) : "0.00000000"}</code>`,
      "",
      `📎 <a href="${documentUrl}">Документ</a>${selfieUrl ? ` | <a href="${selfieUrl}">Селфи</a>` : ""}`,
      "",
      `🕐 <b>Заявка ID:</b> <code>${request.id}</code>`,
    ].join("\n");

    const notifyChats: string[] = [];

    // 1. Главный admin-чат
    const adminChatId = process.env.ADMIN_NOTIFY_CHAT_ID;
    if (adminChatId) notifyChats.push(adminChatId);

    // 2. Персональный менеджер (CLOSER), если привязан
    if (user.owner && user.owner.role === "CLOSER") {
      notifyChats.push(String(user.owner.tg_id));
    }

    await Promise.allSettled(
      notifyChats.map(chatId =>
        bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }).catch(e => {
          console.error(`[KYC notify] Failed to send to ${chatId}:`, e.message);
        })
      )
    );
  }

  return { ok: true };
}

// ─── Рассмотреть заявку (SUPER_ADMIN) ─────────────────────────────────────────

export async function reviewKycRequest(
  requestId:    string,
  reviewerId:   string,
  approved:     boolean,
  rejectReason?: string
) {
  const request = await prisma.kycRequest.findUnique({
    where:   { id: requestId },
    include: { user: true },
  });
  if (!request) throw new Error("KYC request not found");

  const newStatus: KycStatus = approved ? "VERIFIED" : "NONE";

  await prisma.$transaction([
    prisma.kycRequest.update({
      where: { id: requestId },
      data: {
        status:        approved ? "VERIFIED" : "NONE",
        reviewer_id:   reviewerId,
        reject_reason: rejectReason ?? null,
        reviewed_at:   new Date(),
      },
    }),
    prisma.user.update({
      where: { id: request.user_id },
      data:  { kyc_status: newStatus },
    }),
  ]);

  return { ok: true, status: newStatus };
}

// ─── История KYC-заявок пользователя ─────────────────────────────────────────

export async function getUserKycHistory(userId: string) {
  return prisma.kycRequest.findMany({
    where:   { user_id: userId },
    orderBy: { created_at: "desc" },
  });
}
