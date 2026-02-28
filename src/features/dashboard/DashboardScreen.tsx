import { AnimatePresence, motion } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode
} from "react";
import { useI18n, type Locale } from "../../app/providers/I18nProvider";
import { useTelegram } from "../../app/providers/TelegramProvider";
import { cx } from "../../shared/lib/cx";
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";

const ONBOARDED_STORAGE_KEY = "nexosite.onboarded.v1";
const PROFILE_STORAGE_KEY = "nexosite.profile.v1";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const COUNTRY_OPTIONS = ["de", "ae", "sg", "gb", "ch"] as const;
type CountryCode = (typeof COUNTRY_OPTIONS)[number];

interface ProfileData {
  id: string;
  username: string;
  email: string;
  country: CountryCode;
  language: Locale;
  registeredAt: string;
}

interface AssetData {
  code: "BTC" | "ETH" | "USDT";
  name: string;
  price: number;
  change: number;
  balance: number;
  color: string;
}

interface Testimonial {
  name: string;
  role: Record<Locale, string>;
  comment: Record<Locale, string>;
  rating: number;
}

interface AnalyticsMetric {
  id: string;
  label: string;
  value: number;
  decimals: number;
  suffix: string;
  prefix?: string;
  tone?: "positive" | "negative" | "neutral";
}

interface OnboardingPayload {
  email: string;
  language: Locale;
  country: CountryCode;
}

interface OnboardingProps {
  locale: Locale;
  telegramFirstName: string | undefined;
  onLocaleChange: (locale: Locale) => void;
  onComplete: (payload: OnboardingPayload) => void;
}

interface ActionButtonProps {
  label: string;
  icon: ReactNode;
  tone: "blue" | "teal" | "slate";
}

interface MetricTileProps extends AnalyticsMetric {}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

const ASSETS: Array<AssetData> = [
  {
    code: "BTC",
    name: "Bitcoin",
    price: 68_547.2,
    change: 2.4,
    balance: 0.7421,
    color: "#f59e0b"
  },
  {
    code: "ETH",
    name: "Ethereum",
    price: 3_428.91,
    change: 1.6,
    balance: 5.3819,
    color: "#60a5fa"
  },
  {
    code: "USDT",
    name: "Tether",
    price: 1.0,
    change: 0.02,
    balance: 32_140.55,
    color: "#14b8a6"
  }
];

const TESTIMONIALS: Array<Testimonial> = [
  {
    name: "Elena Kravtsova",
    role: {
      ru: "Head of Treasury, QuantDesk",
      en: "Head of Treasury, QuantDesk",
      de: "Head of Treasury, QuantDesk"
    },
    comment: {
      ru: "The best mobile exchange we used: predictable execution and full control feel.",
      en: "The best mobile exchange we used: predictable execution and full control feel.",
      de: "The best mobile exchange we used: predictable execution and full control feel."
    },
    rating: 5
  },
  {
    name: "Daniel Wright",
    role: {
      ru: "Portfolio Manager, Northfield Capital",
      en: "Portfolio Manager, Northfield Capital",
      de: "Portfolio Manager, Northfield Capital"
    },
    comment: {
      ru: "The interface never distracts. In 10 seconds we see risk, outcomes, and next actions.",
      en: "The interface never distracts. In 10 seconds we see risk, outcomes, and next actions.",
      de: "The interface never distracts. In 10 seconds we see risk, outcomes, and next actions."
    },
    rating: 5
  },
  {
    name: "Sophia Vogel",
    role: {
      ru: "Ops Lead, Alpine Digital",
      en: "Ops Lead, Alpine Digital",
      de: "Ops Lead, Alpine Digital"
    },
    comment: {
      ru: "The motion and structure create private-banking trust from the first screen.",
      en: "The motion and structure create private-banking trust from the first screen.",
      de: "The motion and structure create private-banking trust from the first screen."
    },
    rating: 5
  }
];

const LOCALE_TAG_BY_LANGUAGE: Record<Locale, string> = {
  ru: "ru-RU",
  en: "en-US",
  de: "de-DE"
};

