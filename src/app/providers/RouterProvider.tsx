import { createContext, useContext, useState, type PropsWithChildren } from "react";
import type { Screen } from "../router";

interface RouterContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
}

const RouterContext = createContext<RouterContextValue>({
  screen: "dashboard",
  navigate: () => undefined
});

export function RouterProvider({ children }: PropsWithChildren) {
  const [screen, setScreen] = useState<Screen>("dashboard");

  return (
    <RouterContext.Provider value={{ screen, navigate: setScreen }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}
