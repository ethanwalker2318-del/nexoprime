import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { useTelegram } from "./TelegramProvider";

type Dictionary = Record<string, string>;

export type Locale = "ru" | "en" | "de";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LOCALE_STORAGE_KEY = "nexosite.locale";

const ru: Dictionary = {
  "app.name": "NexoSite Prime",
  "common.language.ru": "Русский",
  "common.language.en": "English",
  "common.language.de": "Deutsch",
  "common.country.de": "Германия",
  "common.country.ae": "ОАЭ",
  "common.country.sg": "Сингапур",
  "common.country.gb": "Великобритания",
  "common.country.ch": "Швейцария",
  "common.live": "Live",
  "onboarding.badge": "Институциональный доступ",
  "onboarding.title": "Завершите быструю регистрацию",
  "onboarding.subtitle": "Мы настраиваем безопасный доступ и персонализируем интерфейс для вашего региона.",
  "onboarding.step.one": "Шаг 1 из 3",
  "onboarding.step.two": "Шаг 2 из 3",
  "onboarding.step.three": "Шаг 3 из 3",
  "onboarding.email.label": "Email",
  "onboarding.email.placeholder": "name@company.com",
  "onboarding.code.label": "Код подтверждения",
  "onboarding.code.placeholder": "Введите 6-значный код",
  "onboarding.language.label": "Язык интерфейса",
  "onboarding.country.label": "Страна",
  "onboarding.note": "Код подтверждения моковый. Введите любые 6 цифр для продолжения.",
  "onboarding.continue": "Продолжить",
  "onboarding.verify": "Подтвердить код",
  "onboarding.enter": "Войти в Dashboard",
  "dashboard.header.greeting": "Добро пожаловать",
  "dashboard.header.updated": "Обновлено 12 сек назад",
  "dashboard.menu.security": "Центр безопасности",
  "dashboard.menu.settings": "Настройки",
  "dashboard.menu.support": "Поддержка",
  "dashboard.menu.logout": "Выйти",
  "dashboard.balance.title": "Общий баланс",
  "dashboard.balance.subtitle": "Оценка портфеля в USD",
  "dashboard.balance.available": "Доступно",
  "dashboard.balance.reserved": "В ордерах",
  "dashboard.actions.deposit": "Пополнить",
  "dashboard.actions.withdraw": "Вывести",
  "dashboard.actions.exchange": "Обменять",
  "dashboard.profile.title": "Профиль",
  "dashboard.profile.id": "ID",
  "dashboard.profile.email": "Email",
  "dashboard.profile.country": "Страна",
  "dashboard.profile.language": "Язык",
  "dashboard.profile.registered": "Дата регистрации",
  "dashboard.assets.title": "Криптоактивы",
  "dashboard.assets.price": "Цена",
  "dashboard.assets.change": "24ч",
  "dashboard.assets.balance": "Баланс",
  "dashboard.reviews.title": "Отзывы клиентов",
  "dashboard.analytics.title": "Аналитика",
  "dashboard.analytics.caption": "Статистика за 30 дней",
  "dashboard.analytics.winRate": "Win Rate",
  "dashboard.analytics.avgProfit": "Средняя прибыль",
  "dashboard.analytics.avgLoss": "Средний убыток",
  "dashboard.analytics.profitFactor": "Profit Factor"
};

const en: Dictionary = {
  "app.name": "NexoSite Prime",
  "common.language.ru": "Russian",
  "common.language.en": "English",
  "common.language.de": "German",
  "common.country.de": "Germany",
  "common.country.ae": "United Arab Emirates",
  "common.country.sg": "Singapore",
  "common.country.gb": "United Kingdom",
  "common.country.ch": "Switzerland",
  "common.live": "Live",
  "onboarding.badge": "Institutional Access",
  "onboarding.title": "Complete quick registration",
  "onboarding.subtitle": "We configure secure access and personalize the workspace for your region.",
  "onboarding.step.one": "Step 1 of 3",
  "onboarding.step.two": "Step 2 of 3",
  "onboarding.step.three": "Step 3 of 3",
  "onboarding.email.label": "Email",
  "onboarding.email.placeholder": "name@company.com",
  "onboarding.code.label": "Verification code",
  "onboarding.code.placeholder": "Enter 6-digit code",
  "onboarding.language.label": "Interface language",
  "onboarding.country.label": "Country",
  "onboarding.note": "Verification is mocked. Enter any 6 digits to continue.",
  "onboarding.continue": "Continue",
  "onboarding.verify": "Verify code",
  "onboarding.enter": "Enter Dashboard",
  "dashboard.header.greeting": "Welcome back",
  "dashboard.header.updated": "Updated 12 sec ago",
  "dashboard.menu.security": "Security Center",
  "dashboard.menu.settings": "Settings",
  "dashboard.menu.support": "Support",
  "dashboard.menu.logout": "Log out",
  "dashboard.balance.title": "Total balance",
  "dashboard.balance.subtitle": "Portfolio valuation in USD",
  "dashboard.balance.available": "Available",
  "dashboard.balance.reserved": "In orders",
  "dashboard.actions.deposit": "Deposit",
  "dashboard.actions.withdraw": "Withdraw",
  "dashboard.actions.exchange": "Exchange",
  "dashboard.profile.title": "Profile",
  "dashboard.profile.id": "ID",
  "dashboard.profile.email": "Email",
  "dashboard.profile.country": "Country",
  "dashboard.profile.language": "Language",
  "dashboard.profile.registered": "Registered",
  "dashboard.assets.title": "Crypto assets",
  "dashboard.assets.price": "Price",
  "dashboard.assets.change": "24h",
  "dashboard.assets.balance": "Balance",
  "dashboard.reviews.title": "Client reviews",
  "dashboard.analytics.title": "Analytics",
  "dashboard.analytics.caption": "30-day trading stats",
  "dashboard.analytics.winRate": "Win Rate",
  "dashboard.analytics.avgProfit": "Avg. Profit",
  "dashboard.analytics.avgLoss": "Avg. Loss",
  "dashboard.analytics.profitFactor": "Profit Factor"
};

