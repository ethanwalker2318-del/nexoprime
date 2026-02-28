import { prisma } from "../lib/prisma";
import type { AdminRole } from "@prisma/client";

// ─── Получить полный профиль пользователя ─────────────────────────────────────

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      balances: true,
      owner: {
        select: { id: true, username: true, role: true },
      },
      kyc_requests: {
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  });
  return user;
}

// ─── Получить пользователей по owner_id (для CLOSER) ──────────────────────────

export async function getLeadsByOwner(ownerId: string) {
  return prisma.user.findMany({
    where: { owner_id: ownerId },
    include: {
      balances: true,
    },
    orderBy: { created_at: "desc" },
  });
}

// ─── Получить ВСЕХ пользователей (только SUPER_ADMIN) ─────────────────────────

export async function getAllUsers() {
  return prisma.user.findMany({
    include: {
      balances: true,
      owner: {
        select: { id: true, username: true, role: true },
      },
    },
    orderBy: { created_at: "desc" },
  });
}

// ─── Заблокировать / разблокировать пользователя ──────────────────────────────

export async function setUserBlocked(userId: string, blocked: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data:  { is_blocked: blocked, updated_at: new Date() },
  });
}

// ─── Включить / отключить торговлю ───────────────────────────────────────────

export async function setUserTrading(userId: string, enabled: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data:  { trading_enabled: enabled, updated_at: new Date() },
  });
}

// ─── Создать / обновить CLOSER (выдача invite_code) ──────────────────────────

export async function createCloser(tgId: bigint, username?: string) {
  const { randomBytes } = await import("crypto");
  const inviteCode = randomBytes(6).toString("hex"); // 12-символьный hex

  return prisma.admin.create({
    data: {
      tg_id:       tgId,
      username:    username ?? null,
      role:        "CLOSER" as AdminRole,
      invite_code: inviteCode,
    },
  });
}

// ─── Переприкрепить пользователя к другому менеджеру ─────────────────────────

export async function reassignUser(userId: string, newOwnerId: string | null) {
  return prisma.user.update({
    where: { id: userId },
    data:  { owner_id: newOwnerId, updated_at: new Date() },
  });
}
