import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/AccountForms";

export const metadata = { title: "Reset your password · RevioPMS" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      intro="Enter the email you sign in with and we'll send you a link."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
