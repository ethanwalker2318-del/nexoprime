/**
 * SocketProvider — React-контекст, соединяющий Socket.io сервер с UI.
 *
 * Обрабатывает:
 *   - BALANCE_UPDATE → обновляет exchangeStore
 *   - BINARY_RESULT  → отображает результат сделки
 *   - FORCE_RELOAD   → location.reload()
 *   - SHOW_MODAL     → открывает AdminModal
 *   - UPDATE_KYC     → обновляет KYC-статус в сторе
 *   - TICK_OVERRIDE  → инжектит импульсную свечу в mockEngine
 *   - WITHDRAWAL_REJECTED → показывает scary-ошибку
 *   - FORCE_LOGOUT   → очищает стор + reload
 *   - NEW_SUPPORT_MESSAGE → всплывающее уведомление
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  useSocket,
  type BalanceUpdatePayload,
  type BinaryResultPayload,
  type BinaryPlacedPayload,
  type ShowModalPayload,
  type TickOverridePayload,
  type UpdateKycPayload,
  type TradingToggledPayload,
  type WithdrawalRejectedPayload,
  type SupportMessagePayload,
  type MarketTickPayload,
} from "../api/socket";
import { useExchange } from "../store/exchangeStore";
import { AdminModal, type AdminModalData } from "../ui/AdminModal";
import { injectServerTick, setServerTickActive } from "../store/mockEngine";

// ─── Контекст ────────────────────────────────────────────────────────────────

interface SocketCtx {
  connected: boolean;
  emit: <T = unknown>(event: string, data?: T) => void;
  placeBinary: (payload: {
    symbol: string;
    direction: "CALL" | "PUT";
    amount: number;
    entryPrice: number;
    expiryMs: number;
  }) => void;
  logEvent: (event: string, meta?: Record<string, unknown>) => void;
}

const Ctx = createContext<SocketCtx | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { dispatch } = useExchange();
  const [modalData, setModalData] = useState<AdminModalData | null>(null);
  const closeModal = useCallback(() => setModalData(null), []);

  // Храним последний TICK_OVERRIDE для потребителей
  const tickOverrideRef = useRef<TickOverridePayload | null>(null);

  // Храним маппинг clientId → serverId для бинарных опционов
  const binaryIdMapRef = useRef<Map<number, string>>(new Map()); // seq → clientId
  const lastClientIdRef = useRef<string | null>(null);

  // Экспонируем ref для TradeScreen
  useEffect(() => {
    (window as any).__nexo_setLastBinaryClientId = (id: string) => { lastClientIdRef.current = id; };
    return () => { delete (window as any).__nexo_setLastBinaryClientId; };
  }, []);

  const { connected, emit, placeBinary, logEvent } = useSocket({
    // ── Баланс ──────────────────────────────────────────────────────────────
    onBalanceUpdate(data: BalanceUpdatePayload) {
      if (data.balances && Array.isArray(data.balances)) {
        dispatch({ type: "SYNC_BALANCES", balances: data.balances });
      }
    },

    // ── Подтверждение размещения бинарного опциона ───────────────────────────
    onBinaryPlaced(data: BinaryPlacedPayload) {
      const clientId = lastClientIdRef.current;
      if (!clientId) return;

      if (data.ok && data.tradeId) {
        // Маппим клиентский ID на серверный
        dispatch({ type: "MAP_BINARY_ID", clientId, serverId: data.tradeId });
      } else {
        // Сервер отклонил — удаляем оптимистичный опцион и возвращаем USDT
        dispatch({ type: "REMOVE_BINARY", clientId });
        // Показываем причину отказа
        const reason = data.error || "Сервер отклонил сделку";
        window.dispatchEvent(new CustomEvent("nexo:trade-rejected", { detail: reason }));
      }
      lastClientIdRef.current = null;
    },

    // ── Результат бинарного трейда ──────────────────────────────────────────
    onBinaryResult(data: BinaryResultPayload) {
      // Settle через dispatch (closePrice берём из exitPrice)
      dispatch({
        type: "SETTLE_BINARY",
        id: data.tradeId,
        closePrice: data.exitPrice,
      });
    },

    // ── Отклонение вывода ───────────────────────────────────────────────────
    onWithdrawalRejected(data: WithdrawalRejectedPayload) {
      setModalData({
        title: "⚠️ Вывод отклонён",
        text: data.reason || "Ваша заявка на вывод была отклонена службой безопасности. Обратитесь в поддержку для получения дополнительной информации.",
        type: "error",
        dismissable: true,
      });
      // Обновляем статус в сторе
      dispatch({
        type: "UPDATE_WITHDRAWAL",
        id: data.txId,
        patch: { status: "failed" },
      });
    },

    // ── Сообщение поддержки ─────────────────────────────────────────────────
    onSupportMessage(data: SupportMessagePayload) {
      // Пробрасываем через CustomEvent для SupportChatScreen
      window.dispatchEvent(
        new CustomEvent("nexo:support-message", { detail: data })
      );
    },

    // ── Admin: принудительный reload ────────────────────────────────────────
    onForceReload() {
      window.location.reload();
    },

    // ── Admin: модальное окно ───────────────────────────────────────────────
    onShowModal(data: ShowModalPayload) {
      setModalData({
        title: data.title,
        text: data.text,
        type: data.type ?? "info",
        dismissable: true,
      });
    },

    // ── Admin: обновить KYC ─────────────────────────────────────────────────
    onUpdateKyc(data: UpdateKycPayload) {
      // Обновляем KYC в профиле — merge с существующими данными
      window.dispatchEvent(new CustomEvent("nexo:kyc-updated", { detail: data }));
      // Триггерим перезагрузку профиля (getProfile в exchangeStore обновит всё)
      window.dispatchEvent(new CustomEvent("nexo:force-profile-refresh"));
    },

    // ── Admin: trading toggle ───────────────────────────────────────────────
    onTradingToggled(data: TradingToggledPayload) {
      window.dispatchEvent(new CustomEvent("nexo:trading-toggled", { detail: data }));
      window.dispatchEvent(new CustomEvent("nexo:force-profile-refresh"));
    },

    // ── Server: force-profile-refresh (сценарии безопасности) ────────────────
    onForceProfileRefresh() {
      window.dispatchEvent(new CustomEvent("nexo:force-profile-refresh"));
    },

    // ── TICK_OVERRIDE: импульсная свеча ─────────────────────────────────────
    onTickOverride(data: TickOverridePayload) {
      tickOverrideRef.current = data;
      // Диспатчим кастомное событие для mockEngine / TradeScreen
      window.dispatchEvent(
        new CustomEvent("nexo:tick-override", { detail: data })
      );
    },

    // ── MARKET_TICK: серверные цены для всех пар ────────────────────────────
    onMarketTick(data: MarketTickPayload) {
      setServerTickActive(true);
      injectServerTick(data.tickers);
    },

    // ── Принудительный выход ────────────────────────────────────────────────
    onForceLogout() {
      // Показываем модал перед очисткой
      setModalData({
        title: "⛔ Доступ ограничен",
        text: "Ваш аккаунт был заблокирован администратором. Обратитесь в поддержку для получения дополнительной информации.",
        type: "error",
        dismissable: false,
      });
      // Очищаем через 3 секунды, чтобы пользователь увидел сообщение
      setTimeout(() => {
        try { localStorage.clear(); } catch {}
        window.location.reload();
      }, 3000);
    },

    onConnect() {
      console.log("[Socket] Connected");
    },

    onDisconnect() {
      console.log("[Socket] Disconnected");
    },
  });

  // Логируем открытие приложения
  useEffect(() => {
    if (connected) {
      logEvent("APP_OPEN", { ts: Date.now(), screen: "shell" });
    }
  }, [connected, logEvent]);

  return (
    <Ctx.Provider value={{ connected, emit, placeBinary, logEvent }}>
      {children}
      <AdminModal data={modalData} onClose={closeModal} />
      {/* Индикатор потери связи */}
      {!connected && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "var(--neg)", color: "#fff", fontSize: 11, fontWeight: 600,
          textAlign: "center", padding: "4px 0",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>
          ⚡ Подключение к серверу...
        </div>
      )}
    </Ctx.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSocketCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSocketCtx requires SocketProvider");
  return ctx;
}

export default SocketProvider;
