import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";
import type { Order } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function fmt(n: number, digits = 2) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return n.toLocaleString("ru-RU", { maximumFractionDigits: digits });
  return n.toFixed(digits);
}

function fmtPrice(n: number) {
  if (n >= 10000) return fmt(n, 0);
  if (n >= 1)     return fmt(n, 2);
  return n.toPrecision(4);
}

function Sparkline({ values, pos }: { values: number[]; pos: boolean }) {
  const h = 28, w = 72;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.85 - h * 0.075;
    return `${x},${y}`;
  }).join(" ");
  const color = pos ? "var(--pos)" : "var(--neg)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ display: "block" }}>
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Создан", queued: "В очереди", partial: "Частично",
  filled: "Исполнен", cancelled: "Отменён", rejected: "Отклонён",
};
const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: "var(--text-3)", queued: "var(--accent)", partial: "var(--warn)",
  filled: "var(--pos)", cancelled: "var(--text-4)", rejected: "var(--neg)",
};

export function HomeScreen() {
  const { state, totalUSDT, cancelOrder } = useExchange();
  const { navigate } = useRouter();

  const [totalBalance, setTotalBalance] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setTotalBalance(totalUSDT());
  }, [state.tickers, state.assets, totalUSDT]);

  const assets = Object.values(state.assets).filter((a) => {
    const total = a.available + a.locked;
    const tk = state.tickers[`${a.symbol}/USDT`];
    const usdtVal = a.symbol === "USDT" ? total : total * (tk?.price ?? 0);
    return usdtVal > 0.01;
  });

  const openOrders = state.orders.filter((o) => o.status === "queued" || o.status === "partial");
  const recentOrders = state.orders.slice(0, 5);

  return (
    <div style={{ padding: "16px 16px calc(var(--nav-height) + var(--safe-bottom) + 16px)" }}>

      {/* Баланс */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{
          background: "linear-gradient(145deg, var(--surface-2) 0%, #0E1E3A 100%)",
          borderRadius: "var(--r-xl)",
          padding: "20px 20px 18px",
          marginBottom: 16,
          border: "1px solid var(--line-1)",
          boxShadow: "var(--shadow-card), 0 0 40px rgba(77,163,255,0.06)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Декоративный блик */}
        <div style={{
          position: "absolute", top: -30, right: -30, width: 120, height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(77,163,255,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4, letterSpacing: 0.5 }}>
              ОБЩИЙ БАЛАНС
            </div>
            <div
              style={{
                fontSize: hidden ? 18 : 28, fontWeight: 700,
                color: "var(--text-1)", letterSpacing: -0.5,
                cursor: "pointer", userSelect: "none",
                transition: "font-size var(--dur-fast)",
              }}
              onClick={() => setHidden((h) => !h)}
            >
              {hidden ? "•••••••" : `$${fmt(totalBalance, 2)}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate("wallet")}
              style={{
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                borderRadius: "var(--r-sm)", color: "var(--accent)",
                padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Пополнить
            </button>
            <button
              onClick={() => navigate("wallet")}
              style={{
                background: "var(--surface-3)", border: "1px solid var(--line-2)",
                borderRadius: "var(--r-sm)", color: "var(--text-2)",
                padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Вывести
            </button>
          </div>
        </div>

        {/* P&L плашка */}
        <div style={{
          marginTop: 14, display: "flex", gap: 16,
        }}>
          {openOrders.length > 0 && (
            <div style={{
              fontSize: 12, color: "var(--text-3)",
              background: "var(--surface-2)", borderRadius: 8,
              padding: "4px 10px",
            }}>
              {openOrders.length} ордер{openOrders.length === 1 ? "" : openOrders.length < 5 ? "а" : "ов"} в работе
            </div>
          )}
        </div>
      </motion.div>

      {/* Быстрые действия */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20,
      }}>
        {[
          { label: "Торговля", icon: "📈", screen: "trade" as const },
          { label: "Рынки",    icon: "🌐", screen: "markets" as const },
          { label: "Пополнить",icon: "⬇️", screen: "wallet" as const },
          { label: "Вывести",  icon: "⬆️", screen: "wallet" as const },
        ].map((a, i) => (
          <motion.button
            key={a.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.05 * i, ease: EASE }}
            onClick={() => navigate(a.screen)}
            style={{
              background: "var(--surface-1)", border: "1px solid var(--line-1)",
              borderRadius: "var(--r-md)", padding: "12px 6px",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 6, cursor: "pointer",
              transition: "background var(--dur-fast)",
            }}
          >
            <span style={{ fontSize: 20 }}>{a.icon}</span>
            <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 500 }}>{a.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Мои активы */}
      <SectionHeader title="Мои активы" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
        {assets.length === 0 ? (
          <EmptyState text="Нет активов" />
        ) : assets.map((asset, i) => {
          const tk = state.tickers[`${asset.symbol}/USDT`];
          const total = asset.available + asset.locked;
          const usdtVal = asset.symbol === "USDT" ? total : total * (tk?.price ?? 0);
          const pos = (tk?.change24h ?? 0) >= 0;

          return (
            <motion.div
              key={asset.symbol}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * i, ease: EASE }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                background: "var(--surface-1)", borderRadius: "var(--r-md)",
                border: "1px solid var(--line-1)",
                cursor: asset.symbol !== "USDT" ? "pointer" : "default",
              }}
              onClick={() => asset.symbol !== "USDT" && navigate("trade")}
            >
              {/* Иконка */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "var(--accent)",
                flexShrink: 0,
              }}>
                {asset.symbol.slice(0, 2)}
              </div>

              {/* Название + цена */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
                  {asset.symbol}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {tk ? fmtPrice(tk.price) : "—"}{" "}
                  <span style={{ color: pos ? "var(--pos)" : "var(--neg)" }}>
                    {tk ? (pos ? "+" : "") + tk.change24h.toFixed(2) + "%" : ""}
                  </span>
                </div>
              </div>

              {/* Мини-график */}
              {tk && <Sparkline values={tk.history.slice(-20)} pos={pos} />}

              {/* Баланс */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
                  {total.toPrecision(4)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  ${fmt(usdtVal, 2)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Недавние ордера */}
      {recentOrders.length > 0 && (
        <>
          <SectionHeader title="Последние ордера" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentOrders.map((order) => (
              <OrderRow key={order.id} order={order} onCancel={cancelOrder} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 600, color: "var(--text-2)",
      marginBottom: 8, letterSpacing: 0.2,
    }}>
      {title}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: "20px", textAlign: "center",
      color: "var(--text-4)", fontSize: 13,
      background: "var(--surface-1)", borderRadius: "var(--r-md)",
      border: "1px solid var(--line-1)",
    }}>
      {text}
    </div>
  );
}

function OrderRow({ order, onCancel }: { order: Order; onCancel: (id: string) => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px",
      background: "var(--surface-1)", borderRadius: "var(--r-md)",
      border: "1px solid var(--line-1)", gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
          <span style={{ color: order.side === "buy" ? "var(--pos)" : "var(--neg)" }}>
            {order.side === "buy" ? "Купить" : "Продать"}
          </span>
          {" "}{order.symbol}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          {order.qty.toPrecision(4)} @ {fmtPrice(order.price)}
          {" · "}{order.type === "market" ? "Рынок" : "Лимит"}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: ORDER_STATUS_COLOR[order.status],
        }}>
          {ORDER_STATUS_LABEL[order.status]}
        </div>
        {order.filledQty > 0 && (
          <div style={{ fontSize: 10, color: "var(--text-4)" }}>
            {((order.filledQty / order.qty) * 100).toFixed(0)}%
          </div>
        )}
      </div>
      {order.status === "queued" && (
        <button
          onClick={() => onCancel(order.id)}
          style={{
            background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
            borderRadius: 8, color: "var(--neg)", padding: "3px 10px",
            fontSize: 11, cursor: "pointer", flexShrink: 0,
          }}
        >
          Отмена
        </button>
      )}
    </div>
  );
}


