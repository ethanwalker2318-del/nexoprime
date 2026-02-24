import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { genOrderBook, getCandles } from "../../shared/store/mockEngine";
import type { OrderBook, OrderBookLevel, Candle } from "../../shared/store/mockEngine";
import type { OrderSide, OrderType, Order } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PAIRS = ["BTC/USDT","ETH/USDT","SOL/USDT","BNB/USDT","XRP/USDT","ADA/USDT","DOGE/USDT","AVAX/USDT","LINK/USDT"];
const TF_LABELS = ["1м","5м","15м","1ч","4ч","1д"];
type BottomTab = "position" | "orders" | "history";

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

// ─── SVG Candle Chart OHLC ───────────────────────────────────────────────────
function CandleChart({ candles, currentPrice, change }: {
  candles: Candle[];
  currentPrice: number;
  change: number;
}) {
  const W = 360, H = 160;
  if (candles.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <span style={{ fontSize: 12, color: "var(--text-4)" }}>Загрузка...</span>
      </div>
    );
  }
  const displayed = candles.slice(-60);
  const allPrices = displayed.flatMap(c => [c.high, c.low]);
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad  = (rawMax - rawMin) * 0.08 || rawMin * 0.01;
  const min  = rawMin - pad;
  const max  = rawMax + pad;
  const range = max - min || 1;
  const toY  = (v: number) => H - ((v - min) / range) * H;
  const n    = displayed.length;
  const cW   = W / n;
  const body = Math.max(1.5, cW * 0.55);
  const gap  = (cW - body) / 2;
  const isPos = change >= 0;
  const curY = toY(currentPrice);
  const lastCandle = displayed[displayed.length - 1]!;

  return (
    <div style={{ position: "relative", width: "100%", background: "var(--bg-0)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        {[0.2,0.4,0.6,0.8].map(f => (
          <line key={f} x1={0} y1={H*f} x2={W} y2={H*f} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {displayed.map((c, i) => {
          const green  = c.close >= c.open;
          const col    = green ? "var(--pos)" : "var(--neg)";
          const x      = i * cW;
          const openY  = toY(c.open);
          const closeY = toY(c.close);
          const highY  = toY(c.high);
          const lowY   = toY(c.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyH   = Math.max(1.5, Math.abs(openY - closeY));
          const wickX   = x + gap + body / 2;
          return (
            <g key={i}>
              <line x1={wickX} y1={highY} x2={wickX} y2={lowY} stroke={col} strokeWidth="0.8" opacity="0.8" />
              <rect x={x+gap} y={bodyTop} width={body} height={bodyH} fill={col} opacity="0.85" />
            </g>
          );
        })}
        <line x1={0} y1={curY} x2={W} y2={curY}
          stroke={isPos ? "var(--pos)" : "var(--neg)"} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.55" />
      </svg>
      <div style={{ position:"absolute", top:4, left:6, fontSize:9, color:"var(--text-4)", fontVariantNumeric:"tabular-nums" }}>
        {fmtPrice(max - pad)}
      </div>
      <div style={{ position:"absolute", bottom:4, left:6, fontSize:9, color:"var(--text-4)", fontVariantNumeric:"tabular-nums" }}>
        {fmtPrice(min + pad)}
      </div>
      <div style={{
        position:"absolute", top: Math.max(2, Math.min(H-18, curY-9)), right:4,
        fontSize:10, fontWeight:700, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums",
        color: isPos ? "var(--pos)" : "var(--neg)",
        background: isPos ? "rgba(49,208,170,0.15)" : "rgba(255,91,110,0.15)",
        border: `1px solid ${isPos ? "rgba(49,208,170,0.4)" : "rgba(255,91,110,0.4)"}`,
        borderRadius:4, padding:"1px 5px",
      }}>
        {fmtPrice(currentPrice)}
      </div>
      <div style={{ position:"absolute", top:4, right:4, display:"flex", gap:8, fontSize:9, color:"var(--text-4)", fontVariantNumeric:"tabular-nums" }}>
        {[{l:"O",v:lastCandle.open},{l:"H",v:lastCandle.high,c:"var(--pos)"},{l:"L",v:lastCandle.low,c:"var(--neg)"},{l:"C",v:lastCandle.close}].map(({l,v,c})=>(
          <span key={l} style={{color: c ?? "var(--text-3)"}}>{l} <span style={{color:"var(--text-2)"}}>{fmtPrice(v)}</span></span>
        ))}
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

// ─── Основной экран ──────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--surface-2)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", color: "var(--text-1)",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};

export function TradeScreen() {
  const { state, placeOrder, cancelOrder, closePosition, unrealizedPnl } = useExchange();
  const [pair, setPair]             = useState("BTC/USDT");
  const [side, setSide]             = useState<OrderSide>("buy");
  const [orderType, setOrderType]   = useState<OrderType>("market");
  const [qty, setQty]               = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [tfLabel, setTfLabel]       = useState("15м");
  const [orderBook, setOrderBook]   = useState<OrderBook>(() => genOrderBook(pair));
  const [candles, setCandles]       = useState<Candle[]>(() => getCandles(pair, "15м"));
  const [showPicker, setShowPicker] = useState(false);
  const [confirmSheet, setConfirm]  = useState<null|{preview:string;fee:string;total:string}>(null);
  const [toast, setToast]           = useState<{msg:string;ok:boolean}|null>(null);
  const [bottomTab, setBottomTab]   = useState<BottomTab>("position");

  const tk                           = state.tickers[pair];
  const [base="", quote="USDT"]      = pair.split("/");
  const baseAsset                    = state.assets[base];
  const quoteAsset                   = state.assets[quote ?? "USDT"];

  useEffect(() => {
    setOrderBook(genOrderBook(pair));
    setCandles(getCandles(pair, tfLabel));
    const iv = setInterval(() => {
      setOrderBook(genOrderBook(pair));
      setCandles(getCandles(pair, tfLabel));
    }, 1200);
    return () => clearInterval(iv);
  }, [pair, tfLabel]);

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
      setBottomTab("orders");
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

  const pairOrders    = useMemo(() => state.orders.filter(o => o.symbol === pair), [state.orders, pair]);
  const openOrders    = pairOrders.filter(o => ["pending","queued","partial"].includes(o.status));
  const historyOrders = pairOrders.filter(o => ["filled","cancelled","rejected"].includes(o.status));
  const myAssets      = Object.values(state.assets).filter(a => a.symbol !== "USDT" && (a.available + a.locked) > 0.000001);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", background: "transparent", border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--accent)" : "var(--text-3)",
    fontSize: 11, fontWeight: active ? 600 : 400, cursor: "pointer",
    transition: "color var(--dur-fast), border-color var(--dur-fast)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* ── Шапка ── */}
      <div style={{ padding: "8px 12px 0", background: "var(--bg-0)", borderBottom: "1px solid var(--line-1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => setShowPicker(true)} style={{
            background: "var(--surface-1)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r-md)", padding: "5px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>{pair}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {tk && (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
                {fmtPrice(tk.price)}
              </div>
              <div style={{ marginLeft: "auto", padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                background: tk.change24h >= 0 ? "var(--pos-dim)" : "var(--neg-dim)",
                border: `1px solid ${tk.change24h >= 0 ? "var(--pos-border)" : "var(--neg-border)"}`,
                color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {tk.change24h >= 0 ? "▲" : "▼"} {Math.abs(tk.change24h).toFixed(2)}%
              </div>
            </>
          )}
        </div>
        {tk && (
          <div style={{ display: "flex", gap: 14, paddingBottom: 8, overflowX: "auto" }}>
            {[
              { label: "24ч Макс", val: fmtPrice(tk.high24h), c: "var(--pos)" },
              { label: "24ч Мин",  val: fmtPrice(tk.low24h),  c: "var(--neg)" },
              { label: "Bid",      val: fmtPrice(tk.bid),      c: "var(--pos)" },
              { label: "Ask",      val: fmtPrice(tk.ask),      c: "var(--neg)" },
              { label: "Объём",    val: `$${(tk.vol24h/1e6).toFixed(0)}M` },
            ].map(s => (
              <div key={s.label} style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 1 }}>{s.label}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: s.c ?? "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Скроллируемое тело ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* TF выбор */}
        <div style={{ display: "flex", gap: 2, padding: "6px 10px 4px", background: "var(--bg-0)", borderBottom: "1px solid var(--line-1)" }}>
          {TF_LABELS.map(tf => (
            <button key={tf} onClick={() => setTfLabel(tf)} style={{
              padding: "3px 7px", borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: "pointer",
              background: tfLabel === tf ? "var(--accent-dim)" : "transparent",
              border: tfLabel === tf ? "1px solid var(--accent-border)" : "1px solid transparent",
              color: tfLabel === tf ? "var(--accent)" : "var(--text-4)",
            }}>
              {tf}
            </button>
          ))}
        </div>

        {/* Свечной OHLC-чарт */}
        <CandleChart candles={candles} currentPrice={tk?.price ?? 0} change={tk?.change24h ?? 0} />

        {/* ── Стакан + Тикет side-by-side ── */}
        <div style={{ display: "flex", borderTop: "1px solid var(--line-1)", background: "var(--bg-0)" }}>

          {/* Стакан (45%) */}
          <div style={{ width: "45%", borderRight: "1px solid var(--line-1)" }}>
            <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-4)", display: "flex", justifyContent: "space-between", background: "var(--surface-1)", borderBottom: "1px solid var(--line-1)" }}>
              <span>Цена</span><span>Кол-во</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column-reverse" }}>
              {orderBook.asks.slice(0, 8).map((l, i) => (
                <BookRow key={i} level={l} side="ask" maxTotal={orderBook.asks[7]?.total ?? 1} />
              ))}
            </div>
            {tk && (
              <div style={{ padding: "3px 8px", background: "var(--surface-2)", borderTop: "1px solid var(--line-1)", borderBottom: "1px solid var(--line-1)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtPrice(tk.price)}
                </span>
              </div>
            )}
            <div>
              {orderBook.bids.slice(0, 8).map((l, i) => (
                <BookRow key={i} level={l} side="bid" maxTotal={orderBook.bids[7]?.total ?? 1} />
              ))}
            </div>
          </div>

          {/* Ордер-тикет (55%) */}
          <div style={{ width: "55%", padding: "8px 10px", overflowY: "auto" }}>
            {/* Buy / Sell */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--surface-2)", borderRadius: 8, padding: 2, marginBottom: 7, gap: 2 }}>
              {(["buy","sell"] as OrderSide[]).map(s => (
                <button key={s} onClick={() => setSide(s)} style={{
                  padding: "7px 0", border: "none", borderRadius: 7, cursor: "pointer",
                  background: side === s ? (s === "buy" ? "var(--pos)" : "var(--neg)") : "transparent",
                  color: side === s ? "#fff" : "var(--text-3)",
                  fontSize: 12, fontWeight: 700, transition: "all var(--dur-fast)",
                }}>
                  {s === "buy" ? "Купить" : "Продать"}
                </button>
              ))}
            </div>
            {/* Market / Limit */}
            <div style={{ display: "flex", gap: 3, marginBottom: 7 }}>
              {(["market","limit"] as OrderType[]).map(t => (
                <button key={t} onClick={() => setOrderType(t)} style={{
                  flex: 1, padding: "4px 0", borderRadius: 6, cursor: "pointer", fontSize: 10.5, fontWeight: 500,
                  background: orderType === t ? "var(--accent-dim)" : "transparent",
                  border: orderType === t ? "1px solid var(--accent-border)" : "1px solid transparent",
                  color: orderType === t ? "var(--accent)" : "var(--text-3)",
                }}>
                  {t === "market" ? "Рынок" : "Лимит"}
                </button>
              ))}
            </div>
            {orderType === "limit" && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 3 }}>Цена ({quote})</div>
                <input type="number" placeholder={tk ? fmtPrice(tk.price) : "0"}
                  value={limitPrice} onChange={e => setLimitPrice(e.target.value)} style={inputSt} />
              </div>
            )}
            <div style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 3 }}>Кол-во ({base})</div>
              <input type="number" placeholder="0.00"
                value={qty} onChange={e => setQty(e.target.value)} style={inputSt} />
            </div>
            <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
              {[0.25,0.5,0.75,1].map(p => (
                <button key={p} onClick={() => pctOfBalance(p)} style={{
                  flex: 1, padding: "3px 0", borderRadius: 5, cursor: "pointer",
                  background: "var(--surface-2)", border: "1px solid var(--line-1)",
                  color: "var(--text-3)", fontSize: 9.5,
                }}>
                  {(p*100).toFixed(0)}%
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 7, fontVariantNumeric: "tabular-nums" }}>
              {side === "buy"
                ? `${(quoteAsset?.available ?? 0).toFixed(2)} ${quote}`
                : `${(baseAsset?.available ?? 0).toPrecision(4)} ${base}`
              }
            </div>
            {qty && parseFloat(qty) > 0 && (
              <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "6px 8px", marginBottom: 7, fontSize: 10, border: "1px solid var(--line-1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-4)" }}>Сумма</span>
                  <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>≈${estTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-4)" }}>Комиссия</span>
                  <span style={{ color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>≈${estFee.toFixed(4)}</span>
                </div>
              </div>
            )}
            <button onClick={handlePreview} style={{
              width: "100%", padding: "10px", border: "none", borderRadius: "var(--r-md)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: side === "buy" ? "linear-gradient(135deg,#31D0AA,#2aaf91)" : "linear-gradient(135deg,#FF5B6E,#d94456)",
              boxShadow: side === "buy" ? "0 3px 12px rgba(49,208,170,0.28)" : "0 3px 12px rgba(255,91,110,0.28)",
            }}>
              {side === "buy" ? "▲ Купить" : "▼ Продать"}
            </button>
          </div>
        </div>

        {/* ── Нижние табы ── */}
        <div style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-0)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line-1)" }}>
            {([
              { key: "position" as BottomTab, label: "Активы" },
              { key: "orders"   as BottomTab, label: `Ордера${openOrders.length ? ` (${openOrders.length})` : ""}` },
              { key: "history"  as BottomTab, label: "История" },
            ]).map(t => (
              <button key={t.key} onClick={() => setBottomTab(t.key)} style={tabStyle(bottomTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Активы с P&L ── */}
        {bottomTab === "position" && (
          <div style={{ padding: "10px 12px", paddingBottom: "calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            {quoteAsset && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--surface-1)", borderRadius: "var(--r-md)", border: "1px solid var(--line-1)",
                padding: "10px 12px", marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(49,208,170,0.12)", border:"1px solid rgba(49,208,170,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--pos)" }}>$</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color:"var(--text-1)" }}>USDT</div>
                    <div style={{ fontSize:10, color:"var(--text-4)" }}>Свободно</div>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"var(--text-1)", fontVariantNumeric:"tabular-nums" }}>
                    {quoteAsset.available.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  </div>
                  {quoteAsset.locked > 0 && <div style={{ fontSize:10, color:"var(--text-4)" }}>заморожено {quoteAsset.locked.toFixed(2)}</div>}
                </div>
              </div>
            )}
            {myAssets.length === 0 ? (
              <div style={{ textAlign:"center", padding:"32px 0", color:"var(--text-4)", fontSize:13 }}>Нет активов — сделайте первую покупку</div>
            ) : myAssets.map(asset => {
              const sym  = asset.symbol;
              const tkA  = state.tickers[`${sym}/USDT`];
              const total = asset.available + asset.locked;
              const { pnl, pct } = unrealizedPnl(`${sym}/USDT`);
              const isPosP = pnl >= 0;
              return (
                <div key={sym} style={{ background:"var(--surface-1)", border:"1px solid var(--line-1)", borderRadius:"var(--r-md)", padding:"10px 12px", marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--accent-dim)", border:"1px solid var(--accent-border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--accent)" }}>
                        {sym.slice(0,2)}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:"var(--text-1)" }}>{sym}</div>
                        <div style={{ fontSize:10, color:"var(--text-4)", fontVariantNumeric:"tabular-nums" }}>Ср.цена ${fmtPrice(asset.avgBuyPrice)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:700, fontSize:13, color:"var(--text-1)", fontVariantNumeric:"tabular-nums" }}>{total.toPrecision(5)} {sym}</div>
                      <div style={{ fontSize:11, color:"var(--text-3)", fontVariantNumeric:"tabular-nums" }}>≈${(total*(tkA?.price??0)).toFixed(2)}</div>
                    </div>
                  </div>
                  {/* P&L */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    background: isPosP ? "var(--pos-dim)" : "var(--neg-dim)",
                    border:`1px solid ${isPosP ? "var(--pos-border)" : "var(--neg-border)"}`,
                    borderRadius:"var(--r-sm)", padding:"6px 10px",
                  }}>
                    <div>
                      <div style={{ fontSize:9, color:"var(--text-4)", marginBottom:1 }}>P&L (нереализованный)</div>
                      <div style={{ fontSize:14, fontWeight:700, color: isPosP ? "var(--pos)" : "var(--neg)", fontVariantNumeric:"tabular-nums" }}>
                        {fmtPnl(pnl)}
                        <span style={{ fontSize:10, marginLeft:5, opacity:0.8 }}>({pct>=0?"+":""}{pct.toFixed(2)}%)</span>
                      </div>
                    </div>
                    {asset.realizedPnl !== 0 && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:9, color:"var(--text-4)" }}>Зафиксировано</div>
                        <div style={{ fontSize:12, fontWeight:600, color: asset.realizedPnl>=0?"var(--pos)":"var(--neg)", fontVariantNumeric:"tabular-nums" }}>
                          {fmtPnl(asset.realizedPnl)}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Кнопки */}
                  <div style={{ display:"flex", gap:7, marginTop:8 }}>
                    <button onClick={() => { setPair(`${sym}/USDT`); setSide("buy"); }} style={{
                      flex:1, padding:"6px 0", borderRadius:"var(--r-sm)", cursor:"pointer",
                      background:"var(--pos-dim)", border:"1px solid var(--pos-border)", color:"var(--pos)", fontSize:11, fontWeight:600,
                    }}>+ Докупить</button>
                    <button onClick={() => {
                      const r = closePosition(`${sym}/USDT`);
                      if (!r.ok) showToast(r.error ?? "Ошибка", false);
                      else showToast(`${sym}: позиция закрывается...`, true);
                    }} style={{
                      flex:1, padding:"6px 0", borderRadius:"var(--r-sm)", cursor:"pointer",
                      background:"var(--neg-dim)", border:"1px solid var(--neg-border)", color:"var(--neg)", fontSize:11, fontWeight:600,
                    }}>Закрыть</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Открытые ордера ── */}
        {bottomTab === "orders" && (
          <div style={{ padding:"10px 12px", paddingBottom:"calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            {openOrders.length === 0
              ? <div style={{ textAlign:"center", padding:"32px 0", color:"var(--text-4)", fontSize:13 }}>Нет открытых ордеров</div>
              : openOrders.map(o => <OrderRow key={o.id} order={o} currentPrice={tk?.price ?? 0} onCancel={() => cancelOrder(o.id)} />)
            }
          </div>
        )}

        {/* ── История ── */}
        {bottomTab === "history" && (
          <div style={{ padding:"10px 12px", paddingBottom:"calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            {historyOrders.length === 0
              ? <div style={{ textAlign:"center", padding:"32px 0", color:"var(--text-4)", fontSize:13 }}>История пуста</div>
              : historyOrders.map(o => <OrderRow key={o.id} order={o} currentPrice={tk?.price ?? 0} />)
            }
          </div>
        )}
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
              style={{ width:"100%", background:"var(--surface-1)", borderRadius:"var(--r-lg) var(--r-lg) 0 0", padding:"16px 16px calc(20px + var(--safe-bottom))", maxHeight:"72vh", overflowY:"auto", boxShadow:"var(--shadow-sheet)" }}
            >
              <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Выбор пары</h3>
              {PAIRS.map(p => {
                const t = state.tickers[p];
                const active = p === pair;
                return (
                  <button key={p} onClick={() => { setPair(p); setShowPicker(false); }} style={{
                    width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"10px 12px", borderRadius:"var(--r-sm)", marginBottom:4, cursor:"pointer",
                    background: active ? "var(--accent-dim)" : "transparent",
                    border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
                  }}>
                    <span style={{ fontWeight:active?700:400, fontSize:13, color:"var(--text-1)" }}>{p}</span>
                    {t && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, fontWeight:600, color: t.change24h>=0?"var(--pos)":"var(--neg)", fontVariantNumeric:"tabular-nums" }}>{fmtPrice(t.price)}</div>
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
              style={{ width:"100%", background:"var(--surface-2)", borderRadius:"var(--r-lg) var(--r-lg) 0 0", padding:"18px 18px calc(22px + var(--safe-bottom))", boxShadow:"var(--shadow-sheet)" }}
            >
              <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Подтвердить ордер</h3>
              <div style={{ marginBottom:16 }}>
                {[
                  { label:"Действие", val:confirmSheet.preview, accent:true },
                  { label:"Тип", val: orderType==="market"?"По рынку":"Лимитный" },
                  { label:"Пара", val:pair },
                  ...(orderType==="limit" ? [{label:"Цена", val:`${limitPrice} ${quote}`}] : []),
                  { label:"Комиссия", val:confirmSheet.fee },
                  { label:"Итого", val:confirmSheet.total, bold:true },
                ].map(row => (
                  <div key={row.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--line-1)", fontSize:12 }}>
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
                  flex:1, padding:"11px", background:"var(--surface-3)", border:"none",
                  borderRadius:"var(--r-md)", color:"var(--text-2)", fontSize:13, fontWeight:600, cursor:"pointer",
                }}>Отмена</button>
                <button onClick={handleConfirm} style={{
                  flex:2, padding:"11px", border:"none", borderRadius:"var(--r-md)",
                  color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
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
            initial={{opacity:0,y:20,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:0.9}}
            style={{
              position:"absolute", bottom:"calc(var(--nav-height) + var(--safe-bottom) + 16px)",
              left:"50%", transform:"translateX(-50%)",
              background: toast.ok ? "var(--pos)" : "var(--neg)",
              color:"#fff", padding:"9px 20px", borderRadius:20,
              fontSize:12, fontWeight:600, whiteSpace:"nowrap", zIndex:70,
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





