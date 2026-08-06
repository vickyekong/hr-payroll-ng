import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
        },
        lagoon: {
          DEFAULT: "var(--lagoon)",
          deep: "var(--lagoon-deep)",
          mist: "var(--lagoon-mist)",
        },
        mist: "var(--mist)",
        foam: "var(--foam)",
        sand: "var(--sand)",
        line: "var(--line)",
        muted: "var(--muted)",
        signal: "var(--signal)",
        ok: "var(--ok)",
        warn: "var(--warn)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "ui-sans-serif", "system-ui"],
        display: ["var(--font-fraunces)", "Fraunces", "ui-serif", "Georgia"],
      },
      borderRadius: {
        xl: "var(--radius)",
      },
      boxShadow: {
        soft: "0 1px 0 rgba(11, 46, 51, 0.04), 0 8px 24px -12px rgba(11, 46, 51, 0.12)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
