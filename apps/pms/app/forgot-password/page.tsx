import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/AccountForms";
import { i18n } from "@/lib/i18n/server";
import { auth } from "@/lib/i18n/auth";

export async function generateMetadata() {
  return { title: (await i18n()).t(auth).forgot.meta };
}

export default async function ForgotPasswordPage() {
  const a = (await i18n()).t(auth);
  return (
    <AuthShell
      title={a.forgot.title}
      intro={a.forgot.intro}
    >
      <ForgotPasswordForm t={a.forms} />
    </AuthShell>
  );
}
