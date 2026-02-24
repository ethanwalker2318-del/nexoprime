import { motion } from "framer-motion";
import { useState } from "react";
import { useI18n } from "../../app/providers/I18nProvider";
import { cx } from "../../shared/lib/cx";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const LOCALE_TAG: Record<string, string> = { ru: "ru-RU", en: "en-US", de: "de-DE" };

type Period = "7d" | "30d" | "90d";

const PNL_DATA: Record<Period, { date: string; pnl: number; cumulative: number }[]> = {
  "7d": [
    { date: "Feb 17", pnl: 1820, cumulative: 0 },
    { date: "Feb 18", pnl: -640, cumulative: 1820 },
    { date: "Feb 19", pnl: 2310, cumulative: 1180 },
    { date: "Feb 20", pnl: 980, cumulative: 3490 },
    { date: "Feb 21", pnl: -210, cumulative: 4470 },
    { date: "Feb 22", pnl: 3140, cumulative: 4260 },
    { date: "Feb 23", pnl: 1640, cumulative: 7400 }
  ],
  "30d": [
    { date: "Jan 24", pnl: 4200, cumulative: 0 },
    { date: "Jan 31", pnl: -1100, cumulative: 4200 },
    { date: "Feb 7", pnl: 6800, cumulative: 3100 },
    { date: "Feb 14", pnl: 2200, cumulative: 9900 },
    { date: "Feb 21", pnl: -800, cumulative: 12100 },
    { date: "Feb 23", pnl: 4120, cumulative: 11300 }
  ],
  "90d": [
    { date: "Nov", pnl: 12400, cumulative: 0 },
    { date: "Dec", pnl: -4200, cumulative: 12400 },
    { date: "Jan", pnl: 18200, cumulative: 8200 },
    { date: "Feb 1", pnl: 6100, cumulative: 26400 },
    { date: "Feb 15", pnl: -3200, cumulative: 32500 },
    { date: "Feb 23", pnl: 4120, cumulative: 29300 }
  ]
};

const RISK_METRICS = [
  { label: "Max Drawdown", value: "-8.4%", tone: "negative" as const },
  { label: "Sharpe Ratio", value: "1.82", tone: "positive" as const },
  { label: "Sortino Ratio", value: "2.41", tone: "positive" as const },
  { label: "Calmar Ratio", value: "3.07", tone: "positive" as const },
  { label: "Value at Risk (95%)", value: "-$4,210", tone: "negative" as const },
  { label: "Beta (BTC)", value: "0.72", tone: "neutral" as const }
];

const BEST_TRADES = [
  { asset: "BTC", entry: 62400, exit: 68547, size: 0.2, pnl: 1229.4, date: "Feb 20" },
  { asset: "ETH", entry: 3100, exit: 3428, size: 2.0, pnl: 656.0, date: "Feb 19" },
  { asset: "SOL", entry: 168, exit: 182, size: 12, pnl: 168.0, date: "Feb 22" }
];

const WORST_TRADES = [
  { asset: "BNB", entry: 640, exit: 612, size: 3, pnl: -84.0, date: "Feb 21" },
  { asset: "ETH", entry: 3450, exit: 3380, size: 1, pnl: -70.0, date: "Feb 18" }
];

