import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";
import { getCandles } from "../../shared/store/mockEngine";
import type { Candle } from "../../shared/store/mockEngine";
import type { BinaryDirection, BinaryOption, BinaryStatus } from "../../shared/store/exchangeStore";
import { PAYOUT_RATE } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const PAIRS = ["BTC/USDT","ETH/USDT","SOL/USDT","BNB/USDT","XRP/USDT","ADA/USDT","DOGE/USDT","AVAX/USDT","LINK/USDT"];
const EXPIRY_OPTIONS = [
  { label: "30с", ms: 30_000 },
  { label: "1м",  ms: 60_000 },
  { label: "5м",  ms: 300_000 },
  { label: "15м", ms: 900_000 },
  { label: "30м", ms: 1_800_000 },
  { label: "1ч",  ms: 3_600_000 },
];
const TF_CHART = "1м";
const STAKE_PRESETS = [10, 25, 50, 100];
type BottomTab = "active" | "history";

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
  return s === "active" ? "ктивен" : s === "won" ? "ыигрыш" : s === "lost" ? "роигрыш" : "ичья";
}
function statusColor(s: BinaryStatus): string {
  return s === "won" ? "var(--pos)" : s === "lost" ? "var(--neg)" : s === "active" ? "var(--accent)" : "var(--text-4)";
}

