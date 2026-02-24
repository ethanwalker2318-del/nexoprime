import type { Config } from "tailwindcss";
import preset from "./src/design-system/tailwind.preset";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  presets: [preset as Config],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
