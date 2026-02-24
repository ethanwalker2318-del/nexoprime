import { createContext, useContext, useState, type PropsWithChildren } from "react";
import type { Screen } from "../router";

interface RouterContextValue {
  screen:         Screen;
  navigate:       (screen: Screen) => void;
  tradePair:      string | null;
  navigateToTrade:(pair: string) => void;
}

const RouterContext = createContext<RouterContextValue>({
  screen:          "home",
  navigate:        () => undefined,
  tradePair:       null,
  navigateToTrade: () => undefined,
});

export function RouterProvider({ children }: PropsWithChildren) {
  const [screen,    setScreen]    = useState<Screen>("home");
  const [tradePair, setTradePair] = useState<string | null>(null);

  function navigateToTrade(pair: string) {
    setTradePair(pair);
    setScreen("trade");
  }

  return (
    <RouterContext.Provider value={{ screen, navigate: setScreen, tradePair, navigateToTrade }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}
