import { notFound } from "next/navigation";
import { getStayPolicies } from "@/lib/data";
import { deleteStayPolicy } from "@/lib/actions-terms";
import { StayTermsForm } from "@/components/rates/StayTermsForm";
import { BackLink } from "@/components/rates/BackLink";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { i18n } from "@/lib/i18n/server";
import { terms as termsDict } from "@/lib/i18n/terms";

export const dynamic = "force-dynamic";

/** One set of terms (or `new`). The plans using it are named, because editing it changes all of them. */
export default async function TermsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { property, policies, todayIso } = await getStayPolicies();
  const s = (await i18n()).t(termsDict);
  const policy = id === "new" ? undefined : policies.find((p) => p.id === id);
  if (id !== "new" && !policy) notFound();

  return (
    <>
      <BackLink href="/rooms-rates/terms">{s.back}</BackLink>
      <StayTermsForm key={policy?.id ?? "new"} policy={policy} currency={property.baseCurrency} today={todayIso} />
      {policy && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
          <p className="text-[12px] text-ink-500">
            {policy.ratePlans.length > 0 ? `${s.usedBy(policy.ratePlans.length)}: ${policy.ratePlans.map((r) => r.name).join(", ")}. ` : ""}
            {s.deleteText}
          </p>
          <DeleteButton action={deleteStayPolicy} id={policy.id} label={policy.name} note={s.deleteNote} />
        </div>
      )}
    </>
  );
}
