import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";
import { useRouter } from "../../app/providers/RouterProvider";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
type Tab = "account" | "security" | "settings";

export function ProfileScreen() {
  const { state, logout } = useExchange();
  const { navigate } = useRouter();
  const [tab, setTab] = useState<Tab>("account");
  const [notif, setNotif] = useState(true);
  const [twoFA, setTwoFA] = useState(false);

  const user = state.user;
  if (!user) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "account",  label: "Аккаунт" },
    { key: "security", label: "Безопасность" },
    { key: "settings", label: "Настройки" },
  ];

  const LEVEL_LABELS: Record<number, string> = { 1: "Базовый", 2: "Стандарт", 3: "Расширенный" };
  const LEVEL_COLORS: Record<number, string> = {
    1: "var(--text-3)", 2: "var(--accent)", 3: "var(--pos)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        padding: "14px 16px 0",
        background: "var(--bg-0)",
        borderBottom: "1px solid var(--line-1)",
      }}>
        {/* Аватар + имя */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), #2D7FCC)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff",
            flexShrink: 0,
          }}>
            {(user.email[0] ?? "?").toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 16, color: "var(--text-1)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {user.email}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: LEVEL_COLORS[user.level],
              }}>
                Уровень {LEVEL_LABELS[user.level]}
              </span>
              {user.emailVerified && (
                <span style={{
                  fontSize: 10, background: "var(--pos-dim)",
                  border: "1px solid var(--pos-border)",
                  color: "var(--pos)", borderRadius: 4, padding: "1px 5px",
                }}>
                  ✓ Верифицирован
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Табы */}
        <div style={{ display: "flex" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: "9px 0", background: "none", border: "none",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "var(--accent)" : "var(--text-3)",
                borderBottom: `2px solid ${tab === t.key ? "var(--accent)" : "transparent"}`,
                cursor: "pointer", marginBottom: -1,
                transition: "all var(--dur-fast)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px calc(var(--nav-height) + var(--safe-bottom) + 16px)" }}>
        <AnimatePresence mode="wait">
          {tab === "account" && (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <InfoCard>
                <InfoRow label="Email" val={user.email} />
                <InfoRow label="ID пользователя" val={user.uid} mono />
                <InfoRow label="Уровень верификации" val={`${user.level} — ${LEVEL_LABELS[user.level]}`} />
                <InfoRow label="Email подтверждён" val={user.emailVerified ? "Да" : "Нет"}
                  valColor={user.emailVerified ? "var(--pos)" : "var(--neg)"} />
                <InfoRow label="Уровень комиссии" val="VIP 0 (Maker 0.06% / Taker 0.10%)" />
              </InfoCard>

              {/* Уровни верификации */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
                  Уровни верификации
                </div>
                {[
                  { level: 1, label: "Базовый", desc: "Email + KYC 1", limit: "До $2 000/сут" },
                  { level: 2, label: "Стандарт", desc: "Паспорт", limit: "До $50 000/сут" },
                  { level: 3, label: "Расширенный", desc: "Подтверждение адреса", limit: "Без лимитов" },
                ].map((lv) => {
                  const isActive = user.level === lv.level;
                  const isDone = user.level > lv.level;
                  return (
                    <div
                      key={lv.level}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 14px", marginBottom: 2,
                        background: isActive ? "var(--accent-dim)" : "var(--surface-1)",
                        border: `1px solid ${isActive ? "var(--accent-border)" : "var(--line-1)"}`,
                        borderRadius: "var(--r-md)",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: isDone ? "var(--pos)" : isActive ? "var(--accent)" : "var(--surface-3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff",
                      }}>
                        {isDone ? "✓" : lv.level}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                          Уровень {lv.level} — {lv.label}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {lv.desc} · {lv.limit}
                        </div>
                      </div>
                      {isActive && (
                        <span style={{
                          fontSize: 10, color: "var(--accent)", fontWeight: 600,
                          background: "var(--accent-dim)", borderRadius: 4, padding: "2px 6px",
                          border: "1px solid var(--accent-border)",
                        }}>
                          Текущий
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Выход */}
              <button
                onClick={logout}
                style={{
                  width: "100%", padding: "12px",
                  background: "var(--neg-dim)", border: "1px solid var(--neg-border)",
                  borderRadius: "var(--r-md)", color: "var(--neg)",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Выйти из аккаунта
              </button>
            </motion.div>
          )}

          {tab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <div style={{ marginBottom: 16 }}>
                {[
                  {
                    label: "Двухфакторная аутентификация",
                    sub: twoFA ? "Включена · TOTP" : "Выключена",
                    toggle: true,
                    val: twoFA,
                    onToggle: () => setTwoFA((v) => !v),
                  },
                  {
                    label: "Email-подтверждение вывода",
                    sub: "При каждом запросе вывода",
                    toggle: false,
                    val: true,
                  },
                  {
                    label: "История авторизаций",
                    sub: "1 активная сессия",
                    toggle: false,
                    val: false,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 14px", marginBottom: 2,
                      background: "var(--surface-1)", borderRadius: "var(--r-md)",
                      border: "1px solid var(--line-1)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{item.sub}</div>
                    </div>
                    {item.toggle ? (
                      <Toggle val={item.val} onToggle={item.onToggle!} />
                    ) : (
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: item.val ? "var(--pos)" : "var(--surface-3)",
                      }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{
                background: "var(--warn-dim)", border: "1px solid var(--warn)",
                borderRadius: "var(--r-md)", padding: "12px 14px",
                fontSize: 12, color: "var(--warn)",
              }}>
                ⚠️ Рекомендуем включить 2FA для защиты аккаунта
              </div>
            </motion.div>
          )}

          {tab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <InfoCard>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 0", borderBottom: "1px solid var(--line-1)",
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text-1)" }}>Язык интерфейса</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>Русский</div>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-3)" }}>›</span>
                </div>

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 0", borderBottom: "1px solid var(--line-1)",
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text-1)" }}>Уведомления</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {notif ? "Включены" : "Выключены"}
                    </div>
                  </div>
                  <Toggle val={notif} onToggle={() => setNotif((v) => !v)} />
                </div>

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 0",
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text-1)" }}>Версия</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>NEXO 1.0.0</div>
                  </div>
                </div>
              </InfoCard>

              <div style={{
                marginTop: 16,
                background: "var(--surface-1)", borderRadius: "var(--r-md)",
                border: "1px solid var(--line-1)", overflow: "hidden",
              }}>
                {[
                  { label: "Обратная связь", icon: "💬", action: () => navigate("support") },
                  { label: "Центр помощи", icon: "❓", action: undefined },
                  { label: "Условия использования", icon: "📄", action: undefined },
                  { label: "Политика конфиденциальности", icon: "🔒", action: undefined },
                ].map((item, i) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "13px 14px",
                      background: "none", border: "none",
                      borderBottom: i < 3 ? "1px solid var(--line-1)" : "none",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span style={{ flex: 1, fontSize: 14, color: "var(--text-1)" }}>{item.label}</span>
                    <span style={{ fontSize: 13, color: "var(--text-4)" }}>›</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Компоненты ───────────────────────────────────────────────────────────────

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface-1)", borderRadius: "var(--r-md)",
      border: "1px solid var(--line-1)", padding: "2px 14px", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, val, mono, valColor }: {
  label: string; val: string; mono?: boolean; valColor?: string;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "11px 0", borderBottom: "1px solid var(--line-1)", gap: 8,
    }}>
      <span style={{ fontSize: 13, color: "var(--text-3)", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 13, color: valColor ?? "var(--text-1)", fontWeight: 500,
        fontFamily: mono ? "monospace" : "inherit",
        textAlign: "right", wordBreak: "break-all",
      }}>
        {val}
      </span>
    </div>
  );
}

function Toggle({ val, onToggle }: { val: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: val ? "var(--accent)" : "var(--surface-3)",
        border: "none", cursor: "pointer", position: "relative",
        flexShrink: 0,
        transition: "background var(--dur-fast)",
      }}
    >
      <div style={{
        position: "absolute", top: 2, borderRadius: "50%",
        width: 20, height: 20, background: "#fff",
        left: val ? 22 : 2,
        transition: "left var(--dur-fast) var(--ease-out)",
        boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      }} />
    </button>
  );
}
