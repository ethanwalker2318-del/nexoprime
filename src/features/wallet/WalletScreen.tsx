import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useI18n } from "../../app/providers/I18nProvider";
import { cx } from "../../shared/lib/cx";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type WalletTab = "deposit" | "withdraw" | "exchange" | "history";

type TxStatus = "completed" | "pending" | "failed";

interface Transaction {
  id: string;
  type: "deposit" | "withdraw" | "exchange";
  asset: string;
  amount: number;
  usdValue: number;
  status: TxStatus;
  date: string;
  hash?: string;
}

interface Network {
  id: string;
  name: string;
  symbol: string;
  confirmations: number;
  minDeposit: number;
  fee: string;
}

const NETWORKS: Network[] = [
  { id: "eth", name: "Ethereum (ERC-20)", symbol: "ETH", confirmations: 12, minDeposit: 50, fee: "~$2.40" },
  { id: "tron", name: "Tron (TRC-20)", symbol: "TRX", confirmations: 20, minDeposit: 10, fee: "~$1.00" },
  { id: "bnb", name: "BNB Smart Chain", symbol: "BNB", confirmations: 15, minDeposit: 20, fee: "~$0.50" },
  { id: "btc", name: "Bitcoin Network", symbol: "BTC", confirmations: 3, minDeposit: 100, fee: "~$5.00" }
];

const MOCK_HISTORY: Transaction[] = [
  { id: "tx001", type: "deposit", asset: "USDT", amount: 10000, usdValue: 10000, status: "completed", date: "2026-02-20T14:22:00Z", hash: "0xab12...f89d" },
  { id: "tx002", type: "withdraw", asset: "ETH", amount: 0.5, usdValue: 1714.45, status: "completed", date: "2026-02-18T09:11:00Z", hash: "0xcd34...a12e" },
  { id: "tx003", type: "exchange", asset: "BTC → USDT", amount: 0.1, usdValue: 6854.72, status: "completed", date: "2026-02-15T18:05:00Z" },
  { id: "tx004", type: "deposit", asset: "BTC", amount: 0.2, usdValue: 13709.44, status: "pending", date: "2026-02-23T22:40:00Z", hash: "0xef56...b34f" },
  { id: "tx005", type: "withdraw", asset: "USDT", amount: 2000, usdValue: 2000, status: "failed", date: "2026-02-10T07:30:00Z" },
  { id: "tx006", type: "deposit", asset: "ETH", amount: 2.0, usdValue: 6857.82, status: "completed", date: "2026-02-08T11:14:00Z", hash: "0xaa78...c56d" }
];

