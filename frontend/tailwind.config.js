/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pos: {
          bg: "#060B16",
          panel: "#0E1629",
          panelSoft: "#131E34",
          card: "#1A2742",
          accent: "#2AB6FF",
          accentSoft: "#43D39E",
          warn: "#F89E1B",
          danger: "#EE5D62",
          text: "#ECF3FF",
          muted: "#98A9C8",
        },
      },
      boxShadow: {
        pos: "0 14px 34px rgba(0, 0, 0, 0.32)",
      },
      borderRadius: {
        pos: "14px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 220ms ease-out",
      },
      fontFamily: {
        sans: ["Segoe UI Variable Display", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
