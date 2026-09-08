import { userRequiresSecondFactor } from "@revio/db";
import { SignOutEverywhere } from "@revio/ui/sign-out-everywhere";
import { TwoFactorSetup } from "@revio/ui/two-factor-setup";
import { getSession } from "@/lib/session";
import { signOutEverywhere } from "@/lib/actions-auth";
import { startTwoFactor, confirmTwoFactor, turnOffTwoFactor } from "@/lib/actions-2fa";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Your own account — not the hotel's.
 *
 * One Revio identity covers RevioLink, RevioCRS and RevioPMS, so this section appears in all three
 * and protects the same person wherever they turned it on. A hotel that bought only one product
 * must still have somewhere to enable it, which is why it is never gated on an entitlement.
 */
export default async function AccountSettingsPage() {
  const session = await getSession();
  const twoFactorOn = session ? await userRequiresSecondFactor(session.userId) : false;

  // Revocation is recorded on the shared identity, so it reaches every product this hotel runs. The
  // control names them rather than saying "everything", which nobody can check.
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
            productName="RevioLink"
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
