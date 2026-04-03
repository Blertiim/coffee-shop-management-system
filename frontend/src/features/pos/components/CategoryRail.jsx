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
        {categories.map((category) => {
          const isActive = selectedCategoryKey === category.key;

          return (
            <button
              key={category.key}
              type="button"
              onClick={() => onSelectCategory(category.key)}
              className={`touch-tile min-h-[70px] rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                isActive
                  ? "border-pos-accent bg-pos-accent text-slate-950"
                  : "border-white/10 bg-white/5 text-pos-text hover:border-white/25 hover:bg-white/10"
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
