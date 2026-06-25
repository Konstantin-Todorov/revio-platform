export function Logo({ className = "" }: { className?: string }) {
  // Two linked nodes — "Link": the hub that connects a property to every channel.
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#e0a23b" />
      <circle cx="11" cy="16" r="4.2" stroke="#15366a" strokeWidth="2.4" />
      <circle cx="21" cy="16" r="4.2" stroke="#15366a" strokeWidth="2.4" />
      <path d="M14.5 16h3" stroke="#15366a" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
