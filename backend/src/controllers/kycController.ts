import type { Request, Response } from "express";
import { createKycRequest, reviewKycRequest, getUserKycHistory } from "../services/kycService";
import { getBotInstance } from "../bot/relay";

// ─── POST /user/kyc ───────────────────────────────────────────────────────────
// Создать заявку на верификацию из Mini App.
// Бот автоматически уведомит SUPER_ADMIN и CLOSER.

export async function submitKyc(req: Request, res: Response): Promise<void> {
  try {
    const { full_name, document_url, selfie_url } = req.body as {
      full_name:     string;
      document_url:  string;
      selfie_url?:   string;
    };

    if (!full_name || !document_url) {
      res.status(400).json({ error: "full_name and document_url required" });
      return;
    }

    const bot = getBotInstance();

    const result = await createKycRequest(
      req.tgUser.id,
      full_name,
      document_url,
      selfie_url,
      bot
    );

    if (!result.ok) {
      res.status(422).json({ error: result.error });
      return;
    }

    res.json({ ok: true, message: "Verification request submitted" });
  } catch (err) {
    console.error("[submitKyc]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST /admin/kyc/:requestId/review ────────────────────────────────────────
// Одобрить или отклонить заявку (только SUPER_ADMIN).

export async function reviewKyc(req: Request, res: Response): Promise<void> {
  try {
    const admin = req.tgAdmin!;
    if (admin.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only SUPER_ADMIN can review KYC" });
      return;
    }

    const { requestId } = req.params;
    const { approved, reject_reason } = req.body as {
      approved:       boolean;
      reject_reason?: string;
    };

    const result = await reviewKycRequest(requestId, admin.id, approved, reject_reason);
    res.json(result);
  } catch (err) {
    console.error("[reviewKyc]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── GET /user/kyc/history ────────────────────────────────────────────────────

export async function kycHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await getUserKycHistory(req.tgUser.id);
    res.json(history);
  } catch (err) {
    console.error("[kycHistory]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
