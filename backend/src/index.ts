import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { prisma } from "./lib/prisma";
import routes from "./routes";
import { startBot } from "./bot/relay";
import { initSocketIO } from "./socket";
import { rateLimitMiddleware, cloakingMiddleware } from "./middleware/security";

const app    = express();
const server = createServer(app);
const PORT   = Number(process.env.PORT ?? 3000);

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS для Mini App (Telegram WebApp)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data, X-Admin-Id, X-Dev-Tg-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Security: Rate Limiting + Cloaking
app.use(rateLimitMiddleware);
app.use(cloakingMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/v1", routes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Express error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Старт ────────────────────────────────────────────────────────────────────

async function main() {
  // Подключаемся к БД
  await prisma.$connect();
  console.log("[DB] Connected to PostgreSQL");

  // Инициализируем Socket.io на HTTP-сервере
  initSocketIO(server);
  console.log("[WS] Socket.io initialized at /ws");

  // Запускаем HTTP-сервер (Express + Socket.io)
  server.listen(PORT, () => {
    console.log(`[API] Server running on http://localhost:${PORT}`);
  });

  // Grammy Bot
  await startBot();
}

main().catch(err => {
  console.error("[FATAL]", err);
  process.exit(1);
});
