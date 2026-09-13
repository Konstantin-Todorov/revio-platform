import { LoginForm } from "@/components/auth/LoginForm";
import "../v2.css";

export const metadata = { title: "Sign in · Revio Operator" };

/**
 * The candidate login.
 *
 * ⚠️ **The authentication is untouched.** This renders the same `LoginForm` the live `/login`
 * renders — same server action, same rate-limit gate, same 2FA hand-off. Only the page around it is
 * new, which is the whole point: a redesign that quietly rewrote a login form would be the most
 * expensive kind of "just styling".
 *
 * Two deliberate departures from the usual login page:
 *
 * 1. **The card is not vertically centred.** Dead centre is the safe choice every template makes,
 *    and it is why they all look alike. Above the midline gives the page a direction to read in.
 * 2. **The left half says what is behind the door** — the four surfaces of the platform, each on its
 *    own colour — instead of a stock photograph or an illustration of nothing. It is the one thing
 *    on this screen that could not belong to another product.
 *
 * Lives at its own route, importing one scoped stylesheet. `/login` is untouched and still the real
 * front door until somebody decides otherwise.
 */
export default async function V2LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordSet?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const justSet = sp.passwordSet === "1";
  const defaultEmail = sp.email;

  const surfaces = [
    { c: "#6f95ff", n: "Operator", d: "every hotel" },
    { c: "#3fc4e0", n: "RevioLink", d: "channels" },
    { c: "#8f92f5", n: "RevioCRS", d: "reservations" },
    { c: "#3ecb97", n: "RevioPMS", d: "front desk" },
  ];

  return (
    <div className="v2 door" data-theme="dark">
      <div className="door-l">
        <div className="door-brand">
          <span className="m">R</span>
          <span><b>Revio</b><s>Operator</s></span>
        </div>

        <div>
          <h1 className="door-say">Above every hotel.</h1>
          <p className="door-sub">
            One console over the whole platform — who is on it, what they bought, what it is earning
            and what is failing right now.
          </p>

          <div className="rails">
            {surfaces.map((s) => (
              <div className="railrow" key={s.n}>
                <i style={{ background: s.c }} />
                <b>{s.n}</b>
                <s>{s.d}</s>
              </div>
            ))}
          </div>
        </div>

        <p className="door-foot">Restricted to Revio staff · operator console</p>
      </div>

      <div className="door-r">
        <div className="door-card">
          <div className="door-mob">
            <span className="m" style={{ width: 30, height: 30, borderRadius: 9, background: "#1c4ed8", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>R</span>
            <b style={{ fontSize: 15, fontWeight: 600 }}>Revio Operator</b>
          </div>
          <h2>Operator sign in</h2>
          <p className="lede">Restricted to Revio staff.</p>
          <LoginForm justSet={justSet} {...(defaultEmail ? { defaultEmail } : {})} />
        </div>
      </div>
    </div>
  );
}
