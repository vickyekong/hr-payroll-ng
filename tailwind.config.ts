import type { Config } from "tailwindcss";

const withAlpha = (channel: string) =>
  `rgb(var(${channel}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: withAlpha("--mist"),
        foreground: withAlpha("--ink"),
        ink: {
          DEFAULT: withAlpha("--ink"),
          soft: withAlpha("--ink-soft"),
        },
        lagoon: {
          DEFAULT: withAlpha("--lagoon"),
          deep: withAlpha("--lagoon-deep"),
          mist: withAlpha("--lagoon-mist"),
        },
        mist: withAlpha("--mist"),
        foam: withAlpha("--foam"),
        sand: withAlpha("--sand"),
        line: withAlpha("--line"),
        muted: withAlpha("--muted"),
        signal: withAlpha("--signal"),
        ok: withAlpha("--ok"),
        warn: withAlpha("--warn"),
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
