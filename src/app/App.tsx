import { AnimatePresence, motion } from "framer-motion";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { WalletScreen } from "../features/wallet/WalletScreen";
import { TradeScreen } from "../features/trade/TradeScreen";
import { AnalyticsScreen } from "../features/analytics/AnalyticsScreen";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { BottomNav } from "../shared/ui/BottomNav";
import { I18nProvider } from "./providers/I18nProvider";
import { AppMotionProvider } from "./providers/MotionProvider";
import { TelegramProvider } from "./providers/TelegramProvider";
import { RouterProvider, useRouter } from "./providers/RouterProvider";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function AppShell() {
  const { screen } = useRouter();

  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="app-screen"
        >
          {screen === "dashboard" && <DashboardScreen />}
          {screen === "trade" && <TradeScreen />}
          {screen === "wallet" && <WalletScreen />}
          {screen === "analytics" && <AnalyticsScreen />}
          {screen === "profile" && <ProfileScreen />}
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}

export function App() {
  return (
    <TelegramProvider>
      <I18nProvider>
        <AppMotionProvider>
          <RouterProvider>
            <AppShell />
          </RouterProvider>
        </AppMotionProvider>
      </I18nProvider>
    </TelegramProvider>
  );
}
