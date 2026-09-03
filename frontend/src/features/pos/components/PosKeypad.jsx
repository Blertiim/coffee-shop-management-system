const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const tileClass =
  "inline-flex min-h-[60px] items-center justify-center rounded-[10px] border border-[#d3e3fa] bg-white text-[#12213d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_14px_rgba(20,55,110,0.08)] transition hover:-translate-y-[1px] hover:border-[#8fb8ee] hover:bg-[#f3f8ff] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[64px] xl:min-h-[68px]";

const digitClass = `${tileClass} text-[1.7rem] font-semibold`;
const backClass =
  "inline-flex min-h-[60px] flex-col items-center justify-center rounded-[10px] border border-[#d3e3fa] bg-[#f3f8ff] text-sm font-semibold uppercase tracking-[0.18em] text-[#12213d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_14px_rgba(20,55,110,0.06)] transition hover:-translate-y-[1px] hover:border-[#8fb8ee] hover:bg-[#eaf2fb] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[64px] xl:min-h-[68px]";
const clearClass =
  "inline-flex min-h-[60px] flex-col items-center justify-center rounded-[10px] border border-[#c7dcf7] bg-[#eaf2fb] text-sm font-semibold uppercase tracking-[0.18em] text-[#12213d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_14px_rgba(20,55,110,0.06)] transition hover:-translate-y-[1px] hover:border-[#8fb8ee] hover:bg-[#dcebfa] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[64px] xl:min-h-[68px]";
const confirmClass =
  "row-span-2 inline-flex min-h-[124px] flex-col items-center justify-center rounded-[10px] border border-[#2f6fcc] bg-[linear-gradient(180deg,#4f9dff_0%,#1554a3_100%)] px-2 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_14px_26px_rgba(20,55,110,0.24)] transition hover:-translate-y-[1px] hover:border-[#7cc4ff] hover:brightness-105 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[132px] xl:min-h-[144px]";
const infoTileClass =
  "flex min-h-[60px] flex-col items-center justify-center rounded-[10px] border border-[#d3e3fa] bg-[#f7faff] px-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:min-h-[64px] xl:min-h-[68px]";

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current">
      <path
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 6H9l-5 6 5 6h11a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z"
      />
      <path strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="m10 10 4 4m0-4-4 4" />
    </svg>
  );
}

function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current">
      <path strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="M15 8l4 4-4 4" />
      <path
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12H9a4 4 0 0 1-4-4V5"
      />
    </svg>
  );
}

export default function PosKeypad({
  disabled,
  confirmLabel,
  staffTag,
  staffLabel,
  onDigit,
  onBackspace,
  onClear,
  onConfirm,
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={digitClass}
          disabled={disabled}
          onClick={() => onDigit(key)}
        >
          {key}
        </button>
      ))}

      <button
        type="button"
        className={backClass}
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Backspace"
        title="Backspace"
      >
        <BackspaceIcon />
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">Back</span>
      </button>

      <button
        type="button"
        className={clearClass}
        disabled={disabled}
        onClick={onClear}
        aria-label="Clear PIN"
        title="Clear PIN"
      >
        <span className="text-base font-bold">C</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">Clear</span>
      </button>

      <button type="button" className={confirmClass} disabled={disabled} onClick={onConfirm}>
        <EnterIcon />
        <span className="mt-3 max-w-[70px] text-[11px] font-bold uppercase tracking-[0.24em]">
          {confirmLabel}
        </span>
      </button>

      <div className={infoTileClass}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5c7093]">
          Staff
        </span>
        <span className="mt-1 text-lg font-bold text-[#12213d]">{staffTag || "--"}</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#5c7093]">
          {staffLabel || "Select"}
        </span>
      </div>

      <button
        type="button"
        className={`${digitClass} col-span-2`}
        disabled={disabled}
        onClick={() => onDigit("0")}
      >
        0
      </button>
    </div>
  );
}
