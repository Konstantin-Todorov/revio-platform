import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { TOKEN_POLICY } from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { signup as signupDict } from "@/lib/i18n/signup";

export async function generateMetadata() {
  return { title: (await i18n()).t(signupDict).meta.sent };
}

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
  const s = (await i18n()).t(signupDict);
  const x = s.sent;
  const ttl = s.days(Math.round(TOKEN_POLICY.invite.ttlMs / 86_400_000));

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto h-9 w-9" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink-900">
          {resent ? x.againTitle : x.title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-600">
          {resent ? x.againBody : x.body}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-[12.5px] leading-relaxed text-ink-400">
          {resent ? x.againNote(ttl) : x.note(ttl)}
        </p>
        <p className="mt-6 text-[12.5px] text-ink-500">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">{x.back}</Link>
        </p>
      </div>
    </div>
  );
}
