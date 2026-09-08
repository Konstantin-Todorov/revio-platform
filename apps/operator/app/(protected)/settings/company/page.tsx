import { StatusPill } from "@/components/ui/primitives";
import { Card } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/billing/CompanyForm";
import { getCompany } from "@/lib/invoice-doc";
import { getOperatorSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Our own legal identity. Without it there is no issuer, and issuing is blocked. */
export default async function CompanySettingsPage() {
  const session = await getOperatorSession();
  const isAdmin = session?.role === "super_admin";
  const company = await getCompany();

  return (
    <>
    {/* Our own legal identity. Without it there is no issuer, and issuing is blocked. */}
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-bold text-ink-900">Company details</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            Who we are on every invoice we send a hotel. Snapshotted onto each invoice at the moment it
            is issued, so changing these never rewrites a document already sent.
          </p>
        </div>
        {!company && <StatusPill tone="warning">Not set</StatusPill>}
      </div>
      {!company && (
        <p className="mb-3 rounded-md bg-warning-50 px-3 py-2 text-[12px] font-medium text-warning-600">
          No invoice can be issued until this is filled in.
        </p>
      )}
      <CompanyForm
        canEdit={isAdmin}
        values={{
          legalName: company?.legalName ?? "",
          legalNameLatin: company?.legalNameLatin ?? "",
          vatId: company?.vatId ?? "",
          companyId: company?.companyId ?? "",
          addressLine: company?.addressLine ?? "",
          addressLineLatin: company?.addressLineLatin ?? "",
          city: company?.city ?? "",
          cityLatin: company?.cityLatin ?? "",
          postCode: company?.postCode ?? "",
          country: company?.country ?? "BG",
          email: company?.email ?? "",
          phone: company?.phone ?? "",
          website: company?.website ?? "",
          iban: company?.iban ?? "",
          bic: company?.bic ?? "",
          bankName: company?.bankName ?? "",
          standardVatPct: company?.standardVatPct ?? 20,
          invoiceNumberStart: String(company?.invoiceNumberStart ?? 1000000000n),
          paymentTermsDays: company?.paymentTermsDays ?? 14,
          footerNote: company?.footerNote ?? "",
        }}
      />
    </Card>
    </>
  );
}
