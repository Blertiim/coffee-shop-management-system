export default function CategoryRail({
  categories,
  selectedCategoryKey,
  onSelectCategory,
}) {
  return (
    <aside className="pos-panel-soft flex h-full flex-col p-3">
      <div className="mb-3">
        <span className="pos-badge">Categories</span>
      </div>

      <div className="scroll-y grid flex-1 auto-rows-[minmax(64px,auto)] gap-2 overflow-y-auto pr-1">
        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-4 text-xs text-pos-muted">
            No categories
          </div>
        ) : (
          categories.map((category) => {
            const isActive = selectedCategoryKey === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => onSelectCategory(category.key)}
                className={`touch-tile min-h-[82px] rounded-xl border px-3 py-3 text-left text-base font-semibold transition ${
                  isActive
                    ? "border-pos-accent bg-pos-accent text-slate-950"
                    : "border-white/10 bg-white/5 text-pos-text hover:border-white/25 hover:bg-white/10"
                }`}
              >
                {category.label}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
