export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`} aria-label="TodoAI">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="19" cy="21" r="13.5" fill="none" stroke="currentColor" strokeWidth="3.4" />
        <path d="m12.5 21.2 4.4 4.3 9.2-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
        <path d="M30.5 5.5v6M27.5 8.5h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
      {compact ? null : <span>TodoAI</span>}
    </div>
  );
}