const de: Dictionary = {
  "app.name": "NexoSite Prime",
  "common.language.ru": "Russisch",
  "common.language.en": "Englisch",
  "common.language.de": "Deutsch",
  "common.country.de": "Deutschland",
  "common.country.ae": "VAE",
  "common.country.sg": "Singapur",
  "common.country.gb": "Vereinigtes Königreich",
  "common.country.ch": "Schweiz",
  "common.live": "Live",
  "onboarding.badge": "Institutioneller Zugang",
  "onboarding.title": "Schnelle Registrierung abschließen",
  "onboarding.subtitle": "Wir konfigurieren sicheren Zugang und personalisieren die Oberfläche für Ihre Region.",
  "onboarding.step.one": "Schritt 1 von 3",
  "onboarding.step.two": "Schritt 2 von 3",
  "onboarding.step.three": "Schritt 3 von 3",
  "onboarding.email.label": "E-Mail",
  "onboarding.email.placeholder": "name@company.com",
  "onboarding.code.label": "Bestätigungscode",
  "onboarding.code.placeholder": "6-stelligen Code eingeben",
  "onboarding.language.label": "Sprache",
  "onboarding.country.label": "Land",
  "onboarding.note": "Die Verifizierung ist ein Mock. Beliebige 6 Ziffern eingeben.",
  "onboarding.continue": "Weiter",
  "onboarding.verify": "Code bestätigen",
  "onboarding.enter": "Zum Dashboard",
  "dashboard.header.greeting": "Willkommen zurück",
  "dashboard.header.updated": "Vor 12 Sek. aktualisiert",
  "dashboard.menu.security": "Sicherheitscenter",
  "dashboard.menu.settings": "Einstellungen",
  "dashboard.menu.support": "Support",
  "dashboard.menu.logout": "Abmelden",
  "dashboard.balance.title": "Gesamtguthaben",
  "dashboard.balance.subtitle": "Portfolio-Bewertung in USD",
  "dashboard.balance.available": "Verfügbar",
  "dashboard.balance.reserved": "In Orders",
  "dashboard.actions.deposit": "Einzahlen",
  "dashboard.actions.withdraw": "Auszahlen",
  "dashboard.actions.exchange": "Tauschen",
  "dashboard.profile.title": "Profil",
  "dashboard.profile.id": "ID",
  "dashboard.profile.email": "E-Mail",
  "dashboard.profile.country": "Land",
  "dashboard.profile.language": "Sprache",
  "dashboard.profile.registered": "Registriert",
  "dashboard.assets.title": "Krypto-Assets",
  "dashboard.assets.price": "Preis",
  "dashboard.assets.change": "24h",
  "dashboard.assets.balance": "Bestand",
  "dashboard.reviews.title": "Kundenbewertungen",
  "dashboard.analytics.title": "Analytik",
  "dashboard.analytics.caption": "30-Tage Trading-Statistik",
  "dashboard.analytics.winRate": "Win Rate",
  "dashboard.analytics.avgProfit": "Ø Gewinn",
  "dashboard.analytics.avgLoss": "Ø Verlust",
  "dashboard.analytics.profitFactor": "Profit Factor"
};

const dictionaries: Record<Locale, Dictionary> = {
  ru,
  en,
  de
};

function isLocale(input: string | null): input is Locale {
  return input === "ru" || input === "en" || input === "de";
}

function resolveLocale(input: string | undefined): Locale {
  const normalized = input?.toLowerCase() ?? "";
  if (normalized.startsWith("ru")) {
    return "ru";
  }
  if (normalized.startsWith("de")) {
    return "de";
  }
  return "en";
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => undefined,
  t: (key) => key
});

export function I18nProvider({ children }: PropsWithChildren) {
  const { languageCode } = useTelegram();

  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    if (isLocale(stored)) {
      return stored;
    }

    const source = languageCode ?? (typeof navigator !== "undefined" ? navigator.language : "en");
    return resolveLocale(source);
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