export function DashboardScreen() {
  const { t, locale, setLocale } = useI18n();
  const { username, firstName, userId } = useTelegram();

  const [isOnboarded, setOnboarded] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      window.localStorage.getItem(ONBOARDED_STORAGE_KEY) === "1" ||
      window.localStorage.getItem(PROFILE_STORAGE_KEY) !== null
    );
  });

  const [profile, setProfile] = useState<ProfileData>(() => {
    const stored = readStoredProfile();
    if (stored) {
      return stored;
    }
    return {
      id: userId ? `TG-${userId}` : "NX-845291",
      username: username ?? "prime.account",
      email: "ops@nexosite.io",
      country: "de",
      language: locale,
      registeredAt: "2025-06-18T09:14:00.000Z"
    };
  });

  const [balance, setBalance] = useState(248_927.2);
  const [balanceChange, setBalanceChange] = useState(2.4);
  const [isRefreshingBalance, setRefreshingBalance] = useState(false);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOnboarded || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(ONBOARDED_STORAGE_KEY, "1");
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [isOnboarded, profile]);

  useEffect(() => {
    if (!isOnboarded) {
      return;
    }
    setProfile((previous) => ({ ...previous, language: locale }));
  }, [isOnboarded, locale]);

  useEffect(() => {
    let shimmerTimeoutId: number | undefined;
    const intervalId = window.setInterval(() => {
      setBalance((previous) => Math.max(20_000, previous + Math.random() * 720 - 220));
      setBalanceChange((previous) => clamp(previous + (Math.random() * 0.5 - 0.2), -4.2, 6.8));
      setRefreshingBalance(true);
      if (typeof shimmerTimeoutId === "number") {
        window.clearTimeout(shimmerTimeoutId);
      }
      shimmerTimeoutId = window.setTimeout(() => {
        setRefreshingBalance(false);
      }, 720);
    }, 9200);

    return () => {
      window.clearInterval(intervalId);
      if (typeof shimmerTimeoutId === "number") {
        window.clearTimeout(shimmerTimeoutId);
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveReviewIndex((previous) => (previous + 1) % TESTIMONIALS.length);
    }, 6500);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (targetNode && menuRef.current && !menuRef.current.contains(targetNode)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const localeTag = LOCALE_TAG_BY_LANGUAGE[locale];
  const animatedBalance = useAnimatedNumber(balance, 0.94);
  const availableFunds = balance * 0.82;
  const reservedFunds = balance * 0.18;
  const animatedAvailable = useAnimatedNumber(availableFunds, 0.92);
  const animatedReserved = useAnimatedNumber(reservedFunds, 0.92);

  const metrics = useMemo<Array<AnalyticsMetric>>(
    () => [
      {
        id: "win-rate",
        label: t("dashboard.analytics.winRate"),
        value: 68.4,
        decimals: 1,
        suffix: "%",
        tone: "positive"
      },
      {
        id: "avg-profit",
        label: t("dashboard.analytics.avgProfit"),
        value: 4.72,
        decimals: 2,
        suffix: "%",
        prefix: "+",
        tone: "positive"
      },
      {
        id: "avg-loss",
        label: t("dashboard.analytics.avgLoss"),
        value: 1.38,
        decimals: 2,
        suffix: "%",
        prefix: "-",
        tone: "negative"
      },
      {
        id: "profit-factor",
        label: t("dashboard.analytics.profitFactor"),
        value: 2.14,
        decimals: 2,
        suffix: "",
        tone: "neutral"
      }
    ],
    [t]
  );

  const review = TESTIMONIALS[activeReviewIndex] ?? TESTIMONIALS[0];

  if (!isOnboarded) {
    return (
      <OnboardingScreen
        locale={locale}
        telegramFirstName={firstName}
        onLocaleChange={setLocale}
        onComplete={(payload) => {
          const nextProfile = createMockProfile(payload, firstName ?? username, userId);
          setLocale(payload.language);
          setProfile(nextProfile);
          setOnboarded(true);
        }}
      />
    );
  }

  if (!review) {
    return null;
  }

  return (
    <main className="dashboard-shell">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 pb-8 pt-5 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="institution-card relative flex items-center justify-between gap-3 overflow-visible p-4 sm:p-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-emblem">
              <BrandGlyph />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-textSecondary">{t("common.live")}</p>
              <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-textPrimary sm:text-[22px]">
                {t("app.name")}
              </h1>
              <p className="mt-1 text-[11px] text-textSecondary">{t("dashboard.header.updated")}</p>
            </div>
          </div>

          <div ref={menuRef} className="relative flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="profile-trigger-button"
              onClick={() => setMenuOpen((previous) => !previous)}
            >
              <span className="profile-avatar">
                <UserGlyph />
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[11px] text-textSecondary">{t("dashboard.header.greeting")}</span>
                <span className="block max-w-[128px] truncate text-sm font-semibold text-textPrimary">{profile.username}</span>
              </span>
              <ChevronGlyph open={menuOpen} />
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="menu-panel"
                >
                  <button type="button" className="menu-item">
                    {t("dashboard.menu.security")}
                  </button>
                  <button type="button" className="menu-item">
                    {t("dashboard.menu.settings")}
                  </button>
                  <button type="button" className="menu-item">
                    {t("dashboard.menu.support")}
                  </button>
                  <button type="button" className="menu-item menu-item-danger">
                    {t("dashboard.menu.logout")}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.06, ease: EASE }}
          className={cx("institution-card balance-panel relative overflow-hidden p-5 sm:p-6", isRefreshingBalance && "balance-shimmer")}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-textSecondary">{t("dashboard.balance.title")}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-textPrimary">
              {formatCurrency(animatedBalance, localeTag)}
            </p>
            <span className={cx("change-indicator", balanceChange >= 0 ? "change-indicator-positive" : "change-indicator-negative")}>
              {balanceChange >= 0 ? "+" : "-"} {Math.abs(balanceChange).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-sm text-textSecondary">{t("dashboard.balance.subtitle")}</p>
          <div className="mt-5 grid gap-2 text-sm text-textSecondary sm:grid-cols-2">
            <div className="rounded-[12px] border border-soft bg-slate-900/30 px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.16em]">{t("dashboard.balance.available")}</span>
              <p className="mt-1 text-base font-semibold text-textPrimary">{formatCurrency(animatedAvailable, localeTag)}</p>
            </div>
            <div className="rounded-[12px] border border-soft bg-slate-900/30 px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.16em]">{t("dashboard.balance.reserved")}</span>
              <p className="mt-1 text-base font-semibold text-textPrimary">{formatCurrency(animatedReserved, localeTag)}</p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.12, ease: EASE }}
          className="grid gap-3 sm:grid-cols-3"
        >
          <ActionButton label={t("dashboard.actions.deposit")} icon={<DepositGlyph />} tone="blue" />
          <ActionButton label={t("dashboard.actions.withdraw")} icon={<WithdrawGlyph />} tone="teal" />
          <ActionButton label={t("dashboard.actions.exchange")} icon={<ExchangeGlyph />} tone="slate" />
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.18, ease: EASE }}
          className="grid gap-4 lg:grid-cols-12"
        >
          <section className="institution-card p-5 lg:col-span-4">
            <SectionLabel title={t("dashboard.profile.title")} />
            <dl className="mt-3 space-y-3">
              <ProfileRow label={t("dashboard.profile.id")} value={profile.id} />
              <ProfileRow label={t("dashboard.profile.email")} value={profile.email} />
              <ProfileRow label={t("dashboard.profile.country")} value={t(`common.country.${profile.country}`)} />
              <ProfileRow label={t("dashboard.profile.language")} value={t(`common.language.${profile.language}`)} />
              <ProfileRow label={t("dashboard.profile.registered")} value={formatDate(profile.registeredAt, localeTag)} />
            </dl>
          </section>

          <section className="institution-card p-5 lg:col-span-8">
            <SectionLabel title={t("dashboard.assets.title")} />
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {ASSETS.map((asset) => {
                const positionValue = asset.price * asset.balance;
                return (
                  <motion.article
                    key={asset.code}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="asset-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="asset-icon" style={{ borderColor: `${asset.color}88`, background: `${asset.color}26` }}>
                          {asset.code}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-textPrimary">{asset.name}</p>
                          <p className="text-xs text-textSecondary">{asset.code}</p>
                        </div>
                      </div>
                      <span className={cx("asset-change", asset.change >= 0 ? "asset-change-positive" : "asset-change-negative")}>
                        {asset.change >= 0 ? "+" : ""}
                        {asset.change.toFixed(2)}%
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <AssetRow label={t("dashboard.assets.price")} value={formatCurrency(asset.price, localeTag)} />
                      <AssetRow label={t("dashboard.assets.balance")} value={`${formatAssetAmount(asset.balance)} ${asset.code}`} />
                      <AssetRow label="USD" value={formatCurrency(positionValue, localeTag)} />
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="institution-card p-5 lg:col-span-6">
            <SectionLabel title={t("dashboard.reviews.title")} />
            <div className="relative mt-3 min-h-[148px] overflow-hidden rounded-[14px] border border-soft bg-slate-900/28 p-4">
              <AnimatePresence mode="wait">
                <motion.article
                  key={review.name}
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -22 }}
                  transition={{ duration: 0.24, ease: EASE }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">{review.name}</p>
                      <p className="mt-0.5 text-xs text-textSecondary">{review.role[locale] ?? review.role.en}</p>
                    </div>
                    <p className="text-[13px] tracking-[0.18em] text-[#f6c76f]">{renderStars(review.rating)}</p>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-textSecondary">{review.comment[locale] ?? review.comment.en}</p>
                </motion.article>
              </AnimatePresence>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {TESTIMONIALS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveReviewIndex(index)}
                  className={cx("review-dot", index === activeReviewIndex && "review-dot-active")}
                  aria-label={`review-${index + 1}`}
                />
              ))}
            </div>
          </section>

          <section className="institution-card p-5 lg:col-span-6">
            <SectionLabel title={t("dashboard.analytics.title")} subtitle={t("dashboard.analytics.caption")} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {metrics.map((metric) => (
                <MetricTile key={metric.id} {...metric} />
              ))}
            </div>
          </section>
        </motion.div>
      </div>
    </main>
  );
}

