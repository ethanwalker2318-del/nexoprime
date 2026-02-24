import { motion } from "framer-motion";
import type { Screen } from "../../app/router";
import { useRouter } from "../../app/providers/RouterProvider";
import { useI18n } from "../../app/providers/I18nProvider";
import { cx } from "../lib/cx";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface NavItem {
  screen: Screen;
  labelKey: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z"
        stroke="currentColor"
        strokeWidth={active ? "1.8" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M9 22V12h6v10"
        stroke="currentColor"
        strokeWidth={active ? "1.8" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TradeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4" y="13" width="3" height="7" rx="1"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}
      />
      <rect
        x="10.5" y="8" width="3" height="12" rx="1"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0}
      />
      <rect
        x="17" y="4" width="3" height="16" rx="1"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2" y="6" width="20" height="14" rx="2"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.1 : 0}
      />
      <path
        d="M2 10h20"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round"
      />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" fillOpacity={active ? 1 : 0.5} />
      <path
        d="M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round"
      />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline
        points="3,17 9,11 13,15 21,7"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        strokeLinecap="round" strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M17 7h4v4"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M3 20h18"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12" cy="8" r="3.5"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"}
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M4.75 19.5a7.25 7.25 0 0114.5 0"
        stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomNav() {
  const { screen, navigate } = useRouter();
  const { t } = useI18n();

  const navItems: NavItem[] = [
    {
      screen: "dashboard",
      labelKey: "nav.home",
      icon: <HomeIcon active={false} />,
      activeIcon: <HomeIcon active={true} />
    },
    {
      screen: "trade",
      labelKey: "nav.trade",
      icon: <TradeIcon active={false} />,
      activeIcon: <TradeIcon active={true} />
    },
    {
      screen: "wallet",
      labelKey: "nav.wallet",
      icon: <WalletIcon active={false} />,
      activeIcon: <WalletIcon active={true} />
    },
    {
      screen: "analytics",
      labelKey: "nav.analytics",
      icon: <AnalyticsIcon active={false} />,
      activeIcon: <AnalyticsIcon active={true} />
    },
    {
      screen: "profile",
      labelKey: "nav.profile",
      icon: <ProfileIcon active={false} />,
      activeIcon: <ProfileIcon active={true} />
    }
  ];

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive = screen === item.screen;
        return (
          <button
            key={item.screen}
            type="button"
            onClick={() => navigate(item.screen)}
            className={cx("bottom-nav-item", isActive && "bottom-nav-item-active")}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="bottom-nav-icon">
              {isActive ? item.activeIcon : item.icon}
              {isActive && (
                <motion.span
                  layoutId="nav-indicator"
                  className="bottom-nav-indicator"
                  transition={{ duration: 0.2, ease: EASE }}
                />
              )}
            </span>
            <span className="bottom-nav-label">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
