import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";
import type { Ticker } from "../../shared/store/mockEngine";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type SortKey = "vol" | "change" | "price";

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  if (n >= 1)     return n.toFixed(2);
  return n.toPrecision(4);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

function MiniChart({ values, pos }: { values: number[]; pos: boolean }) {
  if (values.length < 2) return <div style={{ width: 60 }} />;
  const w = 60, h = 24;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.85 - h * 0.075;
    return `${x},${y}`;
  }).join(" ");
  const color = pos ? "var(--pos)" : "var(--neg)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketsScreen() {
  const { state } = useExchange();
  const { navigateToTrade } = useRouter();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("vol");
  const [sortAsc, setSortAsc] = useState(false);

  const tickers = Object.values(state.tickers);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tickers
      .filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.base.toLowerCase().includes(q))
      .sort((a, b) => {
        let av = 0, bv = 0;
        if (sortKey === "vol")    { av = a.vol24h;    bv = b.vol24h; }
        if (sortKey === "change") { av = Math.abs(a.change24h); bv = Math.abs(b.change24h); }
        if (sortKey === "price")  { av = a.price;     bv = b.price; }
        return sortAsc ? av - bv : bv - av;
      });
  }, [tickers, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        padding: "14px 16px 0",
        background: "var(--bg-0)",
      }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>
          Рынки
        </h1>

        {/* Поиск */}
        <div style={{
          position: "relative", marginBottom: 12,
        }}>
          <svg
            style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-3)", pointerEvents: "none",
            }}
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Поиск пары..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px 10px 36px",
              background: "var(--surface-1)", border: "1px solid var(--line-1)",
              borderRadius: "var(--r-md)", color: "var(--text-1)",
              fontSize: 14, outline: "none",
            }}
          />
        </div>

        {/* Сортировка */}
        <div style={{
          display: "flex", borderBottom: "1px solid var(--line-1)",
          marginLeft: -16, marginRight: -16, paddingLeft: 16,
        }}>
          {(["vol", "change", "price"] as SortKey[]).map((key) => {
            const labels: Record<SortKey, string> = { vol: "Объём", change: "Изменение", price: "Цена" };
            const active = sortKey === key;
            return (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                style={{
                  background: "none", border: "none", padding: "8px 12px",
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? "var(--accent)" : "var(--text-3)",
                  cursor: "pointer",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                  transition: "color var(--dur-fast)",
                }}
              >
                {labels[key]}{sortArrow(key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Список */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-4)", fontSize: 13 }}>
            Ничего не найдено
          </div>
        ) : filtered.map((tk, i) => (
          <TickerRow
            key={tk.symbol}
            ticker={tk}
            index={i}
            onClick={() => navigateToTrade(tk.symbol)}
          />
        ))}
      </div>
    </div>
  );
}

function TickerRow({ ticker, index, onClick }: { ticker: Ticker; index: number; onClick: () => void }) {
  const pos = ticker.change24h >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.2), ease: EASE }}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid var(--line-1)",
        cursor: "pointer",
      }}
    >
      {/* Иконка */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "var(--surface-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: "var(--text-2)",
        flexShrink: 0,
      }}>
        {ticker.base.slice(0, 2)}
      </div>

      {/* Пара + объём */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
          {ticker.base}
          <span style={{ color: "var(--text-3)", fontWeight: 400 }}>/{ticker.quote}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-4)" }}>
          Vol ${fmtVol(ticker.vol24h)}
        </div>
      </div>

      {/* Мини-график */}
      <MiniChart values={ticker.history.slice(-20)} pos={pos} />

      {/* Цена + изменение */}
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
          {fmtPrice(ticker.price)}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: pos ? "var(--pos)" : "var(--neg)",
          background: pos ? "var(--pos-dim)" : "var(--neg-dim)",
          borderRadius: 6, padding: "2px 6px", display: "inline-block",
        }}>
          {pos ? "+" : ""}{ticker.change24h.toFixed(2)}%
        </div>
      </div>
    </motion.div>
  );
}
