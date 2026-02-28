/**
 * FakeTradeFeed — плавающие уведомления о «сделках других пользователей».
 *
 * Каждые 4-7 сек показывает toast: «Пользователь user_*** заработал +84.20 USDT».
 * Framer Motion slide-in / fade-out.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Генерация случайных данных ──────────────────────────────────────────────

const SYMBOLS   = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "DOGE/USDT", "AVAX/USDT"];
const NAMES     = ["Alex", "Maria", "Dmitri", "Elena", "Sergey", "Anna", "Ivan", "Olga", "Nikita", "Svetlana"];
const TYPES: ("CALL" | "PUT")[] = ["CALL", "PUT"];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return +(Math.random() * (max - min) + min).toFixed(decimals);
}

function maskName(name: string): string {
  return name.slice(0, 2) + "***" + name.slice(-1);
}

interface FakeTrade {
  id: string;
  user: string;
  symbol: string;
  type: "CALL" | "PUT";
  amount: number;
  pnl: number;
  ts: number;
}

function generateFakeTrade(): FakeTrade {
  const pnl = randomFloat(5, 320);
  return {
    id:     "ft_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    user:   maskName(randomItem(NAMES)),
    symbol: randomItem(SYMBOLS),
    type:   randomItem(TYPES),
    amount: randomFloat(10, 500),
    pnl,
    ts:     Date.now(),
  };
}

// ─── Компонент ───────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

export function FakeTradeFeed() {
  const [items, setItems] = useState<FakeTrade[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const scheduleNext = useCallback(() => {
    const delay = 15000 + Math.random() * 15000; // 15-30 sec
    timerRef.current = setTimeout(() => {
      const trade = generateFakeTrade();
      setItems(prev => [trade, ...prev].slice(0, MAX_VISIBLE));

      // Убираем через 3.5 сек
      setTimeout(() => {
        setItems(prev => prev.filter(t => t.id !== trade.id));
      }, 3500);

      scheduleNext();
    }, delay);
  }, []);

  useEffect(() => {
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scheduleNext]);

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(var(--safe-top, 0px) + 8px)",
        left: 12,
        right: 12,
        zIndex: 1000,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <AnimatePresence>
        {items.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "rgba(16,185,129,0.12)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 12,
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-1, #e5e7eb)",
            }}
          >
            <span style={{ fontSize: 16 }}>🟢</span>
            <span style={{ flex: 1 }}>
              <strong>{t.user}</strong>{" "}
              {t.type === "CALL" ? "↑" : "↓"} {t.symbol}{" "}
              <span style={{ color: "#10b981", fontWeight: 600 }}>
                +{t.pnl.toFixed(2)} USDT
              </span>
            </span>
            <span style={{ fontSize: 11, opacity: 0.5 }}>just now</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default FakeTradeFeed;
