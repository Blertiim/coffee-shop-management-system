/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pos: {
          bg: "#EAF2FB",
          panel: "#FFFFFF",
          panelSoft: "#EEF5FF",
          card: "#FFFFFF",
          accent: "#1FA2FF",
          accentSoft: "#5C8DFF",
          warn: "#F4A340",
          danger: "#EB5A6B",
          text: "#12213D",
          muted: "#5C7093",
        },
      },
      boxShadow: {
        pos: "0 10px 28px rgba(20, 45, 84, 0.12)",
      },
      borderRadius: {
        pos: "16px",
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
        sans: ["Manrope", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
