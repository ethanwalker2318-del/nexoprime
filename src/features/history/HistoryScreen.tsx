import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";
import { getTradeStats } from "../../shared/api/client";
import type { TradeStats } from "../../shared/api/client";
import type { BinaryOption, BinaryStatus } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Filter = "all" | "won" | "lost" | "draw";

function fmt(n: number, d = 2) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return n.toLocaleString("ru-RU", { maximumFractionDigits: d });
  return n.toFixed(d);
}
function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${fmt(Math.abs(n), 2)}`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function statusLabel(s: BinaryStatus) {
  return s === "won" ? "Выигрыш" : s === "lost" ? "Проигрыш" : s === "draw" ? "Ничья" : "Активен";
}
function statusColor(s: BinaryStatus) {
  return s === "won" ? "var(--pos)" : s === "lost" ? "var(--neg)" : s === "active" ? "var(--accent)" : "var(--text-4)";
}

export function HistoryScreen() {
  const { state } = useExchange();
  const { navigate } = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [stats, setStats] = useState<TradeStats | null>(null);

  useEffect(() => {
    getTradeStats().then(setStats).catch(() => {});
  }, []);

  const settledOptions = useMemo(() =>
    state.binaryOptions
      .filter(o => o.status !== "active")
      .sort((a, b) => b.createdAt - a.createdAt),
    [state.binaryOptions]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return settledOptions;
    return settledOptions.filter(o => o.status === filter);
  }, [settledOptions, filter]);

  // group by date
  const grouped = useMemo(() => {
    const map = new Map<string, BinaryOption[]>();
    for (const o of filtered) {
      const key = fmtDate(o.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totalPnlFiltered = useMemo(() =>
    filtered.reduce((s, o) => s + o.pnl, 0),
    [filtered]
  );

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "won", label: "Победы" },
    { key: "lost", label: "Проигрыши" },
    { key: "draw", label: "Ничьи" },
  ];

  return (
    <div style={{ padding: "12px 14px 24px", minHeight: "100%" }}>

      {/* ── Header ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}
      >
        <button
          onClick={() => navigate("home")}
          style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", flex: 1 }}>
          История сделок
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {settledOptions.length} всего
        </div>
      </motion.div>

      {/* ── Summary Card ───────────────────── */}
      {stats && stats.totalTrades > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: EASE }}
          style={{
            background: "var(--surface-1)", border: "1px solid var(--line-1)",
            borderRadius: 14, padding: 16, marginBottom: 14,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <SummaryCell label="Сделок" value={String(stats.totalTrades)} />
            <SummaryCell label="Побед" value={`${stats.wins}`} color="var(--pos)" />
            <SummaryCell label="Проигр." value={`${stats.losses}`} color="var(--neg)" />
            <SummaryCell label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? "var(--pos)" : "var(--neg)"} />
          </div>
          <div style={{ height: 1, background: "var(--line-1)", margin: "12px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <SummaryCell
              label="Общий P&L"
              value={fmtPnl(stats.totalPnl)}
              color={stats.totalPnl >= 0 ? "var(--pos)" : "var(--neg)"}
            />
            <SummaryCell label="Средняя ставка" value={`$${fmt(stats.avgStake, 0)}`} />
            <SummaryCell
              label="Серия"
              value={stats.currentStreak > 0 ? `${stats.currentStreak} ${stats.streakType === "win" ? "W" : "L"}` : "—"}
              color={stats.streakType === "win" ? "var(--pos)" : stats.streakType === "loss" ? "var(--neg)" : undefined}
            />
          </div>
        </motion.div>
      )}

      {/* ── Filter tabs ────────────────────── */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 14, padding: 3,
        background: "var(--surface-2)", borderRadius: 10,
        border: "1px solid var(--line-1)",
      }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flex: 1, padding: "7px 4px", borderRadius: 8,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "none",
              background: filter === f.key ? "var(--accent)" : "transparent",
              color: filter === f.key ? "#fff" : "var(--text-3)",
              transition: "all 0.15s ease",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Filtered summary ───────────────── */}
      {filtered.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 10, padding: "0 2px",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-4)" }}>
            {filtered.length} {filter === "all" ? "сделок" : filter === "won" ? "побед" : filter === "lost" ? "проигрышей" : "ничьих"}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: totalPnlFiltered >= 0 ? "var(--pos)" : "var(--neg)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {fmtPnl(totalPnlFiltered)}
          </div>
        </div>
      )}

      {/* ── Trade list ─────────────────────── */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: "40px 16px", textAlign: "center",
            background: "var(--surface-1)", borderRadius: 12,
            border: "1px solid var(--line-1)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>
            {filter === "all" ? "Нет завершённых сделок" : `Нет сделок с результатом "${FILTERS.find(f => f.key === filter)?.label}"`}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>
            Откройте торговлю и совершите первую сделку
          </div>
          <button
            onClick={() => navigate("trade")}
            style={{
              marginTop: 14, padding: "8px 20px", borderRadius: 8,
              background: "var(--accent)", color: "#fff", border: "none",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Начать торговлю
          </button>
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {grouped.map(([date, trades]) => (
            <div key={date}>
              <div style={{
                fontSize: 11, color: "var(--text-4)", fontWeight: 600,
                marginBottom: 6, letterSpacing: 0.3,
              }}>
                {date}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <AnimatePresence>
                  {trades.map((o, i) => (
                    <motion.div
                      key={o.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15, delay: i * 0.02, ease: EASE }}
                    >
                      <TradeRow option={o} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function TradeRow({ option }: { option: BinaryOption }) {
  const [expanded, setExpanded] = useState(false);
  const isCall = option.direction === "call";

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: "var(--surface-1)", borderRadius: 10,
        border: "1px solid var(--line-1)", cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {/* Main row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
          background: isCall ? "rgba(49,208,170,0.12)" : "rgba(255,91,110,0.12)",
          color: isCall ? "var(--pos)" : "var(--neg)",
          border: `1px solid ${isCall ? "rgba(49,208,170,0.3)" : "rgba(255,91,110,0.3)"}`,
        }}>
          {isCall ? "CALL ▲" : "PUT ▼"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</div>
          <div style={{ fontSize: 10, color: "var(--text-4)" }}>{fmtTime(option.createdAt)}</div>
        </div>
        <div style={{
          padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
          background: option.status === "won" ? "rgba(49,208,170,0.1)" : option.status === "lost" ? "rgba(255,91,110,0.1)" : "var(--surface-2)",
          color: statusColor(option.status),
          border: `1px solid ${option.status === "won" ? "rgba(49,208,170,0.2)" : option.status === "lost" ? "rgba(255,91,110,0.2)" : "var(--line-1)"}`,
        }}>
          {statusLabel(option.status)}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 55 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: option.pnl >= 0 ? "var(--pos)" : "var(--neg)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {fmtPnl(option.pnl)}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-4)" }}>${option.stake.toFixed(0)}</div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "0 12px 10px",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px",
              borderTop: "1px solid var(--line-1)", paddingTop: 10,
            }}>
              <DetailCell label="Ставка" value={`$${option.stake.toFixed(2)}`} />
              <DetailCell label="P&L" value={fmtPnl(option.pnl)} color={option.pnl >= 0 ? "var(--pos)" : "var(--neg)"} />
              <DetailCell label="Цена входа" value={`$${option.openPrice.toFixed(option.openPrice > 100 ? 2 : 6)}`} />
              <DetailCell label="Цена выхода" value={option.closePrice ? `$${option.closePrice.toFixed(option.closePrice > 100 ? 2 : 6)}` : "—"} />
              <DetailCell label="Направление" value={isCall ? "CALL ▲" : "PUT ▼"} color={isCall ? "var(--pos)" : "var(--neg)"} />
              <DetailCell label="Длительность" value={formatDuration(option.expiryMs)} />
              <DetailCell label="Открытие" value={`${fmtDate(option.createdAt)} ${fmtTime(option.createdAt)}`} />
              <DetailCell label="Закрытие" value={`${fmtDate(option.expiresAt)} ${fmtTime(option.expiresAt)}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--text-4)" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color ?? "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}м`;
  return `${Math.floor(m / 60)}ч ${m % 60}м`;
}
