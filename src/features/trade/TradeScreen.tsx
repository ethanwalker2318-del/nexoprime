import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { genOrderBook } from "../../shared/store/mockEngine";
import type { OrderBook, OrderBookLevel } from "../../shared/store/mockEngine";
import type { OrderSide, OrderType } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT"];

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  if (n >= 1)     return n.toFixed(2);
  return n.toPrecision(4);
}

function fmtSize(n: number): string {
  if (n >= 1000) return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  if (n >= 1)    return n.toFixed(3);
  return n.toPrecision(3);
}

export function TradeScreen() {
  const { state, placeOrder } = useExchange();
  const [pair, setPair] = useState("BTC/USDT");
  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [qty, setQty] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [orderBook, setOrderBook] = useState<OrderBook>(() => genOrderBook(pair));
  const [showPairPicker, setShowPairPicker] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState<null | { preview: string; fee: string; total: string }>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const tk = state.tickers[pair];
  const [base = "", quote = "USDT"] = pair.split("/");
  const baseAsset = state.assets[base];
  const quoteAsset = state.assets[quote];

  // Обновляем стакан раз в ~1.5s
  useEffect(() => {
    const iv = setInterval(() => setOrderBook(genOrderBook(pair)), 1500);
    return () => clearInterval(iv);
  }, [pair]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  const execPrice = orderType === "market"
    ? (side === "buy" ? (tk?.ask ?? 0) : (tk?.bid ?? 0))
    : parseFloat(limitPrice || "0");

  const feeRate = orderType === "market" ? 0.001 : 0.0006;
  const estFee = parseFloat(qty || "0") * execPrice * feeRate;
  const estTotal = parseFloat(qty || "0") * execPrice;

  function handlePreview() {
    if (!qty || parseFloat(qty) <= 0) { showToast("Укажите количество", false); return; }
    if (orderType === "limit" && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      showToast("Укажите цену", false); return;
    }
    setConfirmSheet({
      preview: `${side === "buy" ? "Купить" : "Продать"} ${qty} ${base}`,
      fee: `≈$${estFee.toFixed(4)} (${(feeRate * 100).toFixed(2)}%)`,
      total: `≈$${estTotal.toFixed(2)}`,
    });
  }

  function handleConfirm() {
    setConfirmSheet(null);
    const result = placeOrder(pair, side, orderType, parseFloat(qty), parseFloat(limitPrice) || undefined);
    if (result.ok) {
      showToast(`Ордер размещён`, true);
      setQty("");
    } else {
      showToast(result.error ?? "Ошибка", false);
    }
  }

  const pctOfBalance = useCallback((pct: number) => {
    if (side === "buy" && quoteAsset && execPrice > 0) {
      const maxQty = (quoteAsset.available * pct) / execPrice;
      setQty(maxQty.toPrecision(4));
    } else if (side === "sell" && baseAsset) {
      setQty((baseAsset.available * pct).toPrecision(4));
    }
  }, [side, quoteAsset, baseAsset, execPrice]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* Header — Выбор пары */}
      <div style={{
        padding: "12px 16px 0",
        background: "var(--bg-0)",
        borderBottom: "1px solid var(--line-1)",
      }}>
        <button
          onClick={() => setShowPairPicker(true)}
          style={{
            background: "var(--surface-1)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r-md)", padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", marginBottom: 10,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-1)" }}>{pair}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Статистика пары */}
        {tk && (
          <div style={{ display: "flex", gap: 18, paddingBottom: 12, overflowX: "auto" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                {fmtPrice(tk.price)}
              </div>
              <div style={{
                fontSize: 12,color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)",
              }}>
                {tk.change24h >= 0 ? "+" : ""}{tk.change24h.toFixed(2)}%
              </div>
            </div>
            {[
              { label: "24ч Макс", val: fmtPrice(tk.high24h) },
              { label: "24ч Мин",  val: fmtPrice(tk.low24h) },
              { label: "Спред",    val: fmtPrice(tk.ask - tk.bid) },
            ].map((s) => (
              <div key={s.label} style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Тело */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 calc(var(--nav-height) + var(--safe-bottom) + 8px)" }}>
        <div style={{ display: "flex", gap: 0 }}>

          {/* Стакан */}
          <div style={{ flex: "0 0 44%", borderRight: "1px solid var(--line-1)" }}>
            <div style={{
              padding: "8px 10px", fontSize: 10, color: "var(--text-4)",
              display: "flex", justifyContent: "space-between",
              borderBottom: "1px solid var(--line-1)",
            }}>
              <span>Цена</span>
              <span>Объём</span>
            </div>

            {/* Asks (продажа — сверху, красные) */}
            <div style={{ display: "flex", flexDirection: "column-reverse" }}>
              {orderBook.asks.slice(0, 8).map((level, i) => (
                <BookRow key={i} level={level} side="ask" maxTotal={orderBook.asks.slice(0, 8).slice(-1)[0]?.total ?? 1} />
              ))}
            </div>

            {/* Spread */}
            {tk && (
              <div style={{
                padding: "5px 10px", textAlign: "center",
                background: "var(--surface-2)",
                fontSize: 12, fontWeight: 600, color: "var(--text-1)",
                borderTop: "1px solid var(--line-1)", borderBottom: "1px solid var(--line-1)",
              }}>
                {fmtPrice(tk.price)}
              </div>
            )}

            {/* Bids (покупка — снизу, зелёные) */}
            <div>
              {orderBook.bids.slice(0, 8).map((level, i) => (
                <BookRow key={i} level={level} side="bid" maxTotal={orderBook.bids.slice(0, 8).slice(-1)[0]?.total ?? 1} />
              ))}
            </div>
          </div>

          {/* Ордер-тикет */}
          <div style={{ flex: 1, padding: "12px" }}>

            {/* Buy/Sell */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              background: "var(--surface-1)", borderRadius: "var(--r-md)",
              padding: 3, marginBottom: 12, gap: 3,
            }}>
              {(["buy", "sell"] as OrderSide[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  style={{
                    padding: "9px 0", border: "none", borderRadius: 10,
                    background: side === s
                      ? (s === "buy" ? "var(--pos)" : "var(--neg)")
                      : "transparent",
                    color: side === s ? "#fff" : "var(--text-3)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    transition: "all var(--dur-fast)",
                  }}
                >
                  {s === "buy" ? "Купить" : "Продать"}
                </button>
              ))}
            </div>

            {/* Market/Limit */}
            <div style={{
              display: "flex", marginBottom: 12, gap: 4,
            }}>
              {(["market", "limit"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  style={{
                    flex: 1, padding: "6px 0",
                    background: orderType === t ? "var(--accent-dim)" : "transparent",
                    borderRadius: 8,
                    border: orderType === t ? "1px solid var(--accent-border)" : "1px solid transparent",
                    color: orderType === t ? "var(--accent)" : "var(--text-3)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    transition: "all var(--dur-fast)",
                  }}
                >
                  {t === "market" ? "По рынку" : "Лимитный"}
                </button>
              ))}
            </div>

            {/* Лимитная цена */}
            {orderType === "limit" && (
              <label style={{ display: "block", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 4 }}>Цена ({quote})</div>
                <input
                  type="number"
                  placeholder={tk ? fmtPrice(tk.price) : "0"}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  style={inputStyle}
                />
              </label>
            )}

            {/* Количество */}
            <label style={{ display: "block", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 4 }}>Количество ({base})</div>
              <input
                type="number"
                placeholder="0.00"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={inputStyle}
              />
            </label>

            {/* % кнопки */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {[0.25, 0.50, 0.75, 1].map((pct) => (
                <button
                  key={pct}
                  onClick={() => pctOfBalance(pct)}
                  style={{
                    flex: 1, padding: "4px 0",
                    background: "var(--surface-2)", border: "1px solid var(--line-1)",
                    borderRadius: 6, color: "var(--text-3)", fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  {(pct * 100).toFixed(0)}%
                </button>
              ))}
            </div>

            {/* Доступный баланс */}
            <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 10 }}>
              Доступно:{" "}
              <span style={{ color: "var(--text-2)" }}>
                {side === "buy"
                  ? `${(quoteAsset?.available ?? 0).toFixed(2)} ${quote}`
                  : `${(baseAsset?.available ?? 0).toPrecision(4)} ${base}`}
              </span>
            </div>

            {/* Превью */}
            {qty && parseFloat(qty) > 0 && (
              <div style={{
                background: "var(--surface-2)", borderRadius: "var(--r-sm)",
                padding: "8px 10px", marginBottom: 10, fontSize: 11,
                border: "1px solid var(--line-1)",
              }}>
                <Row label="Сумма" val={`≈$${estTotal.toFixed(2)}`} />
                <Row label="Комиссия" val={`≈$${estFee.toFixed(4)}`} />
                <Row label="Тарифы" val="Maker 0.06% · Taker 0.10%" dim />
              </div>
            )}

            {/* Кнопка */}
            <button
              onClick={handlePreview}
              style={{
                width: "100%", padding: "12px",
                background: side === "buy" ? "var(--pos)" : "var(--neg)",
                border: "none", borderRadius: "var(--r-md)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {side === "buy" ? `Купить ${base}` : `Продать ${base}`}
            </button>
          </div>
        </div>
      </div>

      {/* Pair Picker */}
      <AnimatePresence>
        {showPairPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(7,10,15,0.8)",
              backdropFilter: "blur(6px)",
              zIndex: 50, display: "flex", alignItems: "flex-end",
            }}
            onClick={() => setShowPairPicker(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", background: "var(--surface-1)",
                borderRadius: "var(--r-lg) var(--r-lg) 0 0",
                padding: "16px 16px calc(16px + var(--safe-bottom))",
                boxShadow: "var(--shadow-sheet)",
              }}
            >
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
                Выбор пары
              </h3>
              {PAIRS.map((p) => {
                const t = state.tickers[p];
                const isActive = p === pair;
                return (
                  <button
                    key={p}
                    onClick={() => { setPair(p); setShowPairPicker(false); }}
                    style={{
                      width: "100%", display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "11px 12px",
                      background: isActive ? "var(--accent-dim)" : "transparent",
                      border: isActive ? "1px solid var(--accent-border)" : "1px solid transparent",
                      borderRadius: "var(--r-sm)", marginBottom: 4,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: isActive ? 600 : 400, fontSize: 14, color: "var(--text-1)" }}>{p}</span>
                    {t && (
                      <span style={{ fontSize: 12, color: t.change24h >= 0 ? "var(--pos)" : "var(--neg)" }}>
                        {fmtPrice(t.price)}{" "}
                        {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Sheet */}
      <AnimatePresence>
        {confirmSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(7,10,15,0.8)", backdropFilter: "blur(6px)",
              zIndex: 60, display: "flex", alignItems: "flex-end",
            }}
            onClick={() => setConfirmSheet(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", background: "var(--surface-2)",
                borderRadius: "var(--r-lg) var(--r-lg) 0 0",
                padding: "20px 20px calc(20px + var(--safe-bottom))",
                boxShadow: "var(--shadow-sheet)",
              }}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
                Подтвердить ордер
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                <ConfirmRow label="Действие" val={confirmSheet.preview} accent />
                <ConfirmRow label="Тип ордера" val={orderType === "market" ? "По рынку" : "Лимитный"} />
                <ConfirmRow label="Пара" val={pair} />
                {orderType === "limit" && <ConfirmRow label="Цена" val={`${limitPrice} ${quote}`} />}
                <ConfirmRow label="Комиссия" val={confirmSheet.fee} />
                <ConfirmRow label="Итого" val={confirmSheet.total} bold />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setConfirmSheet(null)}
                  style={{
                    flex: 1, padding: "12px", background: "var(--surface-3)",
                    border: "none", borderRadius: "var(--r-md)", color: "var(--text-2)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    flex: 2, padding: "12px",
                    background: side === "buy" ? "var(--pos)" : "var(--neg)",
                    border: "none", borderRadius: "var(--r-md)",
                    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Подтвердить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "absolute", bottom: "calc(var(--nav-height) + var(--safe-bottom) + 12px)",
              left: "50%", transform: "translateX(-50%)",
              background: toast.ok ? "var(--pos)" : "var(--neg)",
              color: "#fff", padding: "10px 20px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              whiteSpace: "nowrap", zIndex: 70,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Вспомогатели ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 10px",
  background: "var(--surface-2)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", color: "var(--text-1)",
  fontSize: 14, outline: "none",
};

function Row({ label, val, dim }: { label: string; val: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-4)" }}>{label}</span>
      <span style={{ color: dim ? "var(--text-4)" : "var(--text-2)" }}>{val}</span>
    </div>
  );
}

function ConfirmRow({ label, val, accent, bold }: { label: string; val: string; accent?: boolean; bold?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "8px 0", borderBottom: "1px solid var(--line-1)", fontSize: 13,
    }}>
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span style={{ color: accent ? "var(--accent)" : "var(--text-1)", fontWeight: bold || accent ? 600 : 400 }}>
        {val}
      </span>
    </div>
  );
}

function BookRow({ level, side, maxTotal }: { level: OrderBookLevel; side: "bid" | "ask"; maxTotal: number }) {
  const pct = (level.total / maxTotal) * 100;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "3px 10px", position: "relative", overflow: "hidden",
      fontSize: 11,
    }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0,
        right: 0, width: `${pct}%`,
        background: side === "ask" ? "var(--neg-dim)" : "var(--pos-dim)",
        pointerEvents: "none",
      }} />
      <span style={{ color: side === "ask" ? "var(--neg)" : "var(--pos)", fontWeight: 500, position: "relative" }}>
        {fmtPrice(level.price)}
      </span>
      <span style={{ color: "var(--text-3)", position: "relative" }}>
        {fmtSize(level.size)}
      </span>
    </div>
  );
}
