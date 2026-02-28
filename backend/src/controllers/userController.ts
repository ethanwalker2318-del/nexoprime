import type { Request, Response } from "express";
import { getUserProfile }        from "../services/userService";
import { adjustBalance }         from "../services/balanceService";
import { prisma }                from "../lib/prisma";

// ─── GET /user/profile ────────────────────────────────────────────────────────
// Возвращает данные лида, балансы, KYC статус и настройки торговли.

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUserProfile(req.tgUser.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // ── 403 если заблокирован ────────────────────────────────────────────────
    if (user.is_blocked) {
      res.status(403).json({
        error:   "ACCESS_DENIED",
        message: "Your account has been suspended. Please contact support.",
      });
      return;
    }

    res.json({
      id:              user.id,
      tg_id:           String(user.tg_id),  // BigInt → string
      username:        user.username,
      first_name:      user.first_name,
      last_name:       user.last_name,
      kyc_status:      user.kyc_status,
      // trading_enabled: false фронтенд должен заблокировать UI торговли
      trading_enabled: user.trading_enabled,
      is_blocked:      user.is_blocked,
      owner:           user.owner ?? null,
      balances:        user.balances.map(a => ({
        symbol:    a.symbol,
        available: Number(a.available),
        locked:    Number(a.locked),
      })),
      kyc_request: user.kyc_requests[0] ?? null,
    });
  } catch (err) {
    console.error("[getProfile]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── PATCH /admin/users/:userId/balance ───────────────────────────────────────
// Обновить баланс. Доступно только:
//   • SUPER_ADMIN
//   • CLOSER, который является owner пользователя

export async function updateBalance(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { symbol, delta } = req.body as { symbol: string; delta: number };
    const admin = req.tgAdmin!; // requireAdmin middleware уже проверил

    if (!symbol || typeof delta !== "number") {
      res.status(400).json({ error: "symbol and delta (number) required" });
      return;
    }

    // ── Проверяем доступ CLOSER'а ────────────────────────────────────────────
    if (admin.role === "CLOSER") {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser || targetUser.owner_id !== admin.id) {
        res.status(403).json({ error: "You are not the owner of this user" });
        return;
      }
    }

    const result = await adjustBalance(userId, symbol.toUpperCase(), delta);
    if (!result.ok) {
      res.status(422).json({ error: result.error });
      return;
    }

    // Возвращаем новый баланс
    const asset = await prisma.asset.findUnique({
      where: { user_id_symbol: { user_id: userId, symbol: symbol.toUpperCase() } },
    });

    res.json({
      ok:        true,
      symbol:    symbol.toUpperCase(),
      available: Number(asset?.available ?? 0),
      locked:    Number(asset?.locked    ?? 0),
    });
  } catch (err) {
    console.error("[updateBalance]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── PATCH /admin/users/:userId/block ─────────────────────────────────────────

export async function blockUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { blocked } = req.body as { blocked: boolean };

    if (typeof blocked !== "boolean") {
      res.status(400).json({ error: "blocked (boolean) required" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data:  { is_blocked: blocked },
    });

    res.json({ ok: true, is_blocked: user.is_blocked });
  } catch (err) {
    console.error("[blockUser]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── PATCH /admin/users/:userId/trading ───────────────────────────────────────

export async function setTrading(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { enabled } = req.body as { enabled: boolean };

    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled (boolean) required" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data:  { trading_enabled: enabled },
    });

    res.json({ ok: true, trading_enabled: user.trading_enabled });
  } catch (err) {
    console.error("[setTrading]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
