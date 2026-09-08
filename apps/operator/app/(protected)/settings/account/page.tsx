import { redirect } from "next/navigation";
import { requiresSecondFactor } from "@revio/db";
import { TwoFactorSetup } from "@revio/ui/two-factor-setup";
import { SignOutEverywhere } from "@revio/ui/sign-out-everywhere";
import { Card, StatusPill } from "@/components/ui/primitives";
import { getOperatorSession } from "@/lib/session";
import { signOutEverywhere } from "@/lib/actions-auth";
import { startTwoFactor, confirmTwoFactor, turnOffTwoFactor } from "@/lib/actions-2fa";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", support: "Support" };

/** Your own account on the console that can read every hotel on the platform. */
export default async function AccountSettingsPage() {
  const session = await getOperatorSession();
  if (!session) redirect("/logout");
  const isAdmin = session.role === "super_admin";
  const twoFactorOn = await requiresSecondFactor(session.userId);

  return (
    <>
      <Card className="p-4">
        <h3 className="mb-3 text-[13px] font-bold text-ink-900">Your account</h3>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-800 text-[15px] font-bold text-white">
            {session.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ink-900">{session.name}</div>
            <div className="mt-0.5">
              <StatusPill tone={isAdmin ? "success" : "neutral"}>{ROLE_LABEL[session.role]}</StatusPill>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-ink-400">
          New operator accounts are invited by email and choose their own password. Nobody here can set
          or read it.
        </p>
      </Card>

      {/* N4 — the second factor, on the account that can read every hotel on the platform. */}
      <Card className="p-4">
        <h3 className="mb-3 text-[13px] font-bold text-ink-900">Two-factor authentication</h3>
        <TwoFactorSetup
          enabled={twoFactorOn}
          productName="Revio Operator"
          reason="This console can read every hotel on the platform, so a password on its own is a single point of failure. Two-factor adds a code from your phone."
          actions={{ start: startTwoFactor, confirm: confirmTwoFactor, turnOff: turnOffTwoFactor }}
        />
      </Card>

      {/* The console reads every hotel on the platform, so a session left alive on a lost laptop is
          the worst one on the estate — and it was the one account with no way to end it. */}
      <Card className="p-4">
        <h3 className="mb-3 text-[13px] font-bold text-ink-900">Your sign-in</h3>
        <SignOutEverywhere action={signOutEverywhere} productNames={["the Revio operator console"]} />
      </Card>
    </>
  );
}
