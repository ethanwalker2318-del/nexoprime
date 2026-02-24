import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";
import { getCandles } from "../../shared/store/mockEngine";
import type { Candle } from "../../shared/store/mockEngine";
import type { BinaryDirection, BinaryOption, BinaryStatus } from "../../shared/store/exchangeStore";
import { PAYOUT_RATE } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const TF_OPTIONS = ["1м", "5м", "15м", "1ч"];
const PAIRS = ["BTC/USDT","ETH/USDT","SOL/USDT","BNB/USDT","XRP/USDT","ADA/USDT","DOGE/USDT","AVAX/USDT","LINK/USDT"];
const EXPIRY_OPTIONS = [
  { label: "30с", ms: 30_000 },
  { label: "1м",  ms: 60_000 },
  { label: "5м",  ms: 300_000 },
  { label: "15м", ms: 900_000 },
  { label: "30м", ms: 1_800_000 },
  { label: "1ч",  ms: 3_600_000 },
];
const STAKE_PRESETS = [10, 25, 50, 100];
type BottomTab = "active" | "history";

const ENTRY_COLORS = [
  "rgba(255,200,0,0.85)",
  "rgba(0,200,255,0.85)",
  "rgba(255,100,200,0.85)",
  "rgba(180,255,100,0.85)",
];

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  if (n >= 1)     return n.toFixed(2);
  return n.toPrecision(4);
}
function fmtPnl(n: number): string {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}
function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}с`;
}
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function statusLabel(s: BinaryStatus): string {
  if (s === "active") return "Активен";
  if (s === "won")    return "Выигрыш";
  if (s === "lost")   return "Проигрыш";
  return "Ничья";
}
function statusColor(s: BinaryStatus): string {
  return s === "won" ? "var(--pos)" : s === "lost" ? "var(--neg)" : s === "active" ? "var(--accent)" : "var(--text-4)";
}

// SVG Candle Chart
function CandleChart({ candles, currentPrice, change, entryLines }: {
  candles:      Candle[];
  currentPrice: number;
  change:       number;
  entryLines:   { price: number; color: string; direction: BinaryDirection }[];
}) {
  const W = 360, H = 210;
  if (candles.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <span style={{ fontSize: 12, color: "var(--text-4)" }}>Загрузка...</span>
      </div>
    );
  }

  const displayed = candles.slice(-60);
  const allPrices = displayed.flatMap(c => [c.high, c.low]);
  entryLines.forEach(l => allPrices.push(l.price));
  allPrices.push(currentPrice);

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad    = (rawMax - rawMin) * 0.1 || rawMin * 0.01;
  const min    = rawMin - pad;
  const max    = rawMax + pad;
  const range  = max - min || 1;
  const toY    = (v: number) => H - ((v - min) / range) * H;

  const n    = displayed.length;
  const cW   = W / n;
  const body = Math.max(1.5, cW * 0.55);
  const gap  = (cW - body) / 2;
  const isPos = change >= 0;
  const curY  = toY(currentPrice);
  const lastC = displayed[displayed.length - 1]!;

  return (
    <div style={{ position: "relative", width: "100%", background: "var(--bg-0)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        {[0.15, 0.35, 0.55, 0.75, 0.9].map(f => (
          <line key={f} x1={0} y1={H*f} x2={W} y2={H*f} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {displayed.map((c, i) => {
          const green   = c.close >= c.open;
          const col     = green ? "var(--pos)" : "var(--neg)";
          const x       = i * cW;
          const openY   = toY(c.open);
          const closeY  = toY(c.close);
          const highY   = toY(c.high);
          const lowY    = toY(c.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyH   = Math.max(1.5, Math.abs(openY - closeY));
          const wickX   = x + gap + body / 2;
          return (
            <g key={i}>
              <line x1={wickX} y1={highY} x2={wickX} y2={lowY} stroke={col} strokeWidth="0.9" opacity="0.85" />
              <rect x={x+gap} y={bodyTop} width={body} height={bodyH} fill={col} opacity="0.9" />
            </g>
          );
        })}
        <line x1={0} y1={curY} x2={W} y2={curY}
          stroke={isPos ? "var(--pos)" : "var(--neg)"} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.6" />
        {entryLines.map((el, idx) => {
          const ey = toY(el.price);
          return (
            <g key={idx}>
              <line x1={0} y1={ey} x2={W} y2={ey}
                stroke={el.color} strokeWidth="1.2" strokeDasharray="6 4" opacity="0.9" />
              <text x={2} y={ey - 3} fontSize="8" fill={el.color} opacity="0.95">
                {el.direction === "call" ? "▲" : "▼"} {fmtPrice(el.price)}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position:"absolute", top:4, left:6, fontSize:9, color:"var(--text-4)", fontVariantNumeric:"tabular-nums", pointerEvents:"none" }}>
        {fmtPrice(max - pad)}
      </div>
      <div style={{ position:"absolute", bottom:4, left:6, fontSize:9, color:"var(--text-4)", fontVariantNumeric:"tabular-nums", pointerEvents:"none" }}>
        {fmtPrice(min + pad)}
      </div>
      <div style={{
        position:"absolute", top: Math.max(2, Math.min(H-18, curY-9)), right:4,
        fontSize:10, fontWeight:700, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums",
        color: isPos ? "var(--pos)" : "var(--neg)",
        background: isPos ? "rgba(49,208,170,0.18)" : "rgba(255,91,110,0.18)",
        border: `1px solid ${isPos ? "rgba(49,208,170,0.5)" : "rgba(255,91,110,0.5)"}`,
        borderRadius:4, padding:"1px 5px", pointerEvents:"none",
      }}>
        {fmtPrice(currentPrice)}
      </div>
      <div style={{ position:"absolute", top:4, right:52, display:"flex", gap:8, fontSize:9, color:"var(--text-4)", fontVariantNumeric:"tabular-nums", pointerEvents:"none" }}>
        {[{l:"O",v:lastC.open},{l:"H",v:lastC.high,c:"var(--pos)"},{l:"L",v:lastC.low,c:"var(--neg)"},{l:"C",v:lastC.close}].map(({l,v,c})=>(
          <span key={l} style={{color: c ?? "var(--text-3)"}}>{l} <span style={{color:"var(--text-2)"}}>{fmtPrice(v)}</span></span>
        ))}
      </div>
    </div>
  );
}

// Карточка активного опциона
function ActiveOptionCard({ option, currentPrice, entryColor }: {
  option: BinaryOption;
  currentPrice: number;
  entryColor: string;
}) {
  const [remaining, setRemaining] = useState(option.expiresAt - Date.now());

  useEffect(() => {
    const iv = setInterval(() => setRemaining(option.expiresAt - Date.now()), 250);
    return () => clearInterval(iv);
  }, [option.expiresAt]);

  const isCall  = option.direction === "call";
  const winning = isCall ? currentPrice > option.openPrice : currentPrice < option.openPrice;
  const pnlNow  = winning ? option.stake * PAYOUT_RATE : -option.stake;
  const pct     = Math.max(0, Math.min(100, (remaining / option.expiryMs) * 100));
  const winReturn = option.stake + option.stake * PAYOUT_RATE;

  return (
    <div style={{
      background: "var(--surface-1)",
      border: `1px solid ${winning ? "var(--pos-border)" : "var(--neg-border)"}`,
      borderLeft: `3px solid ${entryColor}`,
      borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
            background: isCall ? "var(--pos-dim)" : "var(--neg-dim)",
            color: isCall ? "var(--pos)" : "var(--neg)",
            border: `1px solid ${isCall ? "var(--pos-border)" : "var(--neg-border)"}`,
          }}>
            {isCall ? "▲ CALL" : "▼ PUT"}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
            {fmtMs(remaining)}
          </div>
          <div style={{ fontSize: 9, color: winning ? "var(--pos)" : "var(--neg)" }}>
            {winning ? "Побеждает" : "Проигрывает"}
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: winning
            ? "linear-gradient(90deg,var(--pos),#2adf99)"
            : "linear-gradient(90deg,var(--neg),#ff8c99)",
          borderRadius: 2, transition: "width 0.25s linear",
        }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px 8px", fontSize: 11 }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Ставка</div>
          <div style={{ fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>${option.stake.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Цена входа</div>
          <div style={{ fontWeight: 600, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(option.openPrice)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Текущая</div>
          <div style={{ fontWeight: 600, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(currentPrice)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>P&L</div>
          <div style={{ fontWeight: 700, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
            {fmtPnl(pnlNow)}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center",
        background: winning ? "var(--pos-dim)" : "var(--neg-dim)",
        border: `1px solid ${winning ? "var(--pos-border)" : "var(--neg-border)"}`,
        borderRadius: "var(--r-sm)", padding: "4px 8px", fontSize: 10,
      }}>
        <span style={{ color: "var(--text-4)" }}>
          {winning ? "Выплата при победе:" : "Потеря при поражении:"}
        </span>
        <span style={{ fontWeight: 700, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
          {winning ? `+$${(option.stake * PAYOUT_RATE).toFixed(2)} = $${winReturn.toFixed(2)}` : `-$${option.stake.toFixed(2)} = $0.00`}
        </span>
      </div>
    </div>
  );
}

// Карточка истории
function HistoryOptionCard({ option }: { option: BinaryOption }) {
  const isCall = option.direction === "call";
  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--line-1)",
      borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
            background: isCall ? "var(--pos-dim)" : "var(--neg-dim)",
            color: isCall ? "var(--pos)" : "var(--neg)",
            border: `1px solid ${isCall ? "var(--pos-border)" : "var(--neg-border)"}`,
          }}>
            {isCall ? "▲ CALL" : "▼ PUT"}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
          color: statusColor(option.status),
          background: option.status === "won" ? "var(--pos-dim)" : option.status === "lost" ? "var(--neg-dim)" : "var(--surface-2)",
          border: `1px solid ${option.status === "won" ? "var(--pos-border)" : option.status === "lost" ? "var(--neg-border)" : "var(--line-1)"}`,
        }}>
          {statusLabel(option.status)}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px 8px", fontSize: 11 }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Ставка</div>
          <div style={{ fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>${option.stake.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Вход</div>
          <div style={{ fontWeight: 600, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(option.openPrice)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Закрытие</div>
          <div style={{ fontWeight: 600, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
            {option.closePrice != null ? fmtPrice(option.closePrice) : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>P&L</div>
          <div style={{ fontWeight: 700, color: statusColor(option.status), fontVariantNumeric: "tabular-nums" }}>
            {option.status !== "active" ? fmtPnl(option.pnl) : "—"}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: "var(--text-4)" }}>{fmtTime(option.createdAt)}</div>
    </div>
  );
}

// Статистика
function HistoryStats({ options }: { options: BinaryOption[] }) {
  const closed = options.filter(o => o.status !== "active");
  if (closed.length === 0) return null;
  const wins     = closed.filter(o => o.status === "won").length;
  const totalPnl = closed.reduce((s, o) => s + o.pnl, 0);
  const winRate  = (wins / closed.length) * 100;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      background: "var(--surface-1)", border: "1px solid var(--line-1)",
      borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 10, gap: 4,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Побед</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--pos)" }}>{winRate.toFixed(0)}%</div>
        <div style={{ fontSize: 9, color: "var(--text-4)" }}>{wins}/{closed.length}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Итого P&L</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: totalPnl >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
          {fmtPnl(totalPnl)}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Сделок</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)" }}>{closed.length}</div>
      </div>
    </div>
  );
}

// Основной экран
export function TradeScreen() {
  const { state, placeBinary } = useExchange();
  const { tradePair } = useRouter();

  const [pair,       setPair]       = useState(() => tradePair ?? "BTC/USDT");
  const [direction,  setDirection]  = useState<BinaryDirection>("call");
  const [stake,      setStake]      = useState("10");
  const [expiryIdx,  setExpiryIdx]  = useState(1);
  const [tfLabel,    setTfLabel]    = useState("1м");
  const [candles,    setCandles]    = useState<Candle[]>(() => getCandles(pair, "1м"));
  const [showPicker, setShowPicker] = useState(false);
  const [toast,      setToast]      = useState<{msg:string;ok:boolean}|null>(null);
  const [bottomTab,  setBottomTab]  = useState<BottomTab>("active");

  const tk   = state.tickers[pair];
  const usdt = state.assets["USDT"];

  useEffect(() => { if (tradePair) setPair(tradePair); }, [tradePair]);

  useEffect(() => {
    setCandles(getCandles(pair, tfLabel));
    const iv = setInterval(() => setCandles(getCandles(pair, tfLabel)), 1000);
    return () => clearInterval(iv);
  }, [pair, tfLabel]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  function handlePlace() {
    const s = parseFloat(stake);
    if (!s || s <= 0) { showToast("Укажите ставку", false); return; }
    const exp = EXPIRY_OPTIONS[expiryIdx]!;
    const r = placeBinary(pair, direction, s, exp.ms);
    if (r.ok) {
      showToast(`${direction === "call" ? "▲ CALL" : "▼ PUT"} размещён на ${exp.label}`, true);
      setBottomTab("active");
    } else {
      showToast(r.error ?? "Ошибка", false);
    }
  }

  const stakeNum = parseFloat(stake) || 0;
  const payout   = stakeNum * PAYOUT_RATE;
  const expLabel = EXPIRY_OPTIONS[expiryIdx]?.label ?? "1м";

  const allOptions    = useMemo(() => state.binaryOptions.filter(o => o.symbol === pair), [state.binaryOptions, pair]);
  const activeOptions = allOptions.filter(o => o.status === "active");
  const historyOpts   = allOptions.filter(o => o.status !== "active").slice().reverse();

  const entryLines = activeOptions.map((o, idx) => ({
    price: o.openPrice,
    color: ENTRY_COLORS[idx % ENTRY_COLORS.length] ?? ENTRY_COLORS[0]!,
    direction: o.direction,
  }));

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "9px 0", background: "transparent", border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--accent)" : "var(--text-3)",
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* Шапка */}
      <div style={{ padding: "8px 12px 0", background: "var(--bg-0)", borderBottom: "1px solid var(--line-1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => setShowPicker(true)} style={{
            background: "var(--surface-1)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r-md)", padding: "5px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>{pair}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {tk && (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
                {fmtPrice(tk.price)}
              </div>
              <div style={{
                marginLeft: "auto", padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                background: tk.change24h >= 0 ? "var(--pos-dim)" : "var(--neg-dim)",
                border: `1px solid ${tk.change24h >= 0 ? "var(--pos-border)" : "var(--neg-border)"}`,
                color: tk.change24h >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {tk.change24h >= 0 ? "+" : ""}{tk.change24h.toFixed(2)}%
              </div>
            </>
          )}
        </div>
        {tk && (
          <div style={{ display: "flex", gap: 12, paddingBottom: 8, overflowX: "auto", alignItems: "center" }}>
            {[
              { label: "24ч Макс", val: fmtPrice(tk.high24h), c: "var(--pos)" },
              { label: "24ч Мин",  val: fmtPrice(tk.low24h),  c: "var(--neg)" },
              { label: "Bid",      val: fmtPrice(tk.bid),      c: "var(--pos)" },
              { label: "Ask",      val: fmtPrice(tk.ask),      c: "var(--neg)" },
            ].map(s => (
              <div key={s.label} style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 1 }}>{s.label}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: s.c ?? "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
              </div>
            ))}
            <div style={{ marginLeft: "auto", flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "var(--text-4)" }}>Баланс USDT</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                ${(usdt?.available ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Тело */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* TF-селектор */}
        <div style={{ display: "flex", gap: 2, padding: "5px 10px", background: "var(--bg-0)", borderBottom: "1px solid var(--line-1)" }}>
          {TF_OPTIONS.map(tf => (
            <button key={tf} onClick={() => setTfLabel(tf)} style={{
              padding: "3px 10px", borderRadius: 5, cursor: "pointer",
              background: tfLabel === tf ? "var(--accent-dim)" : "transparent",
              border: tfLabel === tf ? "1px solid var(--accent-border)" : "1px solid transparent",
              color: tfLabel === tf ? "var(--accent)" : "var(--text-4)",
              fontSize: 11, fontWeight: tfLabel === tf ? 700 : 400,
            }}>
              {tf}
            </button>
          ))}
          {activeOptions.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-4)" }}>
              {activeOptions.map((o, i) => (
                <span key={o.id} style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: ENTRY_COLORS[i % ENTRY_COLORS.length],
                  display: "inline-block",
                }} />
              ))}
              <span>{activeOptions.length} активн.</span>
            </div>
          )}
        </div>

        {/* Чарт */}
        <CandleChart
          candles={candles}
          currentPrice={tk?.price ?? 0}
          change={tk?.change24h ?? 0}
          entryLines={entryLines}
        />

        {/* Панель торговли */}
        <div style={{ background: "var(--bg-0)", borderTop: "1px solid var(--line-1)", padding: "12px" }}>

          {/* CALL / PUT */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {(["call","put"] as BinaryDirection[]).map(d => (
              <button key={d} onClick={() => setDirection(d)} style={{
                padding: "14px 0", borderRadius: "var(--r-md)", cursor: "pointer",
                background: direction === d
                  ? (d === "call" ? "linear-gradient(135deg,#31D0AA,#2aaf91)" : "linear-gradient(135deg,#FF5B6E,#d94456)")
                  : (d === "call" ? "var(--pos-dim)" : "var(--neg-dim)"),
                color: direction === d ? "#fff" : (d === "call" ? "var(--pos)" : "var(--neg)"),
                fontSize: 16, fontWeight: 800,
                border: `1.5px solid ${d === "call" ? "var(--pos-border)" : "var(--neg-border)"}`,
                boxShadow: direction === d
                  ? (d === "call" ? "0 4px 16px rgba(49,208,170,0.35)" : "0 4px 16px rgba(255,91,110,0.35)")
                  : "none",
                transition: "all 0.15s ease",
              } as React.CSSProperties}>
                {d === "call" ? "▲  CALL" : "▼  PUT"}
              </button>
            ))}
          </div>

          {/* Экспирация */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 5 }}>ЭКСПИРАЦИЯ</div>
            <div style={{ display: "flex", gap: 5 }}>
              {EXPIRY_OPTIONS.map((e, i) => (
                <button key={e.label} onClick={() => setExpiryIdx(i)} style={{
                  flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
                  background: expiryIdx === i ? "var(--accent-dim)" : "transparent",
                  border: expiryIdx === i ? "1px solid var(--accent-border)" : "1px solid var(--line-1)",
                  color: expiryIdx === i ? "var(--accent)" : "var(--text-4)",
                  fontSize: 10.5, fontWeight: expiryIdx === i ? 700 : 400,
                }}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ставка */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 5 }}>СТАВКА (USDT)</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {STAKE_PRESETS.map(p => (
                <button key={p} onClick={() => setStake(String(p))} style={{
                  flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
                  background: parseFloat(stake) === p ? "var(--accent-dim)" : "var(--surface-2)",
                  border: parseFloat(stake) === p ? "1px solid var(--accent-border)" : "1px solid var(--line-1)",
                  color: parseFloat(stake) === p ? "var(--accent)" : "var(--text-3)",
                  fontSize: 11, fontWeight: parseFloat(stake) === p ? 700 : 400,
                }}>
                  ${p}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Своя сумма"
              value={stake}
              onChange={e => setStake(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px",
                background: "var(--surface-2)", border: "1px solid var(--line-2)",
                borderRadius: "var(--r-sm)", color: "var(--text-1)",
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Выплата */}
          {stakeNum > 0 && (
            <div style={{
              background: "var(--surface-2)", border: "1px solid var(--line-1)",
              borderRadius: "var(--r-sm)", padding: "10px 12px", marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: "var(--text-4)" }}>Ставка</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>${stakeNum.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "var(--pos)" }}>{`✓ Победа (+${(PAYOUT_RATE * 100).toFixed(0)}%)`}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pos)", fontVariantNumeric: "tabular-nums" }}>{`= $${(stakeNum + payout).toFixed(2)}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "var(--neg)" }}>✗ Поражение</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--neg)", fontVariantNumeric: "tabular-nums" }}>= $0.00</span>
              </div>
            </div>
          )}

          {/* Кнопка */}
          <button onClick={handlePlace} style={{
            width: "100%", padding: "14px", border: "none", borderRadius: "var(--r-md)",
            color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
            background: direction === "call"
              ? "linear-gradient(135deg,#31D0AA,#2aaf91)"
              : "linear-gradient(135deg,#FF5B6E,#d94456)",
            boxShadow: direction === "call"
              ? "0 4px 20px rgba(49,208,170,0.35)"
              : "0 4px 20px rgba(255,91,110,0.35)",
            letterSpacing: 0.5,
          }}>
            {direction === "call" ? `▲ CALL  ${expLabel}` : `▼ PUT  ${expLabel}`}
          </button>
        </div>

        {/* Нижние табы */}
        <div style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-0)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line-1)" }}>
            <button onClick={() => setBottomTab("active")} style={tabStyle(bottomTab === "active")}>
              {`Активные${activeOptions.length ? ` (${activeOptions.length})` : ""}`}
            </button>
            <button onClick={() => setBottomTab("history")} style={tabStyle(bottomTab === "history")}>
              История
            </button>
          </div>
        </div>

        {bottomTab === "active" && (
          <div style={{ padding: "10px 12px", paddingBottom: "calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            {activeOptions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-4)", fontSize: 13 }}>
                Нет активных опционов — сделайте первый CALL или PUT
              </div>
            ) : (
              activeOptions.map((o, idx) => (
                <ActiveOptionCard
                  key={o.id}
                  option={o}
                  currentPrice={tk?.price ?? 0}
                  entryColor={ENTRY_COLORS[idx % ENTRY_COLORS.length] ?? ENTRY_COLORS[0]!}
                />
              ))
            )}
          </div>
        )}

        {bottomTab === "history" && (
          <div style={{ padding: "10px 12px", paddingBottom: "calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            <HistoryStats options={allOptions} />
            {historyOpts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-4)", fontSize: 13 }}>
                История пуста
              </div>
            ) : (
              historyOpts.map(o => <HistoryOptionCard key={o.id} option={o} />)
            )}
          </div>
        )}
      </div>

      {/* Pair Picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"absolute", inset:0, background:"rgba(7,10,15,0.85)", backdropFilter:"blur(8px)", zIndex:50, display:"flex", alignItems:"flex-end" }}
            onClick={() => setShowPicker(false)}
          >
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
              transition={{duration:0.25, ease:EASE}} onClick={e=>e.stopPropagation()}
              style={{ width:"100%", background:"var(--surface-1)", borderRadius:"var(--r-lg) var(--r-lg) 0 0", padding:"16px 16px calc(20px + var(--safe-bottom))", maxHeight:"75vh", overflowY:"auto", boxShadow:"var(--shadow-sheet)" }}
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
                          {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(2)}%
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

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{opacity:0,y:20,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:0.9}}
            style={{
              position:"absolute",
              bottom:"calc(var(--nav-height) + var(--safe-bottom) + 16px)",
              left:"50%", transform:"translateX(-50%)",
              background: toast.ok ? "var(--pos)" : "var(--neg)",
              color:"#fff", padding:"10px 22px", borderRadius:22,
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
