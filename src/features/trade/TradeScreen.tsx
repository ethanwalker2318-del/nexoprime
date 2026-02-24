import { motion } from "framer-motion";
import { useState } from "react";
import { useI18n } from "../../app/providers/I18nProvider";
import { cx } from "../../shared/lib/cx";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface MarketAsset {
  code: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: string;
  volume24h: string;
  color: string;
  sparkline: number[];
  userBalance: number;
  avgBuyPrice: number;
}

interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
}

const MARKET: MarketAsset[] = [
  {
    code: "BTC",
    name: "Bitcoin",
    price: 68_547.2,
    change24h: 2.41,
    marketCap: "$1.35T",
    volume24h: "$42.8B",
    color: "#f59e0b",
    sparkline: [64100, 65200, 63800, 66100, 67200, 65900, 67800, 68200, 67100, 68547],
    userBalance: 0.7421,
    avgBuyPrice: 62_400
  },
  {
    code: "ETH",
    name: "Ethereum",
    price: 3_428.91,
    change24h: 1.62,
    marketCap: "$412B",
    volume24h: "$18.2B",
    color: "#60a5fa",
    sparkline: [3100, 3180, 3050, 3210, 3310, 3240, 3380, 3420, 3350, 3429],
    userBalance: 5.3819,
    avgBuyPrice: 3_100
  },
  {
    code: "USDT",
    name: "Tether",
    price: 1.0,
    change24h: 0.02,
    marketCap: "$118B",
    volume24h: "$55.6B",
    color: "#14b8a6",
    sparkline: [1.001, 0.999, 1.000, 1.001, 0.999, 1.000, 1.001, 1.000, 0.999, 1.000],
    userBalance: 32_140.55,
    avgBuyPrice: 1.0
  },
  {
    code: "SOL",
    name: "Solana",
    price: 182.44,
    change24h: -0.88,
    marketCap: "$86B",
    volume24h: "$4.1B",
    color: "#a78bfa",
    sparkline: [172, 178, 171, 180, 183, 179, 184, 181, 183, 182],
    userBalance: 0,
    avgBuyPrice: 0
  },
  {
    code: "BNB",
    name: "BNB",
    price: 612.38,
    change24h: 0.55,
    marketCap: "$89B",
    volume24h: "$1.9B",
    color: "#fbbf24",
    sparkline: [589, 595, 588, 600, 608, 604, 610, 609, 613, 612],
    userBalance: 0,
    avgBuyPrice: 0
  }
];

