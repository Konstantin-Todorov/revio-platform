/**
 * One page for every "you can't book here" case — wrong slug, engine switched off, suspended
 * account. Deliberately indistinguishable: telling a visitor which hotels are Revio customers, or
 * which have stopped paying, is not ours to disclose.
 */
export default function NotFound() {
  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-[34rem] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Booking</p>
      <h1 className="display mt-3 text-[2.2rem]">This booking page isn’t available</h1>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
        The link may be mistyped or no longer active. If you were sent here by a hotel, please check
        the address with them directly.
      </p>
    </main>
  );
}
