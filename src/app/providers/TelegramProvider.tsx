import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
}

interface TelegramUser {
  id?: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}

interface TelegramInitDataUnsafe {
  user?: TelegramUser;
}

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  themeParams?: TelegramThemeParams;
  isExpanded?: boolean;
  initDataUnsafe?: TelegramInitDataUnsafe;
}

interface TelegramGlobal {
  WebApp?: TelegramWebApp;
}

declare global {
  interface Window {
    Telegram?: TelegramGlobal;
  }
}

interface TelegramContextValue {
  webAppAvailable: boolean;
  isExpanded: boolean;
  languageCode?: string;
  username?: string;
  userId?: number;
  firstName?: string;
}

const TelegramContext = createContext<TelegramContextValue>({
  webAppAvailable: false,
  isExpanded: false,
  languageCode: undefined,
  username: undefined,
  userId: undefined,
  firstName: undefined
});

export function TelegramProvider({ children }: PropsWithChildren) {
  const webApp = window.Telegram?.WebApp;

  useEffect(() => {
    if (!webApp) {
      return;
    }

    webApp.ready?.();
    webApp.expand?.();

    const hintColor = webApp.themeParams?.hint_color;
    if (hintColor) {
      document.documentElement.style.setProperty("--text-secondary", hintColor);
    }
  }, [webApp]);

  const value = useMemo<TelegramContextValue>(
    () => ({
      webAppAvailable: Boolean(webApp),
      isExpanded: Boolean(webApp?.isExpanded),
      languageCode: webApp?.initDataUnsafe?.user?.language_code,
      username: webApp?.initDataUnsafe?.user?.username,
      userId: webApp?.initDataUnsafe?.user?.id,
      firstName: webApp?.initDataUnsafe?.user?.first_name
    }),
    [webApp]
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegram() {
  return useContext(TelegramContext);
}
