import { resolveToken } from "@revio/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetPasswordForm } from "@/components/auth/AccountForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set your password · RevioCRS" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Checked before the form renders, so a dead link is said plainly rather than after someone has
  // chosen and typed a password twice.
  const resolved = await resolveToken(token, "invite");

  if (!resolved.ok) {
    return (
      <AuthShell title="Invitation no longer valid" intro={resolved.message}>
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome — set your password" intro="One login covers every Revio product your hotel uses.">
      <SetPasswordForm token={token} purpose="invite" />
    </AuthShell>
  );
}
