import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { genOrderBook } from "../../shared/store/mockEngine";
import type { OrderBook, OrderBookLevel } from "../../shared/store/mockEngine";
import type { OrderSide, OrderType, Order } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PAIRS = ["BTC/USDT","ETH/USDT","SOL/USDT","BNB/USDT","XRP/USDT","ADA/USDT","DOGE/USDT","AVAX/USDT","LINK/USDT"];
type PanelTab = "chart" | "book" | "orders";
const TF_LABELS = ["1м","5м","15м","1ч","4ч","1д"];

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
function fmtPnl(n: number): string {
  return `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;
}

// ─── SVG Live Chart ───────────────────────────────────────────────────────────
function LiveChart({ history, currentPrice, change }: {
  history: number[];
  currentPrice: number;
  change: number;
}) {
  const W = 360, H = 148;
  const pts = history.length < 2 ? [currentPrice, currentPrice] : history;
  const min = Math.min(...pts) * 0.9995;
  const max = Math.max(...pts) * 1.0005;
  const range = max - min || 1;
  const toX = (i: number) => (i / (pts.length - 1)) * W;
  const toY = (v: number) => H - ((v - min) / range) * H;
  const pathD = pts.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;
  const isPos = change >= 0;
  const color = isPos ? "var(--pos)" : "var(--neg)";
  const lastX = toX(pts.length - 1);
  const lastPt = pts[pts.length - 1] ?? currentPrice;
  const lastY = toY(lastPt);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="cg-pos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#31D0AA" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#31D0AA" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cg-neg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5B6E" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF5B6E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={0} y1={H * f} x2={W} y2={H * f}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <path d={areaD} fill={`url(#${isPos ? "cg-pos" : "cg-neg"})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        <line x1={0} y1={lastY} x2={W} y2={lastY}
          stroke={color} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.55" />
        <circle cx={lastX} cy={lastY} r="3.5" fill={color} />
      </svg>
      {/* Метки */}
      <div style={{ position: "absolute", top: 4, left: 8, fontSize: 9, color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>
        {fmtPrice(max)}
      </div>
      <div style={{ position: "absolute", bottom: 4, left: 8, fontSize: 9, color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>
        {fmtPrice(min)}
      </div>
      <div style={{
        position: "absolute", top: Math.max(2, Math.min(H - 18, lastY - 9)), right: 4,
        fontSize: 10, fontWeight: 700, color, whiteSpace: "nowrap",
        background: isPos ? "rgba(49,208,170,0.15)" : "rgba(255,91,110,0.15)",
        border: `1px solid ${isPos ? "rgba(49,208,170,0.4)" : "rgba(255,91,110,0.4)"}`,
        borderRadius: 4, padding: "1px 5px", fontVariantNumeric: "tabular-nums",
      }}>
        {fmtPrice(currentPrice)}
      </div>
    </div>
  );
}

// ─── Строка стакана ───────────────────────────────────────────────────────────
function BookRow({ level, side, maxTotal }: { level: OrderBookLevel; side: "bid"|"ask"; maxTotal: number }) {
  const pct = (level.total / maxTotal) * 100;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 10px",
      position: "relative", overflow: "hidden", fontSize: 11 }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0, right: 0, width: `${pct}%`,
        background: side === "ask" ? "var(--neg-dim)" : "var(--pos-dim)", pointerEvents: "none",
      }} />
      <span style={{ color: side === "ask" ? "var(--neg)" : "var(--pos)", fontWeight: 500, position: "relative", fontVariantNumeric: "tabular-nums" }}>
        {fmtPrice(level.price)}
      </span>
      <span style={{ color: "var(--text-3)", position: "relative" }}>{fmtSize(level.size)}</span>
    </div>
  );
}

