import type { Config } from "tailwindcss";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primaryBg: "var(--bg-0)",
        surfaceBg: "var(--surface-1)",
        elevatedBg: "var(--surface-2)",
        trust: "var(--accent)",
        profit: "var(--pos)",
        loss: "var(--neg)",
        textPrimary: "var(--text-1)",
        textSecondary: "var(--text-2)"
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
      },
      borderColor: {
        soft: "var(--line-1)"
      },
      boxShadow: {
        surface: "var(--shadow-card)",
        elevated: "var(--shadow-sheet)",
        interactive: "var(--shadow-modal)"
      },
      borderRadius: {
        smx: "var(--r-sm)",
        mdx: "var(--r-md)",
        lgx: "var(--r-lg)"
      }
    }
  }
};

export default preset;
