const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const actionClass =
  "inline-flex min-h-[74px] items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-pos-text transition hover:bg-white/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";
const digitClass =
  "inline-flex min-h-[74px] items-center justify-center rounded-xl border border-white/15 bg-pos-card text-2xl font-semibold text-white transition hover:border-pos-accent/70 hover:bg-[#223458] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

export default function PosKeypad({
  disabled,
  confirmLabel,
  onDigit,
  onBackspace,
  onClear,
  onConfirm,
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
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

        <button type="button" className={actionClass} disabled={disabled} onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className={digitClass}
          disabled={disabled}
          onClick={() => onDigit("0")}
        >
          0
        </button>
        <button
          type="button"
          className={actionClass}
          disabled={disabled}
          onClick={onBackspace}
        >
          Back
        </button>
      </div>

      <button
        type="button"
        className="pos-button pos-button-primary min-h-[68px] rounded-xl text-base font-bold tracking-wide"
        disabled={disabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
