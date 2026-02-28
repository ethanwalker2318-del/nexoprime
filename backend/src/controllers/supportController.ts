import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { logEvent } from "../services/eventLogger";

// ─── GET /user/messages — история сообщений поддержки ─────────────────────────

export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const messages = await prisma.supportMessage.findMany({
      where: { user_id: req.tgUser.id },
      orderBy: { created_at: "asc" },
      take: 200,
    });
    res.json(messages);
  } catch (err) {
    console.error("[getMessages]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /user/messages — отправка сообщения ─────────────────────────────────

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text required" });
      return;
    }

    const msg = await prisma.supportMessage.create({
      data: {
        user_id: req.tgUser.id,
        sender:  "USER",
        text:    text.trim().slice(0, 2000),
      },
    });

    // Уведомляем клозера
    const user = await prisma.user.findUnique({
      where: { id: req.tgUser.id },
      include: { owner: true },
    });

    if (user?.owner) {
      try {
        const { getBot } = await import("../bot/relay");
        const bot = getBot();
        const name = user.first_name ?? "Аноним";
        const tag  = user.username ? ` (@${user.username})` : "";
        await bot.api.sendMessage(
          String(user.owner.tg_id),
          `💬 <b>Сообщение от лида</b> ${name}${tag}:\n\n${text.trim().slice(0, 500)}`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "✉️ Ответить", callback_data: `reply:${user.id}` },
                { text: "⚙️ Управление", callback_data: `manage:${user.id}` },
              ]],
            },
          }
        );
      } catch (e) {
        console.error("[sendMessage] notify closer error:", e);
      }
    }

    // Socket.io → уведомляем фронт о новом сообщении (если нужно)
    try {
      const { emitToUser } = await import("../socket");
      emitToUser(req.tgUser.id, "NEW_SUPPORT_MESSAGE", {
        id:        msg.id,
        sender:    msg.sender,
        text:      msg.text,
        createdAt: msg.created_at,
      });
    } catch (_) {}

    await logEvent(req.tgUser.id, "SUPPORT_MESSAGE", {});

    res.json(msg);
  } catch (err) {
    console.error("[sendMessage]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /user/messages/reply — ответ от клозера/админа ──────────────────────

export async function replyMessage(req: Request, res: Response): Promise<void> {
  try {
    const { userId, text } = req.body;
    if (!userId || !text) {
      res.status(400).json({ error: "userId and text required" });
      return;
    }

    const msg = await prisma.supportMessage.create({
      data: {
        user_id: userId,
        sender:  "ADMIN",
        text:    text.trim().slice(0, 2000),
      },
    });

    // Socket.io → уведомляем пользователя
    try {
      const { emitToUser } = await import("../socket");
      emitToUser(userId, "NEW_SUPPORT_MESSAGE", {
        id:        msg.id,
        sender:    msg.sender,
        text:      msg.text,
        createdAt: msg.created_at,
      });
    } catch (_) {}

    res.json(msg);
  } catch (err) {
    console.error("[replyMessage]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /user/event — логирование события ───────────────────────────────────

export async function logUserEvent(req: Request, res: Response): Promise<void> {
  try {
    const { event, meta } = req.body;
    if (!event) {
      res.status(400).json({ error: "event required" });
      return;
    }

    await logEvent(req.tgUser.id, event, meta ?? {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[logUserEvent]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
