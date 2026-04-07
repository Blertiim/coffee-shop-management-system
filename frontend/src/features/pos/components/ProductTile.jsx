const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function ProductTile({ product, onAdd, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={disabled}
      className={`touch-tile group relative flex min-h-[156px] flex-col justify-between overflow-hidden rounded-[22px] border p-4 text-left transition duration-150 ${
        disabled
          ? "cursor-not-allowed border-[#314a5b] bg-[rgba(14,23,31,0.65)] opacity-60"
          : "border-[#365261] bg-[linear-gradient(180deg,rgba(21,39,50,0.98)_0%,rgba(16,29,38,0.99)_100%)] shadow-[0_14px_28px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:border-[#53a59c] hover:shadow-[0_18px_34px_rgba(0,0,0,0.24)] active:scale-[0.99]"
      }`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(240,214,162,0.45)_50%,transparent_100%)]" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#86a9aa]">
            {product.category?.name || "Menu Item"}
          </p>
          <h3 className="m-0 mt-2 line-clamp-2 text-[18px] font-semibold leading-tight text-[#f7f3ea] transition group-hover:text-white">
            {product.name}
          </h3>
        </div>

        <span className="shrink-0 rounded-full border border-[#405967] bg-[rgba(13,22,30,0.72)] px-2.5 py-1 text-[11px] font-semibold text-[#d5dde7]">
          {product.stock} left
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-[#8ea3b3]">
          Tap to add
        </span>
        <span className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#f0d6a2]">
          {formatPrice(product.price)} EUR
        </span>
      </div>
    </button>
  );
}
