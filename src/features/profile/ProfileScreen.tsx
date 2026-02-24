import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useI18n, type Locale } from "../../app/providers/I18nProvider";
import { cx } from "../../shared/lib/cx";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ONBOARDED_STORAGE_KEY = "nexosite.onboarded.v1";
const PROFILE_STORAGE_KEY = "nexosite.profile.v1";

type ProfileSection = "account" | "security" | "settings" | "support";

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
  os: string;
}

const MOCK_SESSIONS: Session[] = [
  { id: "s1", device: "iPhone 15 Pro", location: "Berlin, DE", lastActive: "Now", current: true, os: "iOS 17" },
  { id: "s2", device: "MacBook Pro M3", location: "Berlin, DE", lastActive: "2 hours ago", current: false, os: "macOS 14" },
  { id: "s3", device: "Telegram Desktop", location: "Amsterdam, NL", lastActive: "Yesterday", current: false, os: "Windows 11" }
];

const SUPPORT_ITEMS = [
  { id: "faq", icon: "📖", titleKey: "profile.support.faq", descKey: "profile.support.faqDesc" },
  { id: "chat", icon: "💬", titleKey: "profile.support.chat", descKey: "profile.support.chatDesc" },
  { id: "status", icon: "🟢", titleKey: "profile.support.status", descKey: "profile.support.statusDesc" },
  { id: "feedback", icon: "✉️", titleKey: "profile.support.feedback", descKey: "profile.support.feedbackDesc" }
];

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
      active ? "border border-profit/25 bg-profit/12 text-profit" : "border border-loss/25 bg-loss/12 text-loss"
    )}>
      <span className={cx("h-1.5 w-1.5 rounded-full", active ? "bg-profit" : "bg-loss")} />
      {label}
    </span>
  );
}