const BTC_ORDER_BOOK: OrderBook = {
  bids: [
    [68540.00, 0.182],
    [68530.00, 0.443],
    [68520.00, 0.821],
    [68510.00, 1.204],
    [68500.00, 2.011]
  ],
  asks: [
    [68550.00, 0.241],
    [68560.00, 0.519],
    [68570.00, 0.714],
    [68580.00, 1.088],
    [68590.00, 1.543]
  ]
};

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 72;
  const h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  const areaD = `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`;
  const color = positive ? "#27b36a" : "#ef5d6d";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${positive})`} />
      <path d={pathD} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatCurrency(v: number, localeTag: string, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits }).format(v);
}

const LOCALE_TAG: Record<string, string> = { ru: "ru-RU", en: "en-US", de: "de-DE" };

export function TradeScreen() {
  const { t, locale } = useI18n();
  const [activeAsset, setActiveAsset] = useState<MarketAsset>(MARKET[0]!);
  const [activeTab, setActiveTab] = useState<"market" | "portfolio">("market");
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [orderAmount, setOrderAmount] = useState("");

  const localeTag = LOCALE_TAG[locale] ?? "en-US";
  const pnl = activeAsset.userBalance > 0
    ? (activeAsset.price - activeAsset.avgBuyPrice) * activeAsset.userBalance
    : 0;
  const pnlPercent = activeAsset.avgBuyPrice > 0
    ? ((activeAsset.price - activeAsset.avgBuyPrice) / activeAsset.avgBuyPrice) * 100
    : 0;

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
                <TradeGlyph />
              </span>
              <div>
                <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-textPrimary">{t("trade.title")}</h1>
                <p className="text-xs text-textSecondary">{t("trade.subtitle")}</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-profit/25 bg-profit/10 px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-profit">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-profit" />
              {t("common.live")}
            </span>
          </div>
        </motion.div>

        {/* Tab toggle */}
        <div className="flex gap-1 rounded-[14px] border border-soft p-1" style={{ background: "rgba(11,20,35,0.7)" }}>
          {(["market", "portfolio"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={cx("flex-1 rounded-[10px] px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150",
                activeTab === tab ? "bg-trust/20 text-trust" : "text-textSecondary hover:text-textPrimary")}
            >{t(`trade.tab.${tab}`)}</button>
          ))}
        </div>

        {activeTab === "market" ? (
          <motion.div
            key="market"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="space-y-3"
          >
            {/* Market list */}
            <section className="institution-card overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] text-textSecondary border-b border-soft/50">
                <span>{t("trade.market.asset")}</span>
                <span className="text-right">{t("trade.market.price")}</span>
                <span className="text-right hidden sm:block">{t("trade.market.volume")}</span>
                <span className="text-right">{t("trade.market.change")}</span>
              </div>
              {MARKET.map((asset, index) => (
                <motion.button
                  key={asset.code}
                  type="button"
                  onClick={() => setActiveAsset(asset)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16, delay: index * 0.04, ease: EASE }}
                  className={cx(
                    "grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3.5 transition-colors duration-100 text-left border-b border-soft/30 last:border-none",
                    activeAsset.code === asset.code ? "bg-trust/6" : "hover:bg-white/2"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="asset-icon shrink-0 text-[10px] font-bold" style={{ borderColor: `${asset.color}66`, background: `${asset.color}20`, color: asset.color }}>
                      {asset.code.slice(0, 3)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">{asset.code}</p>
                      <p className="text-[11px] text-textSecondary">{asset.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-textPrimary">
                      {asset.price >= 100
                        ? new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(asset.price)
                        : new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(asset.price)}
                    </p>
                  </div>
                  <p className="hidden text-right text-xs tabular-nums text-textSecondary sm:block">{asset.volume24h}</p>
                  <div className="flex flex-col items-end gap-1">
                    <Sparkline data={asset.sparkline} positive={asset.change24h >= 0} />
                    <span className={cx("text-xs font-semibold tabular-nums", asset.change24h >= 0 ? "text-profit" : "text-loss")}>
                      {asset.change24h >= 0 ? "+" : ""}{asset.change24h.toFixed(2)}%
                    </span>
                  </div>
                </motion.button>
              ))}
            </section>

            {/* Selected asset detail */}
            <section className="institution-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="asset-icon text-[10px] font-bold" style={{ borderColor: `${activeAsset.color}66`, background: `${activeAsset.color}20`, color: activeAsset.color }}>
                      {activeAsset.code.slice(0, 3)}
                    </span>
                    <h2 className="font-display text-xl font-semibold text-textPrimary">{activeAsset.name}</h2>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-textPrimary tabular-nums">
                      {activeAsset.price >= 100
                        ? formatCurrency(activeAsset.price, localeTag, 2)
                        : formatCurrency(activeAsset.price, localeTag, 4)}
                    </p>
                    <span className={cx("mb-1 text-sm font-semibold", activeAsset.change24h >= 0 ? "text-profit" : "text-loss")}>
                      {activeAsset.change24h >= 0 ? "+" : ""}{activeAsset.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.14em] text-textSecondary">Mkt Cap</p>
                  <p className="text-sm font-semibold text-textPrimary">{activeAsset.marketCap}</p>
                  <p className="mt-1 text-xs text-textSecondary">Vol 24h: {activeAsset.volume24h}</p>
                </div>
              </div>

              {/* Order book */}
              {activeAsset.code === "BTC" && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.14em] text-textSecondary">{t("trade.orderbook.title")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-profit">{t("trade.orderbook.bids")}</p>
                      {BTC_ORDER_BOOK.bids.map(([price, qty]) => (
                        <div key={price} className="flex justify-between rounded-[8px] bg-profit/6 px-2.5 py-1.5">
                          <span className="tabular-nums text-xs text-profit">{price.toFixed(2)}</span>
                          <span className="tabular-nums text-xs text-textSecondary">{qty.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-loss">{t("trade.orderbook.asks")}</p>
                      {BTC_ORDER_BOOK.asks.map(([price, qty]) => (
                        <div key={price} className="flex justify-between rounded-[8px] bg-loss/6 px-2.5 py-1.5">
                          <span className="tabular-nums text-xs text-loss">{price.toFixed(2)}</span>
                          <span className="tabular-nums text-xs text-textSecondary">{qty.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Trade form */}
              <div className="space-y-3">
                <div className="flex gap-1 rounded-[11px] border border-soft p-1" style={{ background: "rgba(11,20,35,0.6)" }}>
                  {(["buy", "sell"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => setOrderType(type)}
                      className={cx("flex-1 rounded-[8px] py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors duration-150",
                        orderType === type && type === "buy" ? "bg-profit/20 text-profit"
                          : orderType === type && type === "sell" ? "bg-loss/20 text-loss"
                          : "text-textSecondary hover:text-textPrimary")}
                    >{t(`trade.order.${type}`)}</button>
                  ))}
                </div>

                <input
                  type="number"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  placeholder={`${t("trade.order.amount")} (${activeAsset.code})`}
                  min="0"
                  className="onboarding-input"
                />

                {orderAmount && !isNaN(+orderAmount) && +orderAmount > 0 && (
                  <div className="rounded-[10px] border border-soft bg-slate-900/30 px-3 py-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-textSecondary">{t("trade.order.total")}</span>
                      <span className="font-semibold text-textPrimary">{formatCurrency(+orderAmount * activeAsset.price, localeTag)}</span>
                    </div>
                  </div>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={!orderAmount || isNaN(+orderAmount) || +orderAmount <= 0}
                  className={cx(
                    "w-full rounded-[14px] py-3.5 text-sm font-bold uppercase tracking-[0.08em] transition-opacity disabled:opacity-40",
                    orderType === "buy"
                      ? "bg-profit/25 text-profit border border-profit/30"
                      : "bg-loss/20 text-loss border border-loss/25"
                  )}
                >
                  {t(`trade.order.${orderType}`)} {activeAsset.code}
                </motion.button>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="space-y-3"
          >
            {MARKET.filter((a) => a.userBalance > 0).map((asset, index) => {
              const value = asset.price * asset.userBalance;
              const gainLoss = (asset.price - asset.avgBuyPrice) * asset.userBalance;
              const glPercent = asset.avgBuyPrice > 0
                ? ((asset.price - asset.avgBuyPrice) / asset.avgBuyPrice) * 100
                : 0;

              return (
                <motion.article
                  key={asset.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.06, ease: EASE }}
                  whileHover={{ y: -2 }}
                  className="institution-card p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="asset-icon text-[10px] font-bold" style={{ borderColor: `${asset.color}66`, background: `${asset.color}20`, color: asset.color }}>
                        {asset.code.slice(0, 3)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">{asset.name}</p>
                      <p className="text-xs text-textSecondary">{asset.userBalance > 0 ? asset.userBalance.toFixed(4) : "–"} {asset.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold tabular-nums text-textPrimary">{formatCurrency(value, localeTag)}</p>
                      <p className={cx("text-xs font-semibold tabular-nums", gainLoss >= 0 ? "text-profit" : "text-loss")}>
                        {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss, localeTag)} ({glPercent >= 0 ? "+" : ""}{glPercent.toFixed(2)}%)
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-[9px] border border-soft bg-slate-900/30 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-textSecondary">{t("trade.portfolio.avgPrice")}</p>
                      <p className="mt-1 font-semibold tabular-nums text-textPrimary">
                        {formatCurrency(asset.avgBuyPrice, localeTag, asset.avgBuyPrice >= 100 ? 2 : 4)}
                      </p>
                    </div>
                    <div className="rounded-[9px] border border-soft bg-slate-900/30 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-textSecondary">{t("trade.portfolio.currentPrice")}</p>
                      <p className="mt-1 font-semibold tabular-nums text-textPrimary">
                        {formatCurrency(asset.price, localeTag, asset.price >= 100 ? 2 : 4)}
                      </p>
                    </div>
                    <div className="rounded-[9px] border border-soft bg-slate-900/30 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-textSecondary">P&L %</p>
                      <p className={cx("mt-1 font-semibold tabular-nums", glPercent >= 0 ? "text-profit" : "text-loss")}>
                        {glPercent >= 0 ? "+" : ""}{glPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </div>
    </main>
  );
}

function TradeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="13" width="3" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.5" y="8" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="4" width="3" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
