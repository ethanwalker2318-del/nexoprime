import { Router } from "express";
import { tgAuthMiddleware, requireAdmin } from "../middleware/auth";
import {
  getProfile,
  updateBalance,
  blockUser,
  setTrading,
} from "../controllers/userController";
import {
  submitKyc,
  reviewKyc,
  kycHistory,
} from "../controllers/kycController";
import { getUserTransactions } from "../services/balanceService";

// Новые контроллеры
import {
  placeTrade,
  calculateTrade,
  activeTrades,
  tradeHistory,
} from "../controllers/tradeController";
import {
  requestDeposit,
  confirmDepositCtrl,
  requestWithdrawal,
  cancelWithdrawalCtrl,
} from "../controllers/financeController";
import {
  getMessages,
  sendMessage,
  replyMessage,
  logUserEvent,
} from "../controllers/supportController";
import {
  tradeRateLimitMiddleware,
  chatRateLimitMiddleware,
  antiTamperMiddleware,
} from "../middleware/security";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// USER ROUTES (требуют Telegram initData)
// ─────────────────────────────────────────────────────────────────────────────

// Профиль
router.get("/user/profile", tgAuthMiddleware, getProfile);

// KYC
router.post("/user/kyc", tgAuthMiddleware, submitKyc);
router.get("/user/kyc/history", tgAuthMiddleware, kycHistory);

// Транзакции
router.get("/user/transactions", tgAuthMiddleware, async (req, res) => {
  try {
    const { limit } = req.query as { limit?: string };
    const txs = await getUserTransactions(req.tgUser.id, Number(limit ?? 50));
    res.json(txs);
  } catch (err) {
    console.error("[transactions]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── TRADES ──────────────────────────────────────────────────────────────────
router.post("/trade/place",     tgAuthMiddleware, tradeRateLimitMiddleware, antiTamperMiddleware, placeTrade);
router.post("/trade/calculate", tgAuthMiddleware, calculateTrade);
router.get("/trade/active",     tgAuthMiddleware, activeTrades);
router.get("/trade/history",    tgAuthMiddleware, tradeHistory);

// ─── FINANCE ─────────────────────────────────────────────────────────────────
router.post("/finance/deposit",          tgAuthMiddleware, requestDeposit);
router.post("/finance/deposit/confirm",  tgAuthMiddleware, confirmDepositCtrl);
router.post("/finance/withdraw",         tgAuthMiddleware, antiTamperMiddleware, requestWithdrawal);
router.post("/finance/withdraw/cancel",  tgAuthMiddleware, cancelWithdrawalCtrl);

// ─── SUPPORT / CHAT ─────────────────────────────────────────────────────────
router.get("/user/messages",       tgAuthMiddleware, getMessages);
router.post("/user/messages",      tgAuthMiddleware, chatRateLimitMiddleware, sendMessage);
router.post("/user/messages/reply", tgAuthMiddleware, replyMessage);

// ─── EVENT LOGGER ────────────────────────────────────────────────────────────
router.post("/user/event", tgAuthMiddleware, logUserEvent);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES (требуют заголовок X-Admin-Id)
// ─────────────────────────────────────────────────────────────────────────────

router.patch("/admin/users/:userId/balance",  requireAdmin, updateBalance);
router.patch("/admin/users/:userId/block",    requireAdmin, blockUser);
router.patch("/admin/users/:userId/trading",  requireAdmin, setTrading);
router.post("/admin/kyc/:requestId/review",   requireAdmin, reviewKyc);

export default router;
