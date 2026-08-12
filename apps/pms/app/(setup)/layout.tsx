/**
 * The setup perimeter: signed in, but deliberately outside the app shell.
 *
 * `/welcome` needs a session — the middleware still requires the cookie, because setup is not a
 * public surface — but it must NOT inherit the sidebar and topbar from `(protected)`. A hotel that
 * has just set a password and has never seen this software will click a nav item and never return
 * to the flow. Removing the chrome is most of what makes a first-run flow work.
 */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
