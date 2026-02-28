/**
 * useSocket — React hook для Socket.io подключения к NEXO Backend.
 *
 * Автоматически:
 *   1. Подключается к WS при монтировании
 *   2. Отправляет AUTH с Telegram initData
 *   3. Слушает ключевые серверные события
 *   4. Даёт emit() для отправки (PLACE_BINARY, LOG_EVENT…)
 *
 * Зависимость: socket.io-client (npm i socket.io-client)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL ?? "https://nexo-api.auraglobal-merchants.com";

// ─── Типы серверных событий ──────────────────────────────────────────────────

export interface BalanceUpdatePayload {
  balances: Array<{ symbol: string; available: number; locked?: number }>;
}

export interface BinaryResultPayload {
  tradeId: string;
  status: "WON" | "LOST" | "DRAW";
  exitPrice: number;
  pnl: number;
  forced: boolean;
}

export interface BinaryPlacedPayload {
  ok: boolean;
  tradeId?: string;
  error?: string;
}

export interface WithdrawalRejectedPayload {
  txId: string;
  reason: string;
}

export interface SupportMessagePayload {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}

export interface ShowModalPayload {
  title: string;
  text: string;
  type: "info" | "warning" | "error" | "success";
}

export interface TickOverridePayload {
  symbol: string;
  price: number;
  ts: number;
}

export interface UpdateKycPayload {
  kycStatus: string;
}

export interface TradingToggledPayload {
  enabled: boolean;
}

// ─── Event callbacks ─────────────────────────────────────────────────────────

export interface SocketCallbacks {
  onBalanceUpdate?:       (data: BalanceUpdatePayload) => void;
  onBinaryResult?:        (data: BinaryResultPayload) => void;
  onBinaryPlaced?:        (data: BinaryPlacedPayload) => void;
  onWithdrawalRejected?:  (data: WithdrawalRejectedPayload) => void;
  onSupportMessage?:      (data: SupportMessagePayload) => void;
  onForceLogout?:         () => void;
  onForceReload?:         () => void;
  onShowModal?:           (data: ShowModalPayload) => void;
  onTickOverride?:        (data: TickOverridePayload) => void;
  onUpdateKyc?:           (data: UpdateKycPayload) => void;
  onTradingToggled?:      (data: TradingToggledPayload) => void;
  onForceProfileRefresh?: () => void;
  onConnect?:             () => void;
  onDisconnect?:          () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSocket(callbacks: SocketCallbacks = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const cbRef     = useRef(callbacks);
  cbRef.current   = callbacks;

  useEffect(() => {
    const initData = (() => {
      try {
        // @ts-ignore
        return window.Telegram?.WebApp?.initData ?? "";
      } catch {
        return "";
      }
    })();

    const socket = io(WS_URL, {
      path: "/ws",
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("AUTH", { initData });
      cbRef.current.onConnect?.();
    });

    socket.on("disconnect", () => {
      setConnected(false);
      cbRef.current.onDisconnect?.();
    });

    // ─── Серверные события ──────────────────────────────────────────────────

    socket.on("BALANCE_UPDATE", (data: BalanceUpdatePayload) => {
      cbRef.current.onBalanceUpdate?.(data);
    });

    socket.on("BINARY_RESULT", (data: BinaryResultPayload) => {
      cbRef.current.onBinaryResult?.(data);
    });

    socket.on("BINARY_PLACED", (data: BinaryPlacedPayload) => {
      cbRef.current.onBinaryPlaced?.(data);
    });

    socket.on("WITHDRAWAL_REJECTED", (data: WithdrawalRejectedPayload) => {
      cbRef.current.onWithdrawalRejected?.(data);
    });

    socket.on("NEW_SUPPORT_MESSAGE", (data: SupportMessagePayload) => {
      cbRef.current.onSupportMessage?.(data);
    });

    socket.on("FORCE_LOGOUT", () => {
      cbRef.current.onForceLogout?.();
    });

    socket.on("FORCE_RELOAD", () => {
      cbRef.current.onForceReload?.();
    });

    socket.on("SHOW_MODAL", (data: ShowModalPayload) => {
      cbRef.current.onShowModal?.(data);
    });

    socket.on("TICK_OVERRIDE", (data: TickOverridePayload) => {
      cbRef.current.onTickOverride?.(data);
    });

    socket.on("UPDATE_KYC", (data: UpdateKycPayload) => {
      cbRef.current.onUpdateKyc?.(data);
    });

    socket.on("TRADING_TOGGLED", (data: TradingToggledPayload) => {
      cbRef.current.onTradingToggled?.(data);
    });

    socket.on("force-profile-refresh", () => {
      cbRef.current.onForceProfileRefresh?.();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /** Отправить событие на сервер */
  const emit = useCallback(<T = unknown>(event: string, data?: T) => {
    socketRef.current?.emit(event, data);
  }, []);

  /** Разместить бинарный трейд через WebSocket */
  const placeBinary = useCallback((payload: {
    symbol: string;
    direction: "CALL" | "PUT";
    amount: number;
    entryPrice: number;
    expiryMs: number;
  }) => {
    socketRef.current?.emit("PLACE_BINARY", payload);
  }, []);

  /** Залогировать событие */
  const logEvent = useCallback((event: string, meta?: Record<string, unknown>) => {
    socketRef.current?.emit("LOG_EVENT", { event, meta });
  }, []);

  return {
    connected,
    emit,
    placeBinary,
    logEvent,
    socket: socketRef,
  };
}
