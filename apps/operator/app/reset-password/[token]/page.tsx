import { resolveToken } from "@revio/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetPasswordForm } from "@/components/auth/AccountForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password · Revio Operator" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Checked before the form renders, so a dead link is said plainly rather than after someone has
  // chosen and typed a password twice.
  const resolved = await resolveToken(token, "reset");

  if (!resolved.ok) {
    return (
      <AuthShell title="Link no longer valid" intro={resolved.message}>
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" intro="Pick something you don't use anywhere else.">
      <SetPasswordForm token={token} purpose="reset" email={resolved.token.email} />
    </AuthShell>
  );
}
