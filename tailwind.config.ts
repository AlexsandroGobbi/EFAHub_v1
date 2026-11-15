import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171916",
        muted: "#777b73",
        canvas: "#f6f7f5",
        brand: "#7a2438",
        "brand-light": "#f7e9ed",
        "brand-wine-light": "#ad5368",
        success: "#217a5b"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(24, 28, 22, .06)"
      }
    }
  },
  plugins: []
};

export default config;
