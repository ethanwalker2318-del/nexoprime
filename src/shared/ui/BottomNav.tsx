import { motion } from "framer-motion";
import type { Screen } from "../../app/router";
import { useRouter } from "../../app/providers/RouterProvider";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface NavItem { screen: Screen; label: string; paths: string[] }

const ITEMS: NavItem[] = [
  {
    screen: "home", label: "Главная",
    paths: [
      "M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z",
      "M9 22V12h6v10",
    ],
  },
  {
    screen: "markets", label: "Рынки",
    paths: [
      "M3 17l6-6 4 4 8-8",
      "M17 7h4v4",
    ],
  },
  {
    screen: "trade", label: "Торговля",
    paths: [
      "M4 13h3v7H4z",
      "M10.5 8h3v12h-3z",
      "M17 4h3v16h-3z",
    ],
  },
  {
    screen: "wallet", label: "Кошелёк",
    paths: [
      "M2 8a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z",
      "M2 12h20",
      "M17 16a1 1 0 100-2 1 1 0 000 2z",
    ],
  },
  {
    screen: "profile", label: "Профиль",
    paths: [
      "M12 11a4 4 0 100-8 4 4 0 000 8z",
      "M5 20a7 7 0 0114 0",
    ],
  },
];

export function BottomNav() {
  const { screen, navigate } = useRouter();

  return (
    <nav
      style={{
        flexShrink: 0,
        height: "calc(var(--nav-height) + var(--safe-bottom))",
        paddingBottom: "var(--safe-bottom)",
        background: "rgba(11,18,32,0.96)",
        borderTop: "1px solid var(--line-1)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "stretch",
        zIndex: 100,
      }}
    >
      {ITEMS.map((item) => {
        const active = screen === item.screen;
        return (
          <button
            key={item.screen}
            onClick={() => navigate(item.screen)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4, border: "none", background: "none",
              color: active ? "var(--accent)" : "var(--text-3)",
              cursor: "pointer", padding: "6px 0", position: "relative",
              transition: "color var(--dur-fast) var(--ease-out)",
            }}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                transition={{ duration: 0.2, ease: EASE }}
                style={{
                  position: "absolute", top: 0, left: "calc(50% - 16px)",
                  width: 32, height: 2, borderRadius: 1,
                  background: "var(--accent)",
                }}
              />
            )}
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor"
              strokeWidth={active ? 2 : 1.6}
              strokeLinecap="round" strokeLinejoin="round"
            >
              {item.paths.map((d, i) => <path key={i} d={d} />)}
            </svg>
            <span style={{
              fontSize: 10, fontWeight: active ? 600 : 400,
              letterSpacing: 0.1, lineHeight: 1,
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