// ─── Карточка ордера ──────────────────────────────────────────────────────────
function OrderRow({ order, currentPrice, onCancel }: {
  order: Order; currentPrice: number; onCancel?: () => void;
}) {
  const isOpen   = ["pending","queued","partial"].includes(order.status);
  const isFilled = order.status === "filled";
  let pnl = 0, pnlPct = 0;
  if (isFilled && order.filledQty > 0 && order.price > 0) {
    pnl    = order.side === "buy"
      ? (currentPrice - order.price) * order.filledQty
      : (order.price - currentPrice) * order.filledQty;
    pnlPct = (pnl / (order.price * order.filledQty)) * 100;
  }
  const statusColor: Record<string, string> = {
    pending:"var(--warn)", queued:"var(--warn)", partial:"var(--accent)",
    filled:"var(--pos)", cancelled:"var(--text-4)", rejected:"var(--neg)",
  };
  const statusLabel: Record<string, string> = {
    pending:"Ожидание", queued:"В очереди", partial:"Частично",
    filled:"Исполнен", cancelled:"Отменён", rejected:"Отклонён",
  };
  const base = order.symbol.split("/")[0] ?? "";
  const fillPct = order.qty > 0 ? (order.filledQty / order.qty) * 100 : 0;

  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--line-1)",
      borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
            background: order.side === "buy" ? "var(--pos-dim)" : "var(--neg-dim)",
            color: order.side === "buy" ? "var(--pos)" : "var(--neg)",
            border: `1px solid ${order.side === "buy" ? "var(--pos-border)" : "var(--neg-border)"}`,
          }}>
            {order.side === "buy" ? "Покупка" : "Продажа"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{order.symbol}</span>
          <span style={{ fontSize: 10, color: "var(--text-4)" }}>
            {order.type === "market" ? "Рынок" : "Лимит"}
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: statusColor[order.status] ?? "var(--text-4)" }}>
          {statusLabel[order.status] ?? order.status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 8px" }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Цена входа</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
            {fmtPrice(order.price)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Кол-во</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>
            {fmtSize(order.qty)} {base}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>
            {isFilled ? "P&L" : "Тек. цена"}
          </div>
          {isFilled ? (
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: pnl >= 0 ? "var(--pos)" : "var(--neg)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {fmtPnl(pnl)}
              <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.75 }}>
                ({pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              {fmtPrice(currentPrice)}
            </div>
          )}
        </div>
      </div>

      {/* Прогресс-бар */}
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 3, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${fillPct}%`,
            background: order.side === "buy" ? "var(--pos)" : "var(--neg)",
            borderRadius: 2, transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 9, color: "var(--text-4)" }}>
            Исполнено {fmtSize(order.filledQty)} / {fmtSize(order.qty)} {base}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-4)" }}>
            Fee ${order.fee.toFixed(4)}
          </span>
        </div>
      </div>

      {isOpen && onCancel && (
        <button onClick={onCancel} style={{
          marginTop: 8, width: "100%", padding: "6px",
          background: "transparent", border: "1px solid var(--neg-border)",
          borderRadius: "var(--r-sm)", color: "var(--neg)",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}>
          Отменить ордер
        </button>
      )}
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────
export function TradeScreen() {
  const { state, placeOrder, cancelOrder } = useExchange();
  const [pair, setPair]             = useState("BTC/USDT");
  const [side, setSide]             = useState<OrderSide>("buy");
  const [orderType, setOrderType]   = useState<OrderType>("market");
  const [qty, setQty]               = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [panelTab, setPanelTab]     = useState<PanelTab>("chart");
  const [tfLabel, setTfLabel]       = useState("15м");
  const [orderBook, setOrderBook]   = useState<OrderBook>(() => genOrderBook(pair));
  const [showPicker, setShowPicker] = useState(false);
  const [confirmSheet, setConfirm]  = useState<null|{preview:string;fee:string;total:string}>(null);
  const [toast, setToast]           = useState<{msg:string;ok:boolean}|null>(null);
  const [ordersTab, setOrdersTab]   = useState<"open"|"history">("open");

  const tk             = state.tickers[pair];
  const [base="", quote="USDT"] = pair.split("/");
  const baseAsset      = state.assets[base];
  const quoteAsset     = state.assets[quote];

  useEffect(() => {
    const iv = setInterval(() => setOrderBook(genOrderBook(pair)), 1400);
    return () => clearInterval(iv);
  }, [pair]);

  useEffect(() => { setLimitPrice(""); setQty(""); }, [pair]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  const execPrice = orderType === "market"
    ? (side === "buy" ? (tk?.ask ?? 0) : (tk?.bid ?? 0))
    : parseFloat(limitPrice || "0");
  const feeRate  = orderType === "market" ? 0.001 : 0.0006;
  const estFee   = parseFloat(qty || "0") * execPrice * feeRate;
  const estTotal = parseFloat(qty || "0") * execPrice;

  function handlePreview() {
    if (!qty || parseFloat(qty) <= 0) { showToast("Укажите количество", false); return; }
    if (orderType === "limit" && parseFloat(limitPrice || "0") <= 0) {
      showToast("Укажите цену", false); return;
    }
    setConfirm({
      preview: `${side === "buy" ? "Купить" : "Продать"} ${qty} ${base}`,
      fee:   `≈$${estFee.toFixed(4)} (${(feeRate*100).toFixed(2)}%)`,
      total: `≈$${estTotal.toFixed(2)}`,
    });
  }

  function handleConfirm() {
    setConfirm(null);
    const r = placeOrder(pair, side, orderType, parseFloat(qty), parseFloat(limitPrice) || undefined);
    if (r.ok) {
      showToast("Ордер размещён", true);
      setQty("");
      setPanelTab("orders");
      setOrdersTab("open");
    } else {
      showToast(r.error ?? "Ошибка", false);
    }
  }

  const pctOfBalance = useCallback((pct: number) => {
    if (side === "buy" && quoteAsset && execPrice > 0) {
      setQty(((quoteAsset.available * pct) / execPrice).toPrecision(4));
    } else if (side === "sell" && baseAsset) {
      setQty((baseAsset.available * pct).toPrecision(4));
    }
  }, [side, quoteAsset, baseAsset, execPrice]);

  const pairOrders   = useMemo(() => state.orders.filter(o => o.symbol === pair), [state.orders, pair]);
  const openOrders   = pairOrders.filter(o => ["pending","queued","partial"].includes(o.status));
  const historyOrders = pairOrders.filter(o => ["filled","cancelled","rejected"].includes(o.status));
  const totalPnl     = useMemo(() => {
    const p = tk?.price ?? 0;
    return historyOrders.filter(o => o.status === "filled").reduce((acc, o) => {
      return acc + (o.side === "buy" ? (p - o.price) : (o.price - p)) * o.filledQty;
    }, 0);
  }, [historyOrders, tk]);

  const PANEL_TABS: {key: PanelTab; label: string}[] = [
    { key: "chart",  label: "График" },
    { key: "book",   label: "Стакан" },
    { key: "orders", label: `Ордера${pairOrders.length ? ` (${pairOrders.length})` : ""}` },
  ];

  // ── Стили ──
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "9px 0", background: "transparent", border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--accent)" : "var(--text-3)",
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer",
    transition: "color var(--dur-fast), border-color var(--dur-fast)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* ── Шапка: пара + цена + статы ── */}
      <div style={{ padding: "10px 14px 0", background: "var(--bg-0)", borderBottom: "1px solid var(--line-1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={() => setShowPicker(true)} style={{
            background: "var(--surface-1)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r-md)", padding: "6px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)" }}>{pair}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {tk && (
            <>
              <div style={{
                fontSize: 18, fontWeight: 700,
                color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)",
                fontVariantNumeric: "tabular-nums",
              }}>
                {fmtPrice(tk.price)}
              </div>
              <div style={{
                marginLeft: "auto", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: tk.change24h >= 0 ? "var(--pos-dim)" : "var(--neg-dim)",
                border: `1px solid ${tk.change24h >= 0 ? "var(--pos-border)" : "var(--neg-border)"}`,
                color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)",
              }}>
                {tk.change24h >= 0 ? "▲" : "▼"} {Math.abs(tk.change24h).toFixed(2)}%
              </div>
            </>
          )}
        </div>
        {tk && (
          <div style={{ display: "flex", gap: 16, paddingBottom: 10, overflowX: "auto" }}>
            {[
              { label: "24ч Макс", val: fmtPrice(tk.high24h), c: "var(--pos)" },
              { label: "24ч Мин",  val: fmtPrice(tk.low24h),  c: "var(--neg)" },
              { label: "Спред",    val: fmtPrice(tk.ask - tk.bid) },
              { label: "Объём",    val: `$${(tk.vol24h/1e6).toFixed(0)}M` },
            ].map(s => (
              <div key={s.label} style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: s.c ?? "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                  {s.val}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Скроллируемое тело ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* Табы */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--line-1)", background: "var(--bg-0)", position: "sticky", top: 0, zIndex: 10 }}>
          {PANEL_TABS.map(t => (
            <button key={t.key} onClick={() => setPanelTab(t.key)} style={tabBtnStyle(panelTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ГРАФИК ── */}
        {panelTab === "chart" && (
          <div>
            {/* TF выбор */}
            <div style={{ display: "flex", gap: 2, padding: "8px 12px 4px", borderBottom: "1px solid var(--line-1)" }}>
              {TF_LABELS.map(tf => (
                <button key={tf} onClick={() => setTfLabel(tf)} style={{
                  padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: "pointer",
                  background: tfLabel === tf ? "var(--accent-dim)" : "transparent",
                  border: tfLabel === tf ? "1px solid var(--accent-border)" : "1px solid transparent",
                  color: tfLabel === tf ? "var(--accent)" : "var(--text-4)",
                }}>
                  {tf}
                </button>
              ))}
            </div>

            {/* Чарт */}
            <div style={{ background: "var(--bg-0)", paddingTop: 6 }}>
              {tk
                ? <LiveChart history={tk.history} currentPrice={tk.price} change={tk.change24h} />
                : <div style={{ height: 148, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-4)" }}>Загрузка...</span>
                  </div>
              }
            </div>

            {/* Bid / Ask / Open / Close */}
            {tk && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 1, background: "var(--line-1)",
                borderTop: "1px solid var(--line-1)", borderBottom: "1px solid var(--line-1)",
              }}>
                {[
                  { label: "Bid",   val: fmtPrice(tk.bid),  c: "var(--pos)" },
                  { label: "Ask",   val: fmtPrice(tk.ask),  c: "var(--neg)" },
                  { label: "Open",  val: fmtPrice(tk.history[0] ?? tk.price) },
                  { label: "Close", val: fmtPrice(tk.price) },
                ].map(m => (
                  <div key={m.label} style={{ background: "var(--surface-1)", padding: "7px 12px" }}>
                    <div style={{ fontSize: 9, color: "var(--text-4)" }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: m.c ?? "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── СТАКАН ── */}
        {panelTab === "book" && (
          <div>
            <div style={{
              padding: "6px 10px", fontSize: 10, color: "var(--text-4)",
              display: "flex", justifyContent: "space-between",
              background: "var(--surface-1)", borderBottom: "1px solid var(--line-1)",
            }}>
              <span>Цена (USDT)</span>
              <span>Объём ({base})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column-reverse" }}>
              {orderBook.asks.slice(0, 10).map((l, i) => (
                <BookRow key={i} level={l} side="ask" maxTotal={orderBook.asks.slice(0,10).slice(-1)[0]?.total ?? 1} />
              ))}
            </div>
            {tk && (
              <div style={{
                padding: "6px 10px", textAlign: "center",
                background: "var(--surface-2)", fontSize: 13, fontWeight: 700,
                color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)",
                borderTop: "1px solid var(--line-1)", borderBottom: "1px solid var(--line-1)",
                fontVariantNumeric: "tabular-nums",
              }}>
                {fmtPrice(tk.price)} {tk.change24h >= 0 ? "▲" : "▼"}
              </div>
            )}
            <div>
              {orderBook.bids.slice(0, 10).map((l, i) => (
                <BookRow key={i} level={l} side="bid" maxTotal={orderBook.bids.slice(0,10).slice(-1)[0]?.total ?? 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── ОРДЕРА ── */}
        {panelTab === "orders" && (
          <div style={{ padding: "10px 12px" }}>

            {/* P&L сводка */}
            {historyOrders.some(o => o.status === "filled") && (
              <div style={{
                background: totalPnl >= 0 ? "var(--pos-dim)" : "var(--neg-dim)",
                border: `1px solid ${totalPnl >= 0 ? "var(--pos-border)" : "var(--neg-border)"}`,
                borderRadius: "var(--r-md)", padding: "10px 14px", marginBottom: 12,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Итог P&L · {pair}</span>
                <span style={{
                  fontSize: 17, fontWeight: 700,
                  color: totalPnl >= 0 ? "var(--pos)" : "var(--neg)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtPnl(totalPnl)}
                </span>
              </div>
            )}

            {/* Открытые / История */}
            <div style={{ display: "flex", background: "var(--surface-1)", borderRadius: "var(--r-md)", padding: 3, marginBottom: 12, gap: 3 }}>
              {[
                { key: "open" as const,    label: `Открытые${openOrders.length ? ` (${openOrders.length})` : ""}` },
                { key: "history" as const, label: "История" },
              ].map(t => (
                <button key={t.key} onClick={() => setOrdersTab(t.key)} style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: ordersTab === t.key ? "var(--accent-dim)" : "transparent",
                  border: ordersTab === t.key ? "1px solid var(--accent-border)" : "1px solid transparent",
                  color: ordersTab === t.key ? "var(--accent)" : "var(--text-3)",
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {ordersTab === "open" && (
              openOrders.length === 0
                ? <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-4)", fontSize: 13 }}>Нет открытых ордеров</div>
                : openOrders.map(o => (
                    <OrderRow key={o.id} order={o} currentPrice={tk?.price ?? 0} onCancel={() => cancelOrder(o.id)} />
                  ))
            )}
            {ordersTab === "history" && (
              historyOrders.length === 0
                ? <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-4)", fontSize: 13 }}>История пуста</div>
                : historyOrders.map(o => (
                    <OrderRow key={o.id} order={o} currentPrice={tk?.price ?? 0} />
                  ))
            )}
          </div>
        )}

        {/* ── Ордер-тикет (всегда снизу) ── */}
        <div style={{
          background: "var(--surface-1)", borderTop: "1px solid var(--line-1)",
          padding: "12px 14px",
          paddingBottom: "calc(12px + var(--nav-height) + var(--safe-bottom))",
        }}>
          {/* Buy / Sell */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 3, marginBottom: 10, gap: 3 }}>
            {(["buy","sell"] as OrderSide[]).map(s => (
              <button key={s} onClick={() => setSide(s)} style={{
                padding: "9px 0", border: "none", borderRadius: 10, cursor: "pointer",
                background: side === s ? (s === "buy" ? "var(--pos)" : "var(--neg)") : "transparent",
                color: side === s ? "#fff" : "var(--text-3)",
                fontSize: 13, fontWeight: 700, transition: "all var(--dur-fast)",
              }}>
                {s === "buy" ? "Купить" : "Продать"}
              </button>
            ))}
          </div>

          {/* Market / Limit */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {(["market","limit"] as OrderType[]).map(t => (
              <button key={t} onClick={() => setOrderType(t)} style={{
                flex: 1, padding: "6px 0", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500,
                background: orderType === t ? "var(--accent-dim)" : "transparent",
                border: orderType === t ? "1px solid var(--accent-border)" : "1px solid transparent",
                color: orderType === t ? "var(--accent)" : "var(--text-3)",
              }}>
                {t === "market" ? "По рынку" : "Лимитный"}
              </button>
            ))}
          </div>

          {/* Лимитная цена */}
          {orderType === "limit" && (
            <label style={{ display: "block", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 4 }}>Цена ({quote})</div>
              <input type="number" placeholder={tk ? fmtPrice(tk.price) : "0"}
                value={limitPrice} onChange={e => setLimitPrice(e.target.value)} style={inputSt} />
            </label>
          )}

          {/* Количество */}
          <label style={{ display: "block", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 4 }}>Количество ({base})</div>
            <input type="number" placeholder="0.00"
              value={qty} onChange={e => setQty(e.target.value)} style={inputSt} />
          </label>

          {/* % кнопки */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[0.25, 0.5, 0.75, 1].map(p => (
              <button key={p} onClick={() => pctOfBalance(p)} style={{
                flex: 1, padding: "4px 0", borderRadius: 6, cursor: "pointer",
                background: "var(--surface-2)", border: "1px solid var(--line-1)",
                color: "var(--text-3)", fontSize: 10,
              }}>
                {(p*100).toFixed(0)}%
              </button>
            ))}
          </div>

          {/* Баланс */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-4)", marginBottom: 10 }}>
            <span>Доступно</span>
            <span style={{ color: "var(--text-2)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {side === "buy"
                ? `${(quoteAsset?.available ?? 0).toLocaleString("ru-RU", {maximumFractionDigits:2})} ${quote}`
                : `${(baseAsset?.available ?? 0).toPrecision(5)} ${base}`
              }
            </span>
          </div>

          {/* Превью */}
          {qty && parseFloat(qty) > 0 && (
            <div style={{
              background: "var(--surface-2)", borderRadius: "var(--r-sm)",
              padding: "8px 10px", marginBottom: 10, fontSize: 11,
              border: "1px solid var(--line-1)",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 0",
            }}>
              <span style={{ color: "var(--text-4)" }}>Сумма</span>
              <span style={{ textAlign: "right", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>≈${estTotal.toFixed(2)}</span>
              <span style={{ color: "var(--text-4)" }}>Комиссия</span>
              <span style={{ textAlign: "right", color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>≈${estFee.toFixed(4)}</span>
            </div>
          )}

          {/* Кнопка */}
          <button onClick={handlePreview} style={{
            width: "100%", padding: "13px", border: "none", borderRadius: "var(--r-md)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            background: side === "buy"
              ? "linear-gradient(135deg,#31D0AA,#2aaf91)"
              : "linear-gradient(135deg,#FF5B6E,#d94456)",
            boxShadow: side === "buy"
              ? "0 4px 14px rgba(49,208,170,0.28)"
              : "0 4px 14px rgba(255,91,110,0.28)",
          }}>
            {side === "buy" ? `▲ Купить ${base}` : `▼ Продать ${base}`}
          </button>
        </div>
      </div>

      {/* ── Pair Picker ── */}
      <AnimatePresence>
        {showPicker && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"absolute", inset:0, background:"rgba(7,10,15,0.85)", backdropFilter:"blur(8px)", zIndex:50, display:"flex", alignItems:"flex-end" }}
            onClick={() => setShowPicker(false)}
          >
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
              transition={{duration:0.25, ease:EASE}} onClick={e=>e.stopPropagation()}
              style={{
                width:"100%", background:"var(--surface-1)",
                borderRadius:"var(--r-lg) var(--r-lg) 0 0",
                padding:"16px 16px calc(20px + var(--safe-bottom))",
                maxHeight:"72vh", overflowY:"auto",
                boxShadow:"var(--shadow-sheet)",
              }}
            >
              <h3 style={{ margin:"0 0 14px", fontSize:16, fontWeight:700, color:"var(--text-1)" }}>Выбор пары</h3>
              {PAIRS.map(p => {
                const t = state.tickers[p];
                const active = p === pair;
                return (
                  <button key={p} onClick={() => { setPair(p); setShowPicker(false); }} style={{
                    width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"11px 12px", borderRadius:"var(--r-sm)", marginBottom:4, cursor:"pointer",
                    background: active ? "var(--accent-dim)" : "transparent",
                    border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
                  }}>
                    <span style={{ fontWeight: active?700:400, fontSize:14, color:"var(--text-1)" }}>{p}</span>
                    {t && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:13, fontWeight:600, color: t.change24h>=0?"var(--pos)":"var(--neg)", fontVariantNumeric:"tabular-nums" }}>
                          {fmtPrice(t.price)}
                        </div>
                        <div style={{ fontSize:10, color: t.change24h>=0?"var(--pos)":"var(--neg)" }}>
                          {t.change24h>=0?"+":""}{t.change24h.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm Sheet ── */}
      <AnimatePresence>
        {confirmSheet && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"absolute", inset:0, background:"rgba(7,10,15,0.85)", backdropFilter:"blur(8px)", zIndex:60, display:"flex", alignItems:"flex-end" }}
            onClick={() => setConfirm(null)}
          >
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
              transition={{duration:0.25, ease:EASE}} onClick={e=>e.stopPropagation()}
              style={{
                width:"100%", background:"var(--surface-2)",
                borderRadius:"var(--r-lg) var(--r-lg) 0 0",
                padding:"20px 20px calc(24px + var(--safe-bottom))",
                boxShadow:"var(--shadow-sheet)",
              }}
            >
              <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700, color:"var(--text-1)" }}>
                Подтвердить ордер
              </h3>
              <div style={{ marginBottom:18 }}>
                {[
                  { label:"Действие", val:confirmSheet.preview, accent:true },
                  { label:"Тип", val: orderType==="market"?"По рынку":"Лимитный" },
                  { label:"Пара", val:pair },
                  ...(orderType==="limit" ? [{label:"Цена", val:`${limitPrice} ${quote}`}] : []),
                  { label:"Комиссия", val:confirmSheet.fee },
                  { label:"Итого", val:confirmSheet.total, bold:true },
                ].map(row => (
                  <div key={row.label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--line-1)", fontSize:13 }}>
                    <span style={{ color:"var(--text-3)" }}>{row.label}</span>
                    <span style={{
                      color: (row as {accent?:boolean}).accent ? "var(--accent)" : "var(--text-1)",
                      fontWeight: (row as {bold?:boolean}).bold || (row as {accent?:boolean}).accent ? 600 : 400,
                    }}>{row.val}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setConfirm(null)} style={{
                  flex:1, padding:"12px", background:"var(--surface-3)", border:"none",
                  borderRadius:"var(--r-md)", color:"var(--text-2)", fontSize:14, fontWeight:600, cursor:"pointer",
                }}>Отмена</button>
                <button onClick={handleConfirm} style={{
                  flex:2, padding:"12px", border:"none", borderRadius:"var(--r-md)",
                  color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer",
                  background: side==="buy" ? "linear-gradient(135deg,#31D0AA,#2aaf91)" : "linear-gradient(135deg,#FF5B6E,#d94456)",
                }}>Подтвердить</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{opacity:0, y:20, scale:0.9}} animate={{opacity:1, y:0, scale:1}} exit={{opacity:0, y:20, scale:0.9}}
            style={{
              position:"absolute", bottom:"calc(var(--nav-height) + var(--safe-bottom) + 16px)",
              left:"50%", transform:"translateX(-50%)",
              background: toast.ok ? "var(--pos)" : "var(--neg)",
              color:"#fff", padding:"10px 22px", borderRadius:20,
              fontSize:13, fontWeight:600, whiteSpace:"nowrap", zIndex:70,
              boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            {toast.ok ? "✓ " : "✗ "}{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "var(--surface-2)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", color: "var(--text-1)",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};