const MOCK_ADDRESS = "0x3fA9...D12E";
const MOCK_ADDRESS_FULL = "0x3fA9b8C2Df7e4F1A0E63B5d91C8723A4f2E1D12E";

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatCurrency(v: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

const LOCALE_TAG: Record<string, string> = { ru: "ru-RU", en: "en-US", de: "de-DE" };

export function WalletScreen() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<WalletTab>("deposit");
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[0]!);
  const [copied, setCopied] = useState(false);
  const [withdrawAsset, setWithdrawAsset] = useState("USDT");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [fromAsset, setFromAsset] = useState("BTC");
  const [toAsset, setToAsset] = useState("USDT");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "deposit" | "withdraw" | "exchange">("all");

  const localeTag = LOCALE_TAG[locale] ?? "en-US";

  const tabs: { id: WalletTab; label: string }[] = [
    { id: "deposit", label: t("wallet.tab.deposit") },
    { id: "withdraw", label: t("wallet.tab.withdraw") },
    { id: "exchange", label: t("wallet.tab.exchange") },
    { id: "history", label: t("wallet.tab.history") }
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(MOCK_ADDRESS_FULL).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredHistory = historyFilter === "all"
    ? MOCK_HISTORY
    : MOCK_HISTORY.filter((tx) => tx.type === historyFilter);

  const estimatedReceive = exchangeAmount && !isNaN(+exchangeAmount)
    ? fromAsset === "BTC" ? (+exchangeAmount * 68547.2 * 0.998).toFixed(2)
    : fromAsset === "ETH" ? (+exchangeAmount * 3428.91 * 0.998).toFixed(2)
    : (+exchangeAmount * 0.998).toFixed(2)
    : "–";

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
          <div className="flex items-center gap-3">
            <span className="brand-emblem">
              <WalletGlyph />
            </span>
            <div>
              <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-textPrimary">{t("wallet.title")}</h1>
              <p className="text-xs text-textSecondary">{t("wallet.subtitle")}</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.06, ease: EASE }}
          className="flex gap-1 rounded-[14px] border border-soft bg-surface/60 p-1"
          style={{ background: "rgba(11,20,35,0.7)" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cx(
                "flex-1 rounded-[10px] px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150",
                activeTab === tab.id
                  ? "bg-trust/20 text-trust"
                  : "text-textSecondary hover:text-textPrimary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            {/* DEPOSIT */}
            {activeTab === "deposit" && (
              <div className="space-y-3">
                <section className="institution-card p-5">
                  <p className="mb-3 text-xs uppercase tracking-[0.16em] text-textSecondary">{t("wallet.deposit.network")}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {NETWORKS.map((network) => (
                      <button
                        key={network.id}
                        type="button"
                        onClick={() => setSelectedNetwork(network)}
                        className={cx(
                          "rounded-[12px] border px-3 py-3 text-left transition-all duration-150",
                          selectedNetwork.id === network.id
                            ? "border-trust/50 bg-trust/10"
                            : "border-soft bg-slate-900/30 hover:border-soft/60"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-textPrimary">{network.symbol}</p>
                            <p className="text-xs text-textSecondary">{network.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-textSecondary">{t("wallet.deposit.fee")} {network.fee}</p>
                            <p className="text-[11px] text-textSecondary">{network.confirmations} {t("wallet.deposit.confirmations")}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="institution-card p-5">
                  <p className="mb-3 text-xs uppercase tracking-[0.16em] text-textSecondary">{t("wallet.deposit.address")}</p>

                  {/* QR mock */}
                  <div className="mx-auto mb-4 flex h-[148px] w-[148px] items-center justify-center rounded-[16px] border border-soft bg-white/5 text-center">
                    <QRMock />
                  </div>

                  <div className="flex items-center gap-2 rounded-[12px] border border-soft bg-slate-900/40 px-3 py-3">
                    <p className="flex-1 truncate font-mono text-sm text-textPrimary">{MOCK_ADDRESS}</p>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cx(
                        "shrink-0 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                        copied ? "bg-profit/20 text-profit" : "bg-trust/20 text-trust"
                      )}
                    >
                      {copied ? t("wallet.deposit.copied") : t("wallet.deposit.copy")}
                    </button>
                  </div>

                  <div className="mt-3 rounded-[10px] border border-amber-500/20 bg-amber-500/8 px-3 py-2.5">
                    <p className="text-xs font-medium text-amber-400">{t("wallet.deposit.warning")}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-textSecondary">
                    <div className="rounded-[10px] border border-soft bg-slate-900/30 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em]">{t("wallet.deposit.minAmount")}</p>
                      <p className="mt-1 text-sm font-semibold text-textPrimary">${selectedNetwork.minDeposit}</p>
                    </div>
                    <div className="rounded-[10px] border border-soft bg-slate-900/30 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em]">{t("wallet.deposit.confirmations")}</p>
                      <p className="mt-1 text-sm font-semibold text-textPrimary">{selectedNetwork.confirmations}</p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* WITHDRAW */}
            {activeTab === "withdraw" && (
              <section className="institution-card p-5">
                {withdrawSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 py-8 text-center"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-profit/30 bg-profit/15">
                      <CheckGlyph />
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-textPrimary">{t("wallet.withdraw.success.title")}</p>
                      <p className="mt-1 text-sm text-textSecondary">{t("wallet.withdraw.success.subtitle")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setWithdrawSuccess(false); setWithdrawAmount(""); setWithdrawAddress(""); }}
                      className="rounded-[12px] border border-trust/30 bg-trust/12 px-5 py-2.5 text-sm font-semibold text-trust"
                    >
                      {t("wallet.withdraw.success.new")}
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-textSecondary">{t("wallet.withdraw.asset")}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["USDT", "ETH", "BTC"].map((asset) => (
                        <button
                          key={asset}
                          type="button"
                          onClick={() => setWithdrawAsset(asset)}
                          className={cx(
                            "rounded-[11px] border py-2.5 text-sm font-semibold transition-colors duration-150",
                            withdrawAsset === asset
                              ? "border-trust/50 bg-trust/12 text-trust"
                              : "border-soft bg-slate-900/30 text-textSecondary"
                          )}
                        >
                          {asset}
                        </button>
                      ))}
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-textSecondary">{t("wallet.withdraw.address")}</span>
                      <input
                        type="text"
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                        placeholder="0x..."
                        className="onboarding-input font-mono text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-textSecondary">{t("wallet.withdraw.amount")} ({withdrawAsset})</span>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        className="onboarding-input"
                      />
                    </label>

                    <div className="rounded-[12px] border border-soft bg-slate-900/30 px-4 py-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-textSecondary">{t("wallet.withdraw.networkFee")}</span>
                        <span className="font-semibold text-textPrimary">~$2.40</span>
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs">
                        <span className="text-textSecondary">{t("wallet.withdraw.processing")}</span>
                        <span className="font-semibold text-textPrimary">~30 min</span>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      disabled={!withdrawAddress || !withdrawAmount || isNaN(+withdrawAmount) || +withdrawAmount <= 0}
                      onClick={() => setWithdrawSuccess(true)}
                      className="primary-action-button"
                    >
                      {t("wallet.withdraw.submit")}
                    </motion.button>
                  </div>
                )}
              </section>
            )}

            {/* EXCHANGE */}
            {activeTab === "exchange" && (
              <section className="institution-card p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-textSecondary">{t("wallet.exchange.from")}</p>
                  <div className="flex gap-2">
                    <div className="flex gap-1">
                      {["BTC", "ETH", "USDT"].map((a) => (
                        <button key={a} type="button" onClick={() => setFromAsset(a)}
                          className={cx("rounded-[10px] border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                            fromAsset === a ? "border-trust/50 bg-trust/12 text-trust" : "border-soft bg-slate-900/30 text-textSecondary")}
                        >{a}</button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number" value={exchangeAmount}
                    onChange={(e) => setExchangeAmount(e.target.value)}
                    placeholder="0.00" min="0"
                    className="onboarding-input"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-soft/40" />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-trust/30 bg-trust/12 text-trust">
                    <SwapGlyph />
                  </div>
                  <div className="flex-1 h-px bg-soft/40" />
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-textSecondary">{t("wallet.exchange.to")}</p>
                  <div className="flex gap-1">
                    {["BTC", "ETH", "USDT"].filter((a) => a !== fromAsset).map((a) => (
                      <button key={a} type="button" onClick={() => setToAsset(a)}
                        className={cx("rounded-[10px] border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                          toAsset === a ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400" : "border-soft bg-slate-900/30 text-textSecondary")}
                      >{a}</button>
                    ))}
                  </div>
                  <div className="rounded-[12px] border border-soft bg-slate-900/40 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-textSecondary">{t("wallet.exchange.estimated")}</p>
                    <p className="mt-1 font-display text-xl font-semibold text-textPrimary">
                      {estimatedReceive} <span className="text-sm text-textSecondary">{toAsset !== fromAsset ? toAsset : "USDT"}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-[12px] border border-soft bg-slate-900/30 px-4 py-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-textSecondary">{t("wallet.exchange.rate")}</span>
                    <span className="font-semibold text-textPrimary">1 {fromAsset} ≈ {fromAsset === "BTC" ? "$68,547" : fromAsset === "ETH" ? "$3,428" : "$1.00"}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className="text-textSecondary">{t("wallet.exchange.fee")}</span>
                    <span className="font-semibold text-textPrimary">0.2%</span>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={!exchangeAmount || isNaN(+exchangeAmount) || +exchangeAmount <= 0 || fromAsset === toAsset}
                  className="primary-action-button"
                >
                  {t("wallet.exchange.submit")}
                </motion.button>
              </section>
            )}

            {/* HISTORY */}
            {activeTab === "history" && (
              <div className="space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(["all", "deposit", "withdraw", "exchange"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setHistoryFilter(filter)}
                      className={cx(
                        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                        historyFilter === filter
                          ? "border-trust/40 bg-trust/14 text-trust"
                          : "border-soft bg-slate-900/40 text-textSecondary"
                      )}
                    >
                      {t(`wallet.history.filter.${filter}`)}
                    </button>
                  ))}
                </div>

                <section className="institution-card divide-y divide-soft/50 overflow-hidden">
                  {filteredHistory.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <span className="text-2xl opacity-30">📋</span>
                      <p className="text-sm text-textSecondary">{t("wallet.history.empty")}</p>
                    </div>
                  ) : (
                    filteredHistory.map((tx, index) => (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18, delay: index * 0.05, ease: EASE }}
                        className="flex items-center justify-between gap-3 px-4 py-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cx(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border",
                            tx.type === "deposit" ? "border-profit/30 bg-profit/10 text-profit"
                              : tx.type === "withdraw" ? "border-loss/30 bg-loss/10 text-loss"
                              : "border-trust/30 bg-trust/10 text-trust"
                          )}>
                            {tx.type === "deposit" ? <ArrowDownGlyph /> : tx.type === "withdraw" ? <ArrowUpGlyph /> : <SwapGlyph />}
                          </span>
                          <div>
                            <p className="text-sm font-semibold capitalize text-textPrimary">{t(`wallet.history.type.${tx.type}`)}</p>
                            <p className="text-xs text-textSecondary">{tx.asset} · {formatDate(tx.date, localeTag)}</p>
                            {tx.hash && <p className="mt-0.5 font-mono text-[10px] text-textSecondary/60">{tx.hash}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cx(
                            "text-sm font-semibold",
                            tx.type === "deposit" ? "text-profit" : tx.type === "withdraw" ? "text-loss" : "text-textPrimary"
                          )}>
                            {tx.type === "deposit" ? "+" : tx.type === "withdraw" ? "−" : ""}{tx.amount} {tx.asset.split(" ")[0]}
                          </p>
                          <p className="text-xs text-textSecondary">{formatCurrency(tx.usdValue, localeTag)}</p>
                          <span className={cx(
                            "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                            tx.status === "completed" ? "bg-profit/15 text-profit"
                              : tx.status === "pending" ? "bg-amber-400/15 text-amber-400"
                              : "bg-loss/15 text-loss"
                          )}>
                            {t(`wallet.history.status.${tx.status}`)}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </section>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function QRMock() {
  const cells: boolean[] = [];
  const seed = 0x5a3f;
  for (let i = 0; i < 100; i++) {
    cells.push(((seed * (i + 1) * 0x1234) % 7) > 2);
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(10, 10px)", gap: "2px" }}>
      {cells.map((on, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: on ? "rgba(233,242,255,0.85)" : "rgba(233,242,255,0.07)" }} />
      ))}
    </div>
  );
}

function WalletGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
      <path d="M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SwapGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h12M19 7l-2.5-2.5M19 7l-2.5 2.5M17 17H5M5 17l2.5-2.5M5 17l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDownGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 13l7 6 7-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M5 11l7-6 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
