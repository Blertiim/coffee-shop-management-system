/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pos: {
          bg: "#EAF2FB",
          panel: "#0F2444",
          panelSoft: "#14305A",
          card: "#1A3D70",
          accent: "#1FA2FF",
          accentSoft: "#2CC9A7",
          warn: "#F4A340",
          danger: "#EB5A6B",
          text: "#EFF5FF",
          muted: "#B5C7E4",
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
