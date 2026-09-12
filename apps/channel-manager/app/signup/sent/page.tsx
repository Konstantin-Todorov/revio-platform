import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/shell/Logo";

export const metadata = { title: "Check your email · Revio" };

/**
 * ⚠️ This page says the same thing whether an account was created or the address already had one.
 *
 * That is not vagueness, it is the whole protection: a page that distinguishes the two is a tool
 * for discovering which hoteliers are Revio customers, one address at a time. Both people get a
 * useful email — a confirmation link, or a sign-in reminder — so nobody is left stuck; the answer
 * arrives in the inbox that owns the address rather than on the screen of whoever typed it.
 */
export default function SignupSentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto h-9 w-9" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink-900">Check your email</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-600">
          We've sent you a link. Open it to confirm your address and choose a password — that's the last step, and
          your trial of all three products starts the moment you do.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-[12.5px] leading-relaxed text-ink-400">
          Nothing yet? Check the spam folder. The link works once and expires in 48 hours.
        </p>
        <p className="mt-6 text-[12.5px] text-ink-500">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
