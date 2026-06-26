export function Logo({ className = "" }: { className?: string }) {
  // A control/oversight mark — concentric ring around a core (the operator above every hotel).
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#15366a" />
      <circle cx="16" cy="16" r="8.5" stroke="#e0a23b" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="3.2" fill="#e0a23b" />
    </svg>
  );
}