function PnlChart({ data }: { data: typeof PNL_DATA["7d"] }) {
  const cumulativeValues = data.map((d) => d.cumulative + d.pnl);
  const maxV = Math.max(...cumulativeValues, 1);
  const minV = Math.min(...cumulativeValues, 0);
  const range = maxV - minV || 1;
  const w = 100;
  const h = 80;

  const pts = cumulativeValues.map((v, i) => {
    const x = (i / (cumulativeValues.length - 1)) * w;
    const y = h - ((v - minV) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${pts.join(" L ")}`;
  const areaD = `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`;
  const isPositive = cumulativeValues[cumulativeValues.length - 1]! >= 0;
  const color = isPositive ? "#27b36a" : "#ef5d6d";

  return (
    <svg width="100%" height="80" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="pnl-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#pnl-area)" />
      <path d={pathD} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {cumulativeValues.map((v, i) => {
        const pt = pts[i]!.split(",");
        return (
          <circle key={i} cx={parseFloat(pt[0]!)} cy={parseFloat(pt[1]!)} r="2.5"
            fill={v === Math.max(...cumulativeValues) ? color : "rgba(14,26,46,0.9)"}
            stroke={color} strokeWidth="1.2" />
        );
      })}
    </svg>
  );
}

function formatCurrency(v: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

export function AnalyticsScreen() {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<Period>("30d");
  const localeTag = LOCALE_TAG[locale] ?? "en-US";
  const pnlData = PNL_DATA[period];
  const totalPnl = pnlData.reduce((sum, d) => sum + d.pnl, 0);
  const totalPnlPct = 5.82;

  return (
    <main className="dashboard-shell pb-24">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 pt-5 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="institution-card p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="brand-emblem">
                <ChartGlyph />
              </span>
              <div>
                <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-textPrimary">{t("analytics.title")}</h1>
                <p className="text-xs text-textSecondary">{t("analytics.subtitle")}</p>
              </div>
            </div>
            <div className="flex gap-1 rounded-[10px] border border-soft p-0.5" style={{ background: "rgba(11,20,35,0.7)" }}>
              {(["7d", "30d", "90d"] as Period[]).map((p) => (
                <button key={p} type="button" onClick={() => setPeriod(p)}
                  className={cx("rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                    period === p ? "bg-trust/20 text-trust" : "text-textSecondary hover:text-textPrimary")}
                >{p}</button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* P&L Summary */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.06, ease: EASE }}
          className="institution-card p-5"
        >
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-textSecondary">{t("analytics.pnl.total")} ({period})</p>
              <p className={cx("mt-1 font-display text-[2.2rem] font-semibold leading-[1.1] tracking-[-0.03em] tabular-nums",
                totalPnl >= 0 ? "text-profit" : "text-loss")}>
                {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl, localeTag)}
              </p>
            </div>
            <span className={cx("rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums",
              totalPnl >= 0 ? "border-profit/30 bg-profit/12 text-profit" : "border-loss/30 bg-loss/12 text-loss")}>
              {totalPnl >= 0 ? "+" : ""}{totalPnlPct}%
            </span>
          </div>
          <div className="rounded-[12px] border border-soft bg-slate-900/30 p-3">
            <PnlChart data={pnlData} />
            <div className="mt-2 flex justify-between overflow-x-auto">
              {pnlData.map((d) => (
                <span key={d.date} className="text-[10px] text-textSecondary whitespace-nowrap px-1">{d.date}</span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Key Metrics */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12, ease: EASE }}
          className="institution-card p-5"
        >
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-textPrimary">{t("analytics.metrics.title")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: t("dashboard.analytics.winRate"), value: "68.4%", tone: "positive" as const },
              { label: t("dashboard.analytics.avgProfit"), value: "+4.72%", tone: "positive" as const },
              { label: t("dashboard.analytics.avgLoss"), value: "−1.38%", tone: "negative" as const },
              { label: t("dashboard.analytics.profitFactor"), value: "2.14×", tone: "neutral" as const }
            ].map((metric) => (
              <div key={metric.label} className="rounded-[12px] border border-soft bg-slate-900/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-textSecondary">{metric.label}</p>
                <p className={cx("mt-2 text-xl font-semibold tabular-nums",
                  metric.tone === "positive" ? "text-profit" : metric.tone === "negative" ? "text-loss" : "text-textPrimary")}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Daily P&L breakdown */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.16, ease: EASE }}
          className="institution-card p-5"
        >
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-textPrimary">{t("analytics.pnl.breakdown")}</h2>
          <div className="space-y-1.5">
            {pnlData.map((d, i) => {
              const barPct = Math.min(Math.abs(d.pnl) / 3200 * 100, 100);
              return (
                <motion.div
                  key={`${d.date}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16, delay: i * 0.04, ease: EASE }}
                  className="flex items-center gap-3"
                >
                  <span className="w-16 shrink-0 text-[11px] text-textSecondary">{d.date}</span>
                  <div className="relative flex-1 h-2 rounded-full bg-slate-900/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 + 0.2, ease: EASE }}
                      className={cx("absolute left-0 top-0 h-full rounded-full", d.pnl >= 0 ? "bg-profit/70" : "bg-loss/70")}
                    />
                  </div>
                  <span className={cx("w-20 shrink-0 text-right text-xs font-semibold tabular-nums",
                    d.pnl >= 0 ? "text-profit" : "text-loss")}>
                    {d.pnl >= 0 ? "+" : ""}{formatCurrency(d.pnl, localeTag)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Risk Metrics */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.20, ease: EASE }}
          className="institution-card p-5"
        >
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-textPrimary">{t("analytics.risk.title")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {RISK_METRICS.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between rounded-[10px] border border-soft bg-slate-900/30 px-3 py-2.5">
                <span className="text-xs text-textSecondary">{metric.label}</span>
                <span className={cx("text-sm font-semibold tabular-nums",
                  metric.tone === "positive" ? "text-profit" : metric.tone === "negative" ? "text-loss" : "text-textPrimary")}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Best / Worst trades */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.24, ease: EASE }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <section className="institution-card p-5">
            <h2 className="mb-3 text-[15px] font-semibold text-profit">{t("analytics.trades.best")}</h2>
            <div className="space-y-2">
              {BEST_TRADES.map((trade) => (
                <div key={`${trade.asset}-${trade.date}`} className="flex items-center justify-between rounded-[10px] border border-profit/15 bg-profit/6 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-textPrimary">{trade.asset}</p>
                    <p className="text-[11px] text-textSecondary">{trade.date} · ×{trade.size}</p>
                  </div>
                  <p className="text-sm font-semibold text-profit">+{formatCurrency(trade.pnl, localeTag)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="institution-card p-5">
            <h2 className="mb-3 text-[15px] font-semibold text-loss">{t("analytics.trades.worst")}</h2>
            <div className="space-y-2">
              {WORST_TRADES.map((trade) => (
                <div key={`${trade.asset}-${trade.date}`} className="flex items-center justify-between rounded-[10px] border border-loss/15 bg-loss/6 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-textPrimary">{trade.asset}</p>
                    <p className="text-[11px] text-textSecondary">{trade.date} · ×{trade.size}</p>
                  </div>
                  <p className="text-sm font-semibold text-loss">{formatCurrency(trade.pnl, localeTag)}</p>
                </div>
              ))}
            </div>
          </section>
        </motion.div>
      </div>
    </main>
  );
}

function ChartGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="3,17 9,11 13,15 21,7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 7h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