// ─── SVG Candle Chart ────────────────────────────────────────────────────────
function CandleChart({ candles, currentPrice, change, expiryLine }: {
  candles: Candle[];
  currentPrice: number;
  change: number;
  expiryLine?: number | null;
}) {
  const W = 360, H = 180;
  if (candles.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <span style={{ fontSize: 12, color: "var(--text-4)" }}>агрузка...</span>
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
  const expiryY = expiryLine != null ? toY(expiryLine) : null;

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
        {/* Текущая цена */}
        <line x1={0} y1={curY} x2={W} y2={curY}
          stroke={isPos ? "var(--pos)" : "var(--neg)"} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.55" />
        {/* ена входа опциона */}
        {expiryY != null && (
          <line x1={0} y1={expiryY} x2={W} y2={expiryY}
            stroke="rgba(255,200,0,0.7)" strokeWidth="1" strokeDasharray="6 3" />
        )}
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

// ─── арточка активного опциона ───────────────────────────────────────────────
function ActiveOptionCard({ option, currentPrice }: { option: BinaryOption; currentPrice: number }) {
  const [remaining, setRemaining] = useState(option.expiresAt - Date.now());

  useEffect(() => {
    const iv = setInterval(() => setRemaining(option.expiresAt - Date.now()), 250);
    return () => clearInterval(iv);
  }, [option.expiresAt]);

  const isCall  = option.direction === "call";
  const winning = isCall ? currentPrice > option.openPrice : currentPrice < option.openPrice;
  const pnlNow  = winning ? option.stake * PAYOUT_RATE : -option.stake * PAYOUT_RATE;
  const pct     = Math.max(0, Math.min(100, (remaining / option.expiryMs) * 100));

  return (
    <div style={{
      background: "var(--surface-1)", border: `1px solid ${winning ? "var(--pos-border)" : "var(--neg-border)"}`,
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
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
          {fmtMs(remaining)}
        </span>
      </div>
      {/* прогресс */}
      <div style={{ height: 3, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: winning ? "var(--pos)" : "var(--neg)",
          borderRadius: 2, transition: "width 0.25s linear",
        }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px 8px", fontSize: 11 }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>Ставка</div>
          <div style={{ fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>${option.stake.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>ена входа</div>
          <div style={{ fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(option.openPrice)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>P&L сейчас</div>
          <div style={{ fontWeight: 700, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
            {fmtPnl(pnlNow)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── арточка истории опциона ─────────────────────────────────────────────────
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
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
          color: statusColor(option.status),
          background: option.status === "won" ? "var(--pos-dim)" : option.status === "lost" ? "var(--neg-dim)" : "var(--surface-2)",
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
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>ход</div>
          <div style={{ fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(option.openPrice)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-4)" }}>акрытие</div>
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

// ─── Статистика опционов ──────────────────────────────────────────────────────
function HistoryStats({ options }: { options: BinaryOption[] }) {
  const closed = options.filter(o => o.status !== "active");
  if (closed.length === 0) return null;
  const wins    = closed.filter(o => o.status === "won").length;
  const totalPnl = closed.reduce((s, o) => s + o.pnl, 0);
  const winRate = (wins / closed.length) * 100;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      background: "var(--surface-1)", border: "1px solid var(--line-1)",
      borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 10, gap: 4,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>обед</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--pos)" }}>{winRate.toFixed(0)}%</div>
        <div style={{ fontSize: 9, color: "var(--text-4)" }}>{wins}/{closed.length}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>сего P&L</div>
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

// ─── сновной экран ───────────────────────────────────────────────────────────
export function TradeScreen() {
  const { state, placeBinary } = useExchange();
  const { tradePair } = useRouter();

  const [pair,       setPair]       = useState(() => tradePair ?? "BTC/USDT");
  const [direction,  setDirection]  = useState<BinaryDirection>("call");
  const [stake,      setStake]      = useState("10");
  const [expiryIdx,  setExpiryIdx]  = useState(1);   // "1м" default
  const [candles,    setCandles]    = useState<Candle[]>(() => getCandles(pair, TF_CHART));
  const [showPicker, setShowPicker] = useState(false);
  const [toast,      setToast]      = useState<{msg:string;ok:boolean}|null>(null);
  const [bottomTab,  setBottomTab]  = useState<BottomTab>("active");

  const tk = state.tickers[pair];
  const usdt = state.assets["USDT"];

  // Синхронизируем пару при переходе с экрана ынки
  useEffect(() => { if (tradePair) setPair(tradePair); }, [tradePair]);

  // бновляем свечи
  useEffect(() => {
    setCandles(getCandles(pair, TF_CHART));
    const iv = setInterval(() => setCandles(getCandles(pair, TF_CHART)), 1000);
    return () => clearInterval(iv);
  }, [pair]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  function handlePlace() {
    const s = parseFloat(stake);
    if (!s || s <= 0) { showToast("кажите ставку", false); return; }
    const exp = EXPIRY_OPTIONS[expiryIdx]!;
    const r = placeBinary(pair, direction, s, exp.ms);
    if (r.ok) {
      showToast(`${direction === "call" ? "▲ CALL" : "▼ PUT"} размещён на ${exp.label}`, true);
      setBottomTab("active");
    } else {
      showToast(r.error ?? "шибка", false);
    }
  }

  const stakeNum = parseFloat(stake) || 0;
  const payout   = stakeNum * PAYOUT_RATE;
  const expLabel = EXPIRY_OPTIONS[expiryIdx]?.label ?? "1м";

  const pairOptions = useMemo(
    () => state.binaryOptions.filter(o => o.symbol === pair),
    [state.binaryOptions, pair],
  );
  const activeOptions  = pairOptions.filter(o => o.status === "active");
  const historyOptions = pairOptions.filter(o => o.status !== "active").slice().reverse();

  // лижайший активный опцион — рисуем линию цены входа на чарте
  const firstActive = activeOptions[0];
  const entryLine   = firstActive?.openPrice ?? null;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", background: "transparent", border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--accent)" : "var(--text-3)",
    fontSize: 11, fontWeight: active ? 600 : 400, cursor: "pointer",
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
              { label: "24ч акс", val: fmtPrice(tk.high24h), c: "var(--pos)" },
              { label: "24ч ин",  val: fmtPrice(tk.low24h),  c: "var(--neg)" },
              { label: "Bid",      val: fmtPrice(tk.bid),      c: "var(--pos)" },
              { label: "Ask",      val: fmtPrice(tk.ask),      c: "var(--neg)" },
              { label: "аланс",   val: `$${(usdt?.available ?? 0).toFixed(2)}` },
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

        {/* Свечной OHLC-чарт */}
        <CandleChart candles={candles} currentPrice={tk?.price ?? 0} change={tk?.change24h ?? 0} expiryLine={entryLine} />

        {/* ── анель торговли ── */}
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

          {/* кспирация */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 5 }}>СЯ</div>
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
            <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 5 }}>СТ (USDT)</div>
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

          {/* нфо о выплате */}
          {stakeNum > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              background: "var(--surface-2)", border: "1px solid var(--line-1)",
              borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 12, fontSize: 11,
            }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-4)" }}>Ставка</div>
                <div style={{ fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>${stakeNum.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "var(--text-4)" }}>ыигрыш +{(PAYOUT_RATE * 100).toFixed(0)}%</div>
                <div style={{ fontWeight: 700, color: "var(--pos)", fontVariantNumeric: "tabular-nums" }}>+${payout.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "var(--text-4)" }}>роигрыш −{(PAYOUT_RATE * 100).toFixed(0)}%</div>
                <div style={{ fontWeight: 700, color: "var(--neg)", fontVariantNumeric: "tabular-nums" }}>−${payout.toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* нопка разместить */}
          <button onClick={handlePlace} style={{
            width: "100%", padding: "13px", border: "none", borderRadius: "var(--r-md)",
            color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
            background: direction === "call"
              ? "linear-gradient(135deg,#31D0AA,#2aaf91)"
              : "linear-gradient(135deg,#FF5B6E,#d94456)",
            boxShadow: direction === "call"
              ? "0 4px 20px rgba(49,208,170,0.35)"
              : "0 4px 20px rgba(255,91,110,0.35)",
          }}>
            {direction === "call" ? `▲ CALL  ${expLabel}` : `▼ PUT  ${expLabel}`}
          </button>
        </div>

        {/* ── ижние табы ── */}
        <div style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-0)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line-1)" }}>
            {([
              { key: "active"  as BottomTab, label: `ктивные${activeOptions.length ? ` (${activeOptions.length})` : ""}` },
              { key: "history" as BottomTab, label: "стория" },
            ]).map(t => (
              <button key={t.key} onClick={() => setBottomTab(t.key)} style={tabStyle(bottomTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── ктивные опционы ── */}
        {bottomTab === "active" && (
          <div style={{ padding: "10px 12px", paddingBottom: "calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            {activeOptions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-4)", fontSize: 13 }}>
                ет активных опционов — сделайте первый CALL или PUT
              </div>
            ) : (
              activeOptions.map(o => (
                <ActiveOptionCard key={o.id} option={o} currentPrice={tk?.price ?? 0} />
              ))
            )}
          </div>
        )}

        {/* ── стория ── */}
        {bottomTab === "history" && (
          <div style={{ padding: "10px 12px", paddingBottom: "calc(10px + var(--nav-height) + var(--safe-bottom))" }}>
            <HistoryStats options={pairOptions} />
            {historyOptions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-4)", fontSize: 13 }}>
                стория пуста
              </div>
            ) : (
              historyOptions.map(o => <HistoryOptionCard key={o.id} option={o} />)
            )}
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
              <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700, color:"var(--text-1)" }}>ыбор пары</h3>
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
