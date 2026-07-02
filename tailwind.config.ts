import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#080808",
        elevated: "#111111",
        fg: "#f5f5f5",
        dim: "#888888",
        mute: "#555555",
        accent: "#ff2a2a",
        yellow: "#e5ff00",
        blue: "#2b6fff",
        line: "rgba(255,255,255,0.08)",
        "line-strong": "rgba(255,255,255,0.18)",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "sans-serif"],
        sans: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
