import { resolveToken } from "@revio/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetPasswordForm } from "@/components/auth/AccountForms";
import { i18n } from "@/lib/i18n/server";
import { sayAuthRefusal } from "@/lib/auth-refusal";
import { auth } from "@/lib/i18n/auth";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await i18n()).t(auth).invite.meta };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t: tr, locale } = await i18n();
  const t = tr(auth).invite;
  // Checked before the form renders, so a dead link is said plainly rather than after someone has
  // chosen and typed a password twice.
  const resolved = await resolveToken(token, "invite");

  if (!resolved.ok) {
    return (
      <AuthShell title={t.deadTitle} intro={sayAuthRefusal(resolved, locale)}>
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t.title} intro={t.intro}>
      <SetPasswordForm token={token} purpose="invite" email={resolved.token.email} />
    </AuthShell>
  );
}
