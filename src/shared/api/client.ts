/**
 * API-клиент для NEXO Backend.
 *
 * Все запросы автоматически подписываются Telegram initData
 * для авторизации на бэкенде.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

function getInitData(): string {
  try {
    // @ts-ignore — Telegram WebApp SDK
    return window.Telegram?.WebApp?.initData ?? "";
  } catch {
    return "";
  }
}

async function request<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": getInitData(),
    ...(opts.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(url, { ...opts, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Unknown error", body);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Удобные обёртки ─────────────────────────────────────────────────────────

export const api = {
  get:   <T = unknown>(path: string)              => request<T>(path, { method: "GET" }),
  post:  <T = unknown>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T = unknown>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
};

// ─── Типизированные методы ───────────────────────────────────────────────────

/** Профиль, балансы, KYC */
export const getProfile  = ()             => api.get<UserProfile>("/user/profile");

/** Трейды */
export const placeTrade  = (data: PlaceTradeReq) => api.post<PlaceTradeRes>("/trade/place", data);
export const getActiveTrades   = ()              => api.get<Trade[]>("/trade/active");
export const getTradeHistory   = (limit = 50)    => api.get<Trade[]>(`/trade/history?limit=${limit}`);

/** Финансы */
export const createDeposit     = (data: DepositReq)    => api.post<DepositRes>("/finance/deposit", data);
export const createWithdrawal  = (data: WithdrawReq)   => api.post<WithdrawRes>("/finance/withdraw", data);
export const cancelWithdrawal  = (txId: string)        => api.post("/finance/withdraw/cancel", { txId });

/** KYC */
export const submitKyc        = (data: KycReq)    => api.post("/user/kyc", data);
export const getKycHistory    = ()                 => api.get("/user/kyc/history");

/** Транзакции */
export const getTransactions  = (limit = 50)       => api.get(`/user/transactions?limit=${limit}`);

/** Поддержка */
export const getMessages      = ()                 => api.get("/user/messages");
export const sendMessage      = (text: string)     => api.post("/user/messages", { text });

/** Логирование событий */
export const logEvent = (event: string, meta?: Record<string, unknown>) =>
  api.post("/user/event", { event, meta }).catch(() => { /* silent */ });

// ─── Интерфейсы ──────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  tg_id: string;
  username: string | null;
  first_name: string | null;
  kyc_level: string;
  is_blocked: boolean;
  trading_enabled: boolean;
  balances: Array<{ symbol: string; available: number }>;
  created_at: string;
}

export interface PlaceTradeReq {
  symbol: string;
  direction: "CALL" | "PUT";
  amount: number;
  entryPrice: number;
  expiryMs: number;
}

export interface PlaceTradeRes {
  ok: boolean;
  tradeId?: string;
  forced_result?: string;
  error?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: string;
  amount: number;
  entry_price: number;
  exit_price: number | null;
  pnl: number;
  status: string;
  forced_result: string;
  expires_at: string;
  created_at: string;
}

export interface DepositReq {
  asset: string;
  amount: number;
}

export interface DepositRes {
  ok: boolean;
  txId?: string;
  address?: string;
  error?: string;
}

export interface WithdrawReq {
  asset: string;
  amount: number;
  address: string;
  fee?: number;
}

export interface WithdrawRes {
  ok: boolean;
  txId?: string;
  error?: string;
}

export interface KycReq {
  doc_type: string;
  selfie_url: string;
  doc_url: string;
  country: string;
}
