import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const renderBootError = (error) => {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    return;
  }

  const message =
    error?.message || error?.reason?.message || String(error?.reason || error || "Unknown error");

  rootElement.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1217;padding:24px;font-family:Arial,sans-serif;color:#fff;">
      <section style="max-width:720px;width:100%;border:1px solid rgba(255,120,120,0.35);background:rgba(80,20,20,0.45);border-radius:16px;padding:24px;">
        <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#ffc9c9;">Application Error</p>
        <h1 style="margin:0 0 12px 0;font-size:28px;">The page could not start</h1>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#ffe2e2;">${message}</p>
      </section>
    </main>
  `;
};

window.addEventListener("error", (event) => {
  renderBootError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderBootError(event.reason || event);
});

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  renderBootError(error);
}
