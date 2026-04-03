import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || "/api";
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000";
  const shouldProxyApi = apiUrl.startsWith("/");

  const serverConfig = {
    host: true,
    port: 5173,
  };

  if (shouldProxyApi) {
    serverConfig.proxy = {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
    };
  }

  return {
    plugins: [react()],
    server: serverConfig,
    preview: {
      host: true,
      port: 4173,
    },
  };
});
