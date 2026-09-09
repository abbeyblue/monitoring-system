import type { Config } from "tailwindcss";

// Semantic colors resolve to CSS variables (RGB triplets) so light/dark swap
// cleanly and Tailwind opacity modifiers (bg-panel/70) still work.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        panel: v("panel"),
        panel2: v("panel2"),
        line: v("line"),
        line2: v("line2"),
        hover: v("hover"),
        ink: v("ink"),
        ink2: v("ink2"),
        muted: v("muted"),
        muted2: v("muted2"),
        accent: v("accent"),
        heading: v("heading"),
        // Health tones — each carries dot / text / fill / border so status
        // surfaces stop needing inline style={{}} with hex-alpha suffixes.
        ok: { DEFAULT: v("ok"), fg: v("ok-fg"), bg: v("ok-bg"), bd: v("ok-bd") },
        warn: { DEFAULT: v("warn"), fg: v("warn-fg"), bg: v("warn-bg"), bd: v("warn-bd") },
        down: { DEFAULT: v("down"), fg: v("down-fg"), bg: v("down-bg"), bd: v("down-bd") },
        idle: { DEFAULT: v("idle"), fg: v("idle-fg"), bg: v("idle-bg"), bd: v("idle-bd") },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Text'", "'Helvetica Neue'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'SF Mono'", "ui-monospace", "Menlo", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        card: "12px",   // panels, cards
        ctl: "9px",     // buttons, pills, inputs
        chip: "7px",    // tabs, small badges
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04)",
        panel: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
      backdropBlur: {
        chrome: "24px",
      },
      keyframes: {
        ping2: { "75%, 100%": { transform: "scale(2.2)", opacity: "0" } },
        abpulse: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.3" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        abpulse: "abpulse 1.6s ease-in-out infinite",
        fade: "fade 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
