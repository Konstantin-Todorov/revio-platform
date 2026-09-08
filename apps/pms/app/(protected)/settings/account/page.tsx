import { userRequiresSecondFactor } from "@revio/db";
import { SignOutEverywhere } from "@revio/ui/sign-out-everywhere";
import { TwoFactorSetup } from "@revio/ui/two-factor-setup";
import { Card, CardHeader } from "@/components/ui/primitives";
import { getSession } from "@/lib/session";
import { signOutEverywhere } from "@/lib/actions-auth";
import { startTwoFactor, confirmTwoFactor, turnOffTwoFactor } from "@/lib/actions-2fa";

export const dynamic = "force-dynamic";

/**
 * Your own account — not the hotel's.
 *
 * One Revio identity covers every product, so this section appears in all three and protects the
 * same person wherever they turned it on. Revocation is recorded on that shared identity, which is
 * exactly why the control cannot live in one product only — until 2026-08-12 it did.
 */
export default async function AccountSettingsPage() {
  const session = await getSession();
  const twoFactorOn = session ? await userRequiresSecondFactor(session.userId) : false;

  // Named rather than "everything": a warning nobody can check is a warning nobody reads.
  const productNames = [
    ...(session?.entitlements.channelManager ? ["RevioLink"] : []),
    ...(session?.entitlements.reservation ? ["RevioCRS"] : []),
    ...(session?.entitlements.pms ? ["RevioPMS"] : []),
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="Two-factor authentication"
          subtitle="Protects this account in every Revio product you use"
        />
        <div className="p-5">
          <TwoFactorSetup
            enabled={twoFactorOn}
            productName="RevioPMS"
            actions={{ start: startTwoFactor, confirm: confirmTwoFactor, turnOff: turnOffTwoFactor }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Your sign-in" subtitle="Sessions on this and any other device" />
        <div className="p-5">
          <SignOutEverywhere action={signOutEverywhere} productNames={productNames} />
        </div>
      </Card>
    </>
  );
}
