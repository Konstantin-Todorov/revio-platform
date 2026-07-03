export function Logo({ className = "" }: { className?: string }) {
  // A booked calendar cell — the CRS: every reservation, one record.
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#e0a23b" />
      <rect x="7" y="8" width="18" height="17" rx="2.5" stroke="#15366a" strokeWidth="2.4" />
      <path d="M7 13.5h18" stroke="#15366a" strokeWidth="2.4" />
      <path d="M12 19.5l2.6 2.6 5-5" stroke="#15366a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
