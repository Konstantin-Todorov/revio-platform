export function Logo({ className = "" }: { className?: string }) {
  // A room key — the PMS: front desk & operations, the layer that runs the property day-to-day.
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#7c5cdb" />
      <circle cx="13" cy="13" r="4.4" stroke="#ffffff" strokeWidth="2.4" />
      <path d="M16.3 16.3l6.2 6.2" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 20l1.8 1.8M22 22l1.4-1.4" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