function OnboardingScreen({ locale, telegramFirstName, onLocaleChange, onComplete }: OnboardingProps) {
  const { t } = useI18n();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<Locale>(locale);
  const [country, setCountry] = useState<CountryCode>("de");

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPrimaryEnabled = step === 1 ? isEmailValid : true;

  const stepLabel = step === 1 ? t("onboarding.step.one") : t("onboarding.step.two");
  const actionLabel = step === 1 ? t("onboarding.continue") : t("onboarding.enter");

  return (
    <main className="dashboard-shell flex items-center justify-center px-4 py-10">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: EASE }}
        className="institution-card onboarding-panel w-full max-w-[560px] p-6 sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="inline-flex rounded-full border border-trust/30 bg-trust/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-trust">
            {t("onboarding.badge")}
          </span>
          <span className="text-xs uppercase tracking-[0.16em] text-textSecondary">{stepLabel}</span>
        </div>

        <h1 className="font-display text-[30px] leading-tight tracking-[-0.03em] text-textPrimary">{t("onboarding.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-textSecondary">{t("onboarding.subtitle")}</p>
        {telegramFirstName ? (
          <p className="mt-2 text-xs text-trust/90">{`${t("dashboard.header.greeting")}, ${telegramFirstName}`}</p>
        ) : null}

        <div className="mt-6 min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="space-y-5"
            >
              {step === 1 ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-textSecondary">{t("onboarding.email.label")}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value.trim())}
                    placeholder={t("onboarding.email.placeholder")}
                    className="onboarding-input"
                  />
                </label>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-textSecondary">{t("onboarding.language.label")}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["ru", "en", "de"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setLanguage(option);
                            onLocaleChange(option);
                          }}
                          className={cx("select-chip", language === option && "select-chip-active")}
                        >
                          {t(`common.language.${option}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-textSecondary">{t("onboarding.country.label")}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {COUNTRY_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setCountry(option)}
                          className={cx("select-chip text-left", country === option && "select-chip-active")}
                        >
                          {t(`common.country.${option}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={!isPrimaryEnabled}
          onClick={() => {
            if (step === 1) {
              setStep(2);
              return;
            }

            onComplete({
              email,
              language,
              country
            });
          }}
          className="primary-action-button"
        >
          {actionLabel}
        </motion.button>
      </motion.section>
    </main>
  );
}

function ActionButton({ label, icon, tone }: ActionButtonProps) {
  const [ripples, setRipples] = useState<Array<Ripple>>([]);

  const toneClass =
    tone === "blue"
      ? "action-button-blue"
      : tone === "teal"
        ? "action-button-teal"
        : "action-button-slate";

  const createRipple = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextRipple: Ripple = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
    setRipples((previous) => [...previous, nextRipple]);
    window.setTimeout(() => {
      setRipples((previous) => previous.filter((ripple) => ripple.id !== nextRipple.id));
    }, 620);
  };

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE }}
      onPointerDown={createRipple}
      className={cx("action-depth-button", toneClass)}
    >
      <span className="relative z-[2] flex items-center justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/15 bg-white/10 text-textPrimary">
          {icon}
        </span>
        <span className="text-sm font-semibold tracking-[0.01em] text-textPrimary">{label}</span>
      </span>
      {ripples.map((ripple) => (
        <span key={ripple.id} className="action-ripple" style={{ left: ripple.x, top: ripple.y }} />
      ))}
    </motion.button>
  );
}