export function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const [activeSection, setActiveSection] = useState<ProfileSection>("account");
  const [twoFaEnabled, setTwoFaEnabled] = useState(true);
  const [antiPhishingCode] = useState("NX-7721-ALPHA");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);

  // Read profile from storage
  const storedProfile = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as { id: string; username: string; email: string; country: string; language: string; registeredAt: string };
    } catch { return null; }
    return null;
  })();

  const profile = storedProfile ?? {
    id: "NX-845291",
    username: "prime.account",
    email: "ops@nexosite.io",
    country: "de",
    language: locale,
    registeredAt: "2025-06-18T09:14:00.000Z"
  };

  const navItems: { id: ProfileSection; labelKey: string }[] = [
    { id: "account", labelKey: "profile.nav.account" },
    { id: "security", labelKey: "profile.nav.security" },
    { id: "settings", labelKey: "profile.nav.settings" },
    { id: "support", labelKey: "profile.nav.support" }
  ];

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ONBOARDED_STORAGE_KEY);
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
      window.location.reload();
    }
  }

  function revokeSession(sessionId: string) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  return (
    <main className="dashboard-shell pb-24">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 pt-5 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="institution-card p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-trust/30 bg-trust/12 text-trust">
              <UserGlyph />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] text-textPrimary truncate">{profile.username}</h1>
              <p className="text-xs text-textSecondary">{profile.email}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-textSecondary">{profile.id}</p>
            </div>
            <div className="ml-auto shrink-0">
              <StatusBadge active label={t("profile.status.verified")} />
            </div>
          </div>
        </motion.div>

        {/* Sub-nav */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05, ease: EASE }}
          className="flex gap-1 overflow-x-auto rounded-[14px] border border-soft p-1"
          style={{ background: "rgba(11,20,35,0.7)" }}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={cx(
                "flex-1 shrink-0 rounded-[10px] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150 whitespace-nowrap",
                activeSection === item.id ? "bg-trust/20 text-trust" : "text-textSecondary hover:text-textPrimary"
              )}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </motion.div>

        {/* Section content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="space-y-3"
          >
            {/* ACCOUNT */}
            {activeSection === "account" && (
              <>
                <section className="institution-card p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.account.identity")}</h2>
                  <dl className="space-y-2">
                    {([
                      [t("dashboard.profile.id"), profile.id],
                      [t("dashboard.profile.email"), profile.email],
                      [t("dashboard.profile.country"), t(`common.country.${profile.country}`)],
                      [t("dashboard.profile.language"), t(`common.language.${profile.language}`)],
                      [t("dashboard.profile.registered"), new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(profile.registeredAt))]
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-[11px] border border-soft bg-slate-900/30 px-3 py-2.5">
                        <dt className="text-xs uppercase tracking-[0.14em] text-textSecondary">{label}</dt>
                        <dd className="text-sm font-medium text-textPrimary truncate max-w-[55%] text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="institution-card p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.account.kyc")}</h2>
                  <div className="flex items-center justify-between rounded-[12px] border border-profit/20 bg-profit/8 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-profit/30 bg-profit/15 text-profit">
                        <ShieldGlyph />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">{t("profile.account.kyc.title")}</p>
                        <p className="text-xs text-textSecondary">{t("profile.account.kyc.desc")}</p>
                      </div>
                    </div>
                    <StatusBadge active label={t("profile.status.verified")} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: "KYC Level", value: "2 / 3" },
                      { label: t("profile.account.dailyLimit"), value: "$50,000" },
                      { label: t("profile.account.monthlyLimit"), value: "$500,000" }
                    ].map((item) => (
                      <div key={item.label} className="rounded-[10px] border border-soft bg-slate-900/30 px-2.5 py-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-textSecondary">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-textPrimary">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full rounded-[14px] border border-loss/25 bg-loss/10 py-3 text-sm font-semibold text-loss transition-opacity hover:bg-loss/15"
                >
                  {t("dashboard.menu.logout")}
                </motion.button>

                <AnimatePresence>
                  {showLogoutConfirm && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="institution-card p-5 text-center"
                    >
                      <p className="text-sm font-medium text-textPrimary">{t("profile.account.logoutConfirm")}</p>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => setShowLogoutConfirm(false)}
                          className="flex-1 rounded-[12px] border border-soft bg-slate-900/40 py-2.5 text-sm font-semibold text-textSecondary">
                          {t("profile.account.cancel")}
                        </button>
                        <button type="button" onClick={handleLogout}
                          className="flex-1 rounded-[12px] border border-loss/25 bg-loss/15 py-2.5 text-sm font-semibold text-loss">
                          {t("dashboard.menu.logout")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* SECURITY */}
            {activeSection === "security" && (
              <>
                <section className="institution-card p-5 space-y-3">
                  <h2 className="text-[15px] font-semibold text-textPrimary">{t("profile.security.title")}</h2>

                  {/* 2FA */}
                  <div className={cx(
                    "flex items-center justify-between rounded-[12px] border px-4 py-3.5 transition-colors duration-150",
                    twoFaEnabled ? "border-profit/25 bg-profit/8" : "border-soft bg-slate-900/30"
                  )}>
                    <div className="flex items-center gap-3">
                      <span className={cx("flex h-9 w-9 items-center justify-center rounded-full border text-sm",
                        twoFaEnabled ? "border-profit/30 bg-profit/15 text-profit" : "border-soft bg-slate-900/40 text-textSecondary")}>
                        🔒
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">{t("profile.security.2fa")}</p>
                        <p className="text-xs text-textSecondary">{t("profile.security.2faDesc")}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFaEnabled((v) => !v)}
                      className={cx(
                        "relative h-6 w-11 rounded-full border transition-colors duration-200",
                        twoFaEnabled ? "border-profit/40 bg-profit/30" : "border-soft bg-slate-900/60"
                      )}
                      role="switch"
                      aria-checked={twoFaEnabled}
                    >
                      <motion.span
                        layout
                        animate={{ x: twoFaEnabled ? 20 : 2 }}
                        transition={{ duration: 0.15, ease: EASE }}
                        className={cx("absolute top-0.5 h-5 w-5 rounded-full border",
                          twoFaEnabled ? "border-profit/40 bg-profit" : "border-soft bg-textSecondary/40")}
                      />
                    </button>
                  </div>

                  {/* Anti-phishing */}
                  <div className="rounded-[12px] border border-trust/20 bg-trust/6 px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-trust/30 bg-trust/15 text-trust shrink-0">
                        🛡️
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-textPrimary">{t("profile.security.antiPhishing")}</p>
                        <p className="text-xs text-textSecondary">{t("profile.security.antiPhishingDesc")}</p>
                        <div className="mt-2 inline-flex items-center rounded-[8px] border border-trust/20 bg-trust/10 px-3 py-1.5">
                          <span className="font-mono text-sm font-bold tracking-[0.15em] text-trust">{antiPhishingCode}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Sessions */}
                <section className="institution-card p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.security.sessions")}</h2>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <motion.div
                        key={session.id}
                        layout
                        className={cx(
                          "flex items-center justify-between gap-3 rounded-[12px] border px-3 py-3",
                          session.current ? "border-trust/25 bg-trust/8" : "border-soft bg-slate-900/30"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border text-sm",
                            session.current ? "border-trust/30 bg-trust/15" : "border-soft bg-slate-900/50")}>
                            {session.device.includes("iPhone") || session.device.includes("Android") ? "📱" : session.device.includes("Telegram") ? "💬" : "💻"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-textPrimary truncate">{session.device}</p>
                            <p className="text-[11px] text-textSecondary">{session.location} · {session.lastActive}</p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {session.current
                            ? <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-trust">{t("profile.security.current")}</span>
                            : <button type="button" onClick={() => revokeSession(session.id)}
                                className="rounded-[8px] border border-loss/25 bg-loss/10 px-2.5 py-1.5 text-[11px] font-semibold text-loss">
                                {t("profile.security.revoke")}
                              </button>
                          }
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* Notifications */}
                <section className="institution-card p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.security.notifications")}</h2>
                  <div className="space-y-2">
                    {[
                      { label: t("profile.security.notif.login"), enabled: true },
                      { label: t("profile.security.notif.withdrawal"), enabled: true },
                      { label: t("profile.security.notif.large"), enabled: false }
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-[11px] border border-soft bg-slate-900/30 px-3 py-2.5">
                        <span className="text-sm text-textPrimary">{item.label}</span>
                        <span className={cx("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          item.enabled ? "bg-profit/15 text-profit" : "bg-textSecondary/10 text-textSecondary")}>
                          {item.enabled ? t("profile.security.on") : t("profile.security.off")}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* SETTINGS */}
            {activeSection === "settings" && (
              <section className="institution-card p-5 space-y-4">
                <div>
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("onboarding.language.label")}</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ru", "en", "de"] as Locale[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLocale(lang)}
                        className={cx(
                          "rounded-[11px] border py-3 text-sm font-semibold transition-colors duration-150",
                          locale === lang ? "border-trust/50 bg-trust/18 text-trust" : "border-soft bg-slate-900/30 text-textSecondary"
                        )}
                      >
                        {t(`common.language.${lang}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.settings.appearance")}</h2>
                  <div className="rounded-[12px] border border-soft bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">{t("profile.settings.theme")}</p>
                        <p className="text-xs text-textSecondary">{t("profile.settings.themeDark")}</p>
                      </div>
                      <span className="rounded-full border border-trust/20 bg-trust/10 px-3 py-1 text-xs font-semibold text-trust">
                        {t("profile.settings.themeActive")}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.settings.data")}</h2>
                  <div className="space-y-2">
                    <button type="button" className="w-full rounded-[12px] border border-soft bg-slate-900/30 px-4 py-3 text-left text-sm text-textPrimary">
                      {t("profile.settings.exportHistory")}
                    </button>
                    <button type="button" className="w-full rounded-[12px] border border-loss/20 bg-loss/6 px-4 py-3 text-left text-sm text-loss">
                      {t("profile.settings.deleteAccount")}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* SUPPORT */}
            {activeSection === "support" && (
              <>
                <section className="institution-card overflow-hidden">
                  {SUPPORT_ITEMS.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cx(
                        "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors duration-100 hover:bg-white/2",
                        index < SUPPORT_ITEMS.length - 1 && "border-b border-soft/40"
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-soft bg-slate-900/40 text-lg">
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-textPrimary">{t(item.titleKey)}</p>
                        <p className="text-xs text-textSecondary">{t(item.descKey)}</p>
                      </div>
                      <ChevronRightGlyph />
                    </button>
                  ))}
                </section>

                {/* System status */}
                <section className="institution-card p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-textPrimary">{t("profile.support.systemStatus")}</h2>
                  <div className="space-y-2">
                    {[
                      { label: "Trading Engine", ok: true },
                      { label: "Deposits & Withdrawals", ok: true },
                      { label: "Market Data Feed", ok: true },
                      { label: "API Gateway", ok: true }
                    ].map((svc) => (
                      <div key={svc.label} className="flex items-center justify-between rounded-[10px] border border-soft bg-slate-900/30 px-3 py-2.5">
                        <span className="text-sm text-textPrimary">{svc.label}</span>
                        <StatusBadge active={svc.ok} label={svc.ok ? t("profile.support.operational") : t("profile.support.degraded")} />
                      </div>
                    ))}
                  </div>
                </section>

                <div className="rounded-[12px] border border-trust/15 bg-trust/6 px-4 py-3">
                  <p className="text-xs text-textSecondary">
                    <span className="font-semibold text-trust">NEXO Prime</span> · v1.0.0 · {t("profile.support.uptime")} 99.97%
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function UserGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 18.5a7.25 7.25 0 0114.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L4 7v5c0 5 4 9 8 10 4-1 8-5 8-10V7L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-textSecondary">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
