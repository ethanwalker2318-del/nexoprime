import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { I18nProvider } from "./providers/I18nProvider";
import { AppMotionProvider } from "./providers/MotionProvider";
import { TelegramProvider } from "./providers/TelegramProvider";

export function App() {
  return (
    <TelegramProvider>
      <I18nProvider>
        <AppMotionProvider>
          <DashboardScreen />
        </AppMotionProvider>
      </I18nProvider>
    </TelegramProvider>
  );
}
