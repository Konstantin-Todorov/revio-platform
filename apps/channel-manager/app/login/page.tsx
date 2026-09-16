import { Logo } from "@/components/shell/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · RevioLink" };

/**
 * The first screen anybody sees, and for a hotel deciding whether to trust us with its bookings,
 * the whole first impression.
 *
 * ## What was wrong with the old one
 *
 * A flat blue gradient with the headline pinned to the bottom, so two thirds of the panel was empty
 * — not restful, just unfinished. On the right, the form floated on a grey ground with nothing
 * holding it: no card, no edge, no weight. Nothing was broken and nothing looked decided.
 *
 * ## What changed, and why each thing
 *
 * **The panel has depth instead of a gradient.** A dot grid at 7% white and one soft accent glow.
 * Both are pure CSS — no image to load, nothing to hurt the first paint on a hotel's office
 * connection, and no photograph that dates the moment the product changes.
 *
 * **The content sits at optical centre**, so the panel reads as composed rather than bottom-heavy.
 *
 * **The form is anchored** on white with a hairline card, tighter radius and a shadow that sits
 * close to the surface. "Sharp and crisp" is mostly this: smaller radii, lower-opacity shadows,
 * hairline borders — not more colour.
 *
 * ⚠️ `LoginForm` is untouched. Every rate-limit, two-factor hand-off and refusal message behind this
 * screen is the same code it was — this is a change of clothes, deliberately, so that if the look is
 * wrong it costs one commit and nothing else.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordSet?: string; email?: string }>;
}) {
  // Read here rather than with useSearchParams in the form: this page is a server component,
  // and the hook forces a Suspense boundary at prerender for a single boolean.
  const sp = await searchParams;
  const justSet = sp.passwordSet === "1";
  const defaultEmail = sp.email;

  return (
    <div className="flex min-h-screen items-stretch bg-white">
      {/* ── Brand panel ─────────────────────────────────────────────────────────────── */}
      <div className="relative hidden w-1/2 flex-col overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        {/* Depth, in two layers and no images. The dot grid gives the surface a texture at reading
            distance and disappears at a glance; the glow keeps the panel from being one flat field. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255_/_0.07)_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 h-[30rem] w-[30rem] rounded-full bg-product-mark/20 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 h-[26rem] w-[26rem] rounded-full bg-brand-600/30 blur-[120px]"
        />

        <div className="relative flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">
              Revio<span className="text-product-mark">Link</span>
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Channel Manager
            </div>
          </div>
        </div>

        {/* Optical centre, not the bottom edge — `justify-center` on a flex column with the mark and
            the footnote pinned by `mt-auto` below. */}
        <div className="relative my-auto max-w-md">
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em]">
            One hub. Every channel.<br />Always in sync.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-white/60">
            Push availability, rates and restrictions to every OTA — and pull every booking back —
            from a single calendar.
          </p>

          {/* Three facts rather than a testimonial we do not have. Hairlines, not boxes: the panel
              stays quiet and the eye still gets somewhere to land below the headline. */}
          <dl className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-white/10">
            {[
              ["One", "source of truth for availability"],
              ["Every", "booking pulled back automatically"],
              ["Zero", "migration to add another product"],
            ].map(([k, v]) => (
              <div key={k} className="bg-brand-900/60 px-3.5 py-3 backdrop-blur-sm">
                <dt className="text-[15px] font-semibold text-product-mark">{k}</dt>
                <dd className="mt-1 text-[11.5px] leading-snug text-white/50">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative text-[12px] text-white/35">© Revio · hotel distribution</div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────────────────── */}
      <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2">
        <div className="w-full max-w-[22rem]">
          <div className="mb-7 lg:hidden">
            <Logo className="h-9 w-9" />
          </div>

          <h2 className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink-900">
            Sign in to RevioLink
          </h2>
          <p className="mb-7 mt-1.5 text-[13.5px] text-ink-500">Welcome back — manage your distribution.</p>

          <LoginForm justSet={justSet} {...(defaultEmail ? { defaultEmail } : {})} />

          {/* Opt-in, and off unless SHOW_DEMO_LOGINS=1 is set — a paying hotel must never be shown
              someone else's credentials on the sign-in page. Server-side env (never NEXT_PUBLIC), so
              the credentials are not in the client bundle either. */}
          {process.env.SHOW_DEMO_LOGINS === "1" && (
            <div className="mt-7 rounded-lg border border-surface-border bg-surface-muted px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-700">Demo logins</span> (password{" "}
              <code className="rounded bg-white px-1 py-0.5">revio1234</code>)<br />
              Hotel Sofia → <code className="rounded bg-white px-1 py-0.5">admin@hotelsofia.demo</code>
              <br />
              Black Sea Resort → <code className="rounded bg-white px-1 py-0.5">owner@blacksea.demo</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
