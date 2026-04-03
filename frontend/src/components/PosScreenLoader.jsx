export default function PosScreenLoader({ label = "Loading POS..." }) {
  return (
    <div className="pos-panel-soft flex min-h-[240px] flex-col items-center justify-center gap-4 text-center animate-fade-up">
      <span className="inline-flex h-11 w-11 animate-spin rounded-full border-4 border-pos-accent/20 border-t-pos-accent" />
      <p className="m-0 text-sm font-medium text-pos-muted">{label}</p>
    </div>
  );
}
