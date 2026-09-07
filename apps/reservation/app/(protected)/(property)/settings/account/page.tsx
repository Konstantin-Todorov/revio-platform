import { getSession } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/primitives";
import { TwoFactorSetup } from "@revio/ui/two-factor-setup";
import { SignOutEverywhere } from "@revio/ui/sign-out-everywhere";
import { signOutEverywhere } from "@/lib/actions-auth";
import { startTwoFactor, confirmTwoFactor, turnOffTwoFactor } from "@/lib/actions-2fa";
import { userRequiresSecondFactor } from "@revio/db";

export const dynamic = "force-dynamic";


export default async function SettingsAccountPage() {
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
      {/* One account across RevioLink, RevioCRS and RevioPMS — so this card appears in all three and
          protects the same person wherever they turned it on. A hotel that only bought one product
          must still have somewhere to enable it. */}
      <Card>
        <CardHeader
          title="Two-factor authentication"
          subtitle="Protects this account in every Revio product you use"
        />
        <div className="p-5">
          <TwoFactorSetup
            enabled={twoFactorOn}
            productName="RevioCRS"
            actions={{ start: startTwoFactor, confirm: confirmTwoFactor, turnOff: turnOffTwoFactor }}
          />
        </div>
      </Card>

      {/* Recorded on the SHARED identity, so it reaches every product this hotel runs — which is
          exactly why the button cannot live in one product only. Until now it did. */}
      <Card>
        <CardHeader title="Your sign-in" subtitle="Sessions on this and any other device" />
        <div className="p-5">
          <SignOutEverywhere action={signOutEverywhere} productNames={productNames} />
        </div>
      </Card>
    </>
  );
}
