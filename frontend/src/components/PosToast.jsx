import { useEffect } from "react";

const TONE_CLASS = {
  success: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  error: "border-red-400/30 bg-red-500/15 text-red-100",
  info: "border-sky-400/30 bg-sky-500/15 text-sky-100",
};

export default function PosToast({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice || !notice.duration) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss();
    }, notice.duration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice, onDismiss]);

  if (!notice?.message) {
    return null;
  }

  const tone = notice.type || "info";

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex w-[min(520px,calc(100vw-2rem))] animate-fade-up">
      <div
        role="status"
        className={`pointer-events-auto flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 shadow-pos backdrop-blur ${TONE_CLASS[tone] || TONE_CLASS.info}`}
      >
        <div>
          <p className="m-0 text-sm font-semibold">
            {tone === "error" ? "Action failed" : "POS update"}
          </p>
          <p className="mt-1 text-sm">{notice.message}</p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="pos-button min-h-[40px] rounded-lg bg-white/20 px-3 text-xs font-semibold text-white hover:bg-white/30"
          aria-label="Dismiss notification"
        >
          Close
        </button>
      </div>
    </div>
  );
}
