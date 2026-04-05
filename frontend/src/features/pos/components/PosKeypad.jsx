const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const tileClass =
  "inline-flex min-h-[60px] items-center justify-center rounded-[10px] border border-[#4a5568] bg-[linear-gradient(180deg,rgba(58,64,76,0.98)_0%,rgba(30,34,42,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.22),0_10px_20px_rgba(0,0,0,0.24)] transition hover:-translate-y-[1px] hover:border-[#7b879b] hover:bg-[linear-gradient(180deg,rgba(68,75,88,0.98)_0%,rgba(37,42,51,0.99)_100%)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[64px] xl:min-h-[68px]";

const digitClass = `${tileClass} text-[1.7rem] font-semibold`;
const backClass =
  "inline-flex min-h-[60px] flex-col items-center justify-center rounded-[10px] border border-[#4e5f77] bg-[linear-gradient(180deg,rgba(64,77,96,0.98)_0%,rgba(29,36,48,0.99)_100%)] text-sm font-semibold uppercase tracking-[0.18em] text-[#edf4ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_20px_rgba(0,0,0,0.22)] transition hover:-translate-y-[1px] hover:border-[#7a8ba7] hover:brightness-105 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[64px] xl:min-h-[68px]";
const clearClass =
  "inline-flex min-h-[60px] flex-col items-center justify-center rounded-[10px] border border-[#8a633f] bg-[linear-gradient(180deg,rgba(161,112,63,0.96)_0%,rgba(96,61,30,0.98)_100%)] text-sm font-semibold uppercase tracking-[0.18em] text-[#fff2df] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.22)] transition hover:-translate-y-[1px] hover:border-[#c88d56] hover:brightness-105 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[64px] xl:min-h-[68px]";
const confirmClass =
  "row-span-2 inline-flex min-h-[124px] flex-col items-center justify-center rounded-[10px] border border-[#2f8f80] bg-[linear-gradient(180deg,#37b79f_0%,#1f7468_100%)] px-2 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_26px_rgba(0,0,0,0.24)] transition hover:-translate-y-[1px] hover:border-[#59d0bb] hover:brightness-105 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[132px] xl:min-h-[144px]";
const infoTileClass =
  "flex min-h-[60px] flex-col items-center justify-center rounded-[10px] border border-[#1f3357] bg-[linear-gradient(180deg,rgba(9,19,36,0.96)_0%,rgba(6,13,26,0.98)_100%)] px-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:min-h-[64px] xl:min-h-[68px]";

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current">
      <path strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="M20 6H9l-5 6 5 6h11a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z" />
      <path strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="m10 10 4 4m0-4-4 4" />
    </svg>
  );
}

function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current">
      <path strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="M15 8l4 4-4 4" />
      <path strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="M19 12H9a4 4 0 0 1-4-4V5" />
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
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">
          Clear
        </span>
      </button>

      <button
        type="button"
        className={confirmClass}
        disabled={disabled}
        onClick={onConfirm}
      >
        <EnterIcon />
        <span className="mt-3 max-w-[70px] text-[11px] font-bold uppercase tracking-[0.24em]">
          {confirmLabel}
        </span>
      </button>

      <div className={infoTileClass}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a6afbe]">
          Staff
        </span>
        <span className="mt-1 text-lg font-bold text-white">{staffTag || "--"}</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#959fb0]">
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
