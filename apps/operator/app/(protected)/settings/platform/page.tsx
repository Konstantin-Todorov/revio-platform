import { Card } from "@/components/ui/primitives";

/** How the platform is put together — stated, so nobody has to infer it from the code. */
export default function PlatformSettingsPage() {
  return (
    <>
    {/* Platform */}
    <Card className="p-4">
      <h3 className="mb-3 text-[13px] font-bold text-ink-900">Platform</h3>
      <div className="grid grid-cols-1 gap-2 text-[12.5px] text-ink-600 sm:grid-cols-2">
        <div>Products: <span className="font-semibold text-ink-900">RevioLink · RevioCRS · RevioPMS</span> (sold via entitlements)</div>
        <div>Perimeters: <span className="font-semibold text-ink-900">Operator</span> (this console) vs <span className="font-semibold text-ink-900">Hotel</span></div>
        <div>Isolation: <span className="font-semibold text-ink-900">Postgres Row-Level Security</span> per tenant</div>
        <div>Connectivity: <span className="font-semibold text-ink-900">Channex</span> (keys on the Connectivity screen)</div>
      </div>
    </Card>
    </>
  );
}
