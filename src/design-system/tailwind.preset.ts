import type { Config } from "tailwindcss";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primaryBg: "var(--bg-primary)",
        surfaceBg: "var(--bg-surface)",
        elevatedBg: "var(--bg-elevated)",
        trust: "var(--accent-trust)",
        profit: "var(--profit)",
        loss: "var(--loss)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)"
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-ui)", "sans-serif"]
      },
      borderColor: {
        soft: "var(--border-soft)"
      },
      boxShadow: {
        surface: "var(--shadow-surface)",
        elevated: "var(--shadow-elevated)",
        interactive: "var(--shadow-interactive)"
      },
      borderRadius: {
        smx: "var(--radius-sm)",
        mdx: "var(--radius-md)",
        lgx: "var(--radius-lg)"
      }
    }
  }
};

export default preset;
