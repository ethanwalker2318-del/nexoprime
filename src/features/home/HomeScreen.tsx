import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";
import { getTradeStats } from "../../shared/api/client";
import type { TradeStats } from "../../shared/api/client";
import type { BinaryOption, BinaryStatus } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function fmt(n: number, digits = 2) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return n.toLocaleString("ru-RU", { maximumFractionDigits: digits });
  return n.toFixed(digits);
}
function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${fmt(Math.abs(n), 2)}`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}
function statusLabel(s: BinaryStatus) {
  return s === "active" ? "Активен" : s === "won" ? "Выигрыш" : s === "lost" ? "Проигрыш" : "Ничья";
}
function statusColor(s: BinaryStatus) {
  return s === "won" ? "var(--pos)" : s === "lost" ? "var(--neg)" : s === "active" ? "var(--accent)" : "var(--text-4)";
}
function declTrades(n: number): string {
  const m = n % 100;
  if (m >= 11 && m <= 19) return "сделок";
  const d = m % 10;
  if (d === 1) return "сделка";
  if (d >= 2 && d <= 4) return "сделки";
  return "сделок";
}

// Icons
const IconTrade = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="4" height="10" rx="1"/><rect x="10" y="7" width="4" height="15" rx="1"/><rect x="18" y="4" width="4" height="12" rx="1"/><line x1="3" y1="22" x2="21" y2="22"/>
  </svg>
);
const IconDeposit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>
  </svg>
);
const IconWithdraw = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>
  </svg>
);
const IconHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// Mini win-rate ring
function WinRateRing({ rate, size = 48 }: { rate: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - rate / 100);
  return (
    <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-1)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={rate >= 50 ? "var(--pos)" : "var(--neg)"}
        strokeWidth={4} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
    </svg>
  );
}

export function HomeScreen() {
  const { state, totalUSDT } = useExchange();
  const { navigate } = useRouter();

  const [hidden, setHidden] = useState(false);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    setTotalBalance(totalUSDT());
  }, [state.tickers, state.assets, totalUSDT]);

  // Load trade stats from server
  useEffect(() => {
    const load = () => { getTradeStats().then(setStats).catch(() => {}); };
    load();
    const iv = setInterval(load, 30_000);
    const onRefresh = () => { setTimeout(load, 2000); };
    window.addEventListener("nexo:force-profile-refresh", onRefresh);
    return () => { clearInterval(iv); window.removeEventListener("nexo:force-profile-refresh", onRefresh); };
  }, []);

  const activeOptions = useMemo(() =>
    state.binaryOptions.filter(o => o.status === "active").sort((a, b) => a.expiresAt - b.expiresAt),
    [state.binaryOptions]
  );
  const recentSettled = useMemo(() =>
    state.binaryOptions
      .filter(o => o.status !== "active")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5),
    [state.binaryOptions]
  );

  const firstName = state.profile?.firstName || state.profile?.username || "Trader";
  const pnl24h = stats?.pnl24h ?? 0;
  const isPnlPos = pnl24h >= 0;

  // helper for navigate to screens not in strict type
  const nav = navigate as (s: string) => void;

  return (
    <div style={{ padding: "12px 14px 24px", minHeight: "100%" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--text-3)", letterSpacing: 0.3 }}>Добро пожаловать</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", letterSpacing: -0.3 }}>{firstName}</div>
        </div>
        <div style={{
          padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 600,
          background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)",
        }}>
          NEXO PRIME
        </div>
      </motion.div>

      {/* ── Balance Card ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: EASE }}
        style={{
          background: "linear-gradient(145deg, rgba(14,30,58,0.95) 0%, rgba(12,20,40,0.98) 100%)",
          borderRadius: 16, padding: "20px 18px", marginBottom: 12,
          border: "1px solid var(--line-1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 60px rgba(77,163,255,0.05)",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle,rgba(77,163,255,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />

        <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 1, marginBottom: 6 }}>ОБЩИЙ БАЛАНС</div>
        <div
          onClick={() => setHidden(h => !h)}
          style={{ fontSize: 30, fontWeight: 800, color: "var(--text-1)", letterSpacing: -0.5, cursor: "pointer", userSelect: "none", fontVariantNumeric: "tabular-nums" }}
        >
          {hidden ? "•••••••" : `$${fmt(totalBalance, 2)}`}
        </div>

        {/* P&L 24h */}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: isPnlPos ? "rgba(49,208,170,0.12)" : "rgba(255,91,110,0.12)",
            border: `1px solid ${isPnlPos ? "rgba(49,208,170,0.25)" : "rgba(255,91,110,0.25)"}`,
            color: isPnlPos ? "var(--pos)" : "var(--neg)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {isPnlPos ? "▲ " : "▼ "}{fmtPnl(pnl24h)} (24ч)
          </div>
          {stats && stats.trades24h > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-4)" }}>
              {stats.trades24h} {declTrades(stats.trades24h)} за день
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => navigate("wallet")} style={btnStyle("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>Пополнить</button>
          <button onClick={() => navigate("wallet")} style={btnStyle("var(--surface-3)", "var(--line-2)", "var(--text-2)")}>Вывести</button>
        </div>
      </motion.div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {([
          { label: "Торговля", Icon: IconTrade,    screen: "trade",   color: "var(--accent)" },
          { label: "Пополнить",Icon: IconDeposit,  screen: "wallet",  color: "var(--pos)" },
          { label: "Вывести",  Icon: IconWithdraw, screen: "wallet",  color: "var(--neg)" },
          { label: "История",  Icon: IconHistory,  screen: "history", color: "var(--text-2)" },
        ] as const).map((a, i) => (
          <motion.button
            key={a.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.04 * i, ease: EASE }}
            onClick={() => nav(a.screen)}
            style={{
              background: "var(--surface-1)", border: "1px solid var(--line-1)",
              borderRadius: 12, padding: "12px 4px",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 5, cursor: "pointer",
            }}
          >
            <span style={{ color: a.color }}><a.Icon /></span>
            <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 500 }}>{a.label}</span>
          </motion.button>
        ))}
      </div>

      {/* ── Trade Stats ────────────────────────────────────────────────── */}
      {stats && stats.totalTrades > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: EASE }}
          style={{
            background: "var(--surface-1)", border: "1px solid var(--line-1)",
            borderRadius: 14, padding: 16, marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>
            Торговая статистика
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <WinRateRing rate={stats.winRate} size={56} />
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: stats.winRate >= 50 ? "var(--pos)" : "var(--neg)",
              }}>
                {stats.winRate}%
              </div>
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              <StatCell label="Общий P&L" value={fmtPnl(stats.totalPnl)} color={stats.totalPnl >= 0 ? "var(--pos)" : "var(--neg)"} />
              <StatCell label="Всего сделок" value={String(stats.totalTrades)} />
              <StatCell label="Побед" value={`${stats.wins}`} color="var(--pos)" />
              <StatCell label="Проигрышей" value={`${stats.losses}`} color="var(--neg)" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <MiniCard label="Средняя ставка" value={`$${fmt(stats.avgStake, 0)}`} />
            <MiniCard
              label="Серия"
              value={stats.currentStreak > 0 ? `${stats.currentStreak} ${stats.streakType === "win" ? "побед" : "пораж."}` : "—"}
              color={stats.streakType === "win" ? "var(--pos)" : stats.streakType === "loss" ? "var(--neg)" : undefined}
            />
            <MiniCard label="P&L 24ч" value={fmtPnl(stats.pnl24h)} color={stats.pnl24h >= 0 ? "var(--pos)" : "var(--neg)"} />
          </div>
          {(stats.bestTrade || stats.worstTrade) && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {stats.bestTrade && (
                <div style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "rgba(49,208,170,0.06)", border: "1px solid rgba(49,208,170,0.15)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Лучший трейд</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pos)" }}>{fmtPnl(stats.bestTrade.pnl)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>{stats.bestTrade.symbol} · ${fmt(stats.bestTrade.amount, 0)}</div>
                </div>
              )}
              {stats.worstTrade && (
                <div style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "rgba(255,91,110,0.06)", border: "1px solid rgba(255,91,110,0.15)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>Худший трейд</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--neg)" }}>{fmtPnl(stats.worstTrade.pnl)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>{stats.worstTrade.symbol} · ${fmt(stats.worstTrade.amount, 0)}</div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Active Trades ──────────────────────────────────────────────── */}
      {activeOptions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: EASE }}
          style={{ marginBottom: 16 }}
        >
          <HomeSectionHeader title={`Активные сделки (${activeOptions.length})`} action="Торговля" onAction={() => navigate("trade")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {activeOptions.slice(0, 3).map(o => (
              <ActiveTradeRow key={o.id} option={o} currentPrice={state.tickers[o.symbol]?.price ?? 0} onTap={() => navigate("trade")} />
            ))}
            {activeOptions.length > 3 && (
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--accent)", cursor: "pointer", padding: 6 }}
                onClick={() => navigate("trade")}>
                ещё {activeOptions.length - 3}...
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Recent Settled ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease: EASE }}
      >
        <HomeSectionHeader title="Последние сделки" action="Вся история" onAction={() => nav("history")} />
        {recentSettled.length === 0 ? (
          <EmptyState icon="📊" text="Нет завершённых сделок" sub="Сделайте первый CALL или PUT в торговле" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recentSettled.map(o => <HistoryRow key={o.id} option={o} />)}
          </div>
        )}
      </motion.div>

      {/* ── Assets ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25, ease: EASE }}
        style={{ marginTop: 16 }}
      >
        <HomeSectionHeader title="Мои активы" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.values(state.assets)
            .filter(a => (a.available + a.locked) > 0.01)
            .map(asset => {
              const total = asset.available + asset.locked;
              const tk = state.tickers[`${asset.symbol}/USDT`];
              const usdtVal = asset.symbol === "USDT" ? total : total * (tk?.price ?? 0);
              return (
                <div key={asset.symbol} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px", background: "var(--surface-1)",
                  borderRadius: 10, border: "1px solid var(--line-1)",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
                  }}>
                    {asset.symbol.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{asset.symbol}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {total < 0.0001 ? "0" : total < 1 ? total.toPrecision(4) : fmt(total, 4)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
                      ${fmt(usdtVal, 2)}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HomeSectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", letterSpacing: 0.1 }}>{title}</div>
      {action && onAction && (
        <button onClick={onAction} style={{
          background: "none", border: "none", color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}>
          {action} →
        </button>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: "8px 8px", borderRadius: 8,
      background: "var(--surface-2)", border: "1px solid var(--line-1)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 9, color: "var(--text-4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: color ?? "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div style={{
      padding: "28px 16px", textAlign: "center",
      background: "var(--surface-1)", borderRadius: 12,
      border: "1px solid var(--line-1)",
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>{text}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ActiveTradeRow({ option, currentPrice, onTap }: { option: BinaryOption; currentPrice: number; onTap: () => void }) {
  const [remaining, setRemaining] = useState(option.expiresAt - Date.now());
  useEffect(() => {
    const iv = setInterval(() => setRemaining(option.expiresAt - Date.now()), 250);
    return () => clearInterval(iv);
  }, [option.expiresAt]);

  const isCall = option.direction === "call";
  const winning = isCall ? currentPrice > option.openPrice : currentPrice < option.openPrice;
  const secs = Math.max(0, Math.floor(remaining / 1000));
  const m = Math.floor(secs / 60), s = secs % 60;
  const timeStr = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}с`;
  const pnlNow = winning ? option.stake * 0.8 : -option.stake;

  return (
    <div onClick={onTap} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", background: "var(--surface-1)", borderRadius: 10,
      border: `1px solid ${winning ? "rgba(49,208,170,0.2)" : "rgba(255,91,110,0.2)"}`,
      cursor: "pointer",
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
        background: isCall ? "rgba(49,208,170,0.12)" : "rgba(255,91,110,0.12)",
        color: isCall ? "var(--pos)" : "var(--neg)",
        border: `1px solid ${isCall ? "rgba(49,208,170,0.3)" : "rgba(255,91,110,0.3)"}`,
      }}>
        {isCall ? "▲" : "▼"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</div>
        <div style={{ fontSize: 10, color: "var(--text-3)" }}>${option.stake.toFixed(2)}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: winning ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
          {timeStr}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: winning ? "var(--pos)" : "var(--neg)" }}>
          {pnlNow >= 0 ? "+" : ""}${Math.abs(pnlNow).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ option }: { option: BinaryOption }) {
  const isCall = option.direction === "call";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", background: "var(--surface-1)", borderRadius: 10,
      border: "1px solid var(--line-1)",
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
        background: isCall ? "rgba(49,208,170,0.12)" : "rgba(255,91,110,0.12)",
        color: isCall ? "var(--pos)" : "var(--neg)",
        border: `1px solid ${isCall ? "rgba(49,208,170,0.3)" : "rgba(255,91,110,0.3)"}`,
      }}>
        {isCall ? "▲" : "▼"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{option.symbol}</div>
        <div style={{ fontSize: 10, color: "var(--text-4)" }}>{fmtDate(option.createdAt)} {fmtTime(option.createdAt)}</div>
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
        <div style={{ fontSize: 12, fontWeight: 700, color: option.pnl >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
          {fmtPnl(option.pnl)}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-4)" }}>${option.stake.toFixed(0)}</div>
      </div>
    </div>
  );
}

function btnStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    flex: 1, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
    background: bg, border: `1px solid ${border}`, color,
    fontSize: 12, fontWeight: 600,
  };
}


