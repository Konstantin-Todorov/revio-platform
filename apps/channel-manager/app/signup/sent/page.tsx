import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { TOKEN_POLICY } from "@revio/core";

export const metadata = { title: "Check your email · Revio" };

/**
 * Two ways to get here, and they must not read the same.
 *
 * A first link and a replacement link are different facts to the person waiting. Told "check your
 * email" twice, somebody whose first attempt went to spam has no idea whether anything was sent
 * this time, or whether they have now created two accounts. (They have not — the second link opens
 * the same account; see `createPublicSignup`.)
 *
 * What this page does NOT do is tell anyone whether the address was already known. That answer
 * lives on `/signup/existing`, and only a finished account reaches it.
 *
 * ⚠️ The link's lifetime is read from `TOKEN_POLICY`, never typed. It said "48 hours" here for a
 * few hours — a number that appears nowhere in the code; the real policy is 7 days — and a hotel
 * told the wrong one either abandons a link that still works or hurries over one that does not.
 */
export default async function SignupSentPage({
  searchParams,
}: {
  searchParams: Promise<{ again?: string }>;
}) {
  const { again } = await searchParams;
  const resent = again === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto h-9 w-9" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink-900">
          {resent ? "We've sent that link again" : "Check your email"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-600">
          {resent ? (
            <>
              You had already started, so we've sent a fresh link to the same address rather than
              beginning again — your hotel is still there waiting. Open it to choose a password and
              your trial of all three products starts.
            </>
          ) : (
            <>
              We've sent you a link. Open it to confirm your address and choose a password — that's
              the last step, and your trial of all three products starts the moment you do.
            </>
          )}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-[12.5px] leading-relaxed text-ink-400">
          {resent
            ? `The earlier link no longer works. This one lasts ${TOKEN_POLICY.invite.ttlLabel} and can be used once.`
            : `Nothing yet? Check the spam folder. The link works once and expires in ${TOKEN_POLICY.invite.ttlLabel}.`}
        </p>
        <p className="mt-6 text-[12.5px] text-ink-500">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