function MetricTile({ label, value, decimals, suffix, prefix = "", tone = "neutral" }: MetricTileProps) {
  const animatedValue = useAnimatedNumber(value, 0.86);
  const valueClass = tone === "positive" ? "text-profit" : tone === "negative" ? "text-loss" : "text-textPrimary";

  return (
    <article className="metric-card">
      <p className="text-xs uppercase tracking-[0.14em] text-textSecondary">{label}</p>
      <p className={cx("mt-2 text-[24px] font-semibold tracking-[-0.02em]", valueClass)}>
        {prefix}
        {animatedValue.toFixed(decimals)}
        {suffix}
      </p>
    </article>
  );
}

function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-textPrimary">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-[0.14em] text-textSecondary">{subtitle}</p> : null}
    </header>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[11px] border border-soft bg-slate-900/26 px-3 py-2.5">
      <dt className="text-xs uppercase tracking-[0.14em] text-textSecondary">{label}</dt>
      <dd className="text-sm font-medium text-textPrimary">{value}</dd>
    </div>
  );
}

function AssetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.14em] text-textSecondary">{label}</span>
      <span className="text-sm font-semibold text-textPrimary">{value}</span>
    </div>
  );
}

function formatCurrency(value: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(dateIso: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(new Date(dateIso));
}

function formatAssetAmount(value: number) {
  return value >= 1000 ? value.toFixed(2) : value.toFixed(4);
}

function renderStars(rating: number) {
  return Array.from({ length: rating }, () => "★").join("");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createMockProfile(payload: OnboardingPayload, fallbackName: string | undefined, userId: number | undefined): ProfileData {
  const usernameSeed = fallbackName ?? payload.email.split("@")[0] ?? "prime.account";
  const normalizedUsername = usernameSeed.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "");
  return {
    id: userId ? `TG-${userId}` : `NX-${Math.floor(100000 + Math.random() * 900000)}`,
    username: normalizedUsername || "prime.account",
    email: payload.email,
    country: payload.country,
    language: payload.language,
    registeredAt: new Date().toISOString()
  };
}

function readStoredProfile(): ProfileData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileData>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.username === "string" &&
      typeof parsed.email === "string" &&
      isCountryCode(parsed.country) &&
      isLocale(parsed.language) &&
      typeof parsed.registeredAt === "string"
    ) {
      return {
        id: parsed.id,
        username: parsed.username,
        email: parsed.email,
        country: parsed.country,
        language: parsed.language,
        registeredAt: parsed.registeredAt
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en" || value === "de";
}

function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && (COUNTRY_OPTIONS as readonly string[]).includes(value);
}

function BrandGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M4.5 5.2h5.7L17.5 16.8h-5.7z" fill="currentColor" opacity="0.9" />
      <path d="M4.5 16.8h5.7l7.3-11.6h-5.7z" fill="currentColor" opacity="0.52" />
    </svg>
  );
}

function UserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 18.5a7.25 7.25 0 0114.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

function DepositGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v16M5 11l7 7 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WithdrawGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20V4M5 13l7-7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ExchangeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7h12M19 7l-2.5-2.5M19 7l-2.5 2.5M17 17H5M5 17l2.5-2.5M5 17l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
