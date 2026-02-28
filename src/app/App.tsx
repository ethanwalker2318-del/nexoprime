import { AnimatePresence, motion } from "framer-motion";
import { ExchangeProvider } from "../shared/store/exchangeStore";
import { RouterProvider, useRouter } from "./providers/RouterProvider";
import { I18nProvider } from "./providers/I18nProvider";
import { TelegramProvider } from "./providers/TelegramProvider";
import { SocketProvider } from "../shared/providers/SocketProvider";
import { BottomNav } from "../shared/ui/BottomNav";
import { FakeTradeFeed } from "../shared/ui/FakeTradeFeed";
import { Onboarding } from "../features/onboarding/Onboarding";
import { HomeScreen } from "../features/home/HomeScreen";
import { MarketsScreen } from "../features/markets/MarketsScreen";
import { TradeScreen } from "../features/trade/TradeScreen";
import { WalletScreen } from "../features/wallet/WalletScreen";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { SupportChatScreen } from "../features/support/SupportChatScreen";
import { HistoryScreen } from "../features/history/HistoryScreen";
import { useExchange } from "../shared/store/exchangeStore";

const SLIDE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function AppShell() {
  const { screen } = useRouter();
  const { state } = useExchange();

  if (!state.user) return <Onboarding />;

  const screens: Record<string, React.ReactNode> = {
    home:     <HomeScreen />,
    markets:  <MarketsScreen />,
    trade:    <TradeScreen />,
    wallet:   <WalletScreen />,
    profile:  <ProfileScreen />,
    support:  <SupportChatScreen />,
    history:  <HistoryScreen />,
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "var(--bg-0)",
    }}>
      <div style={{
        flex: 1, overflow: "hidden", position: "relative",
        paddingTop: "var(--safe-top)",
      }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: SLIDE }}
            style={{ height: "100%", overflow: "hidden auto" }}
          >
            {screens[screen]}
          </motion.div>
        </AnimatePresence>
      </div>
      {screen !== "support" && screen !== "history" && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <TelegramProvider>
      <I18nProvider>
        <RouterProvider>
          <ExchangeProvider>
            <SocketProvider>
              <FakeTradeFeed />
              <AppShell />
            </SocketProvider>
          </ExchangeProvider>
        </RouterProvider>
      </I18nProvider>
    </TelegramProvider>
  );
}
