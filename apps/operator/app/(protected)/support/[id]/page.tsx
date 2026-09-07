import Link from "next/link";
import { notFound } from "next/navigation";
import { forSystem } from "@revio/db";
import { supportReference } from "@revio/core";
import { Card, PageHeader } from "@/components/ui/primitives";
import { SupportCase, type SupportCaseRow } from "@/components/support/SupportCase";

export const dynamic = "force-dynamic";

const prisma = forSystem();

/**
 * One case, on its own page.
 *
 * The queue had no such thing: every case lived inline on a single screen, so nothing could be
 * linked to, sent to a colleague, or opened from the client it belongs to. A support case is exactly
 * the kind of thing somebody wants to point at — "see RV-… before you call them" — and it had no
 * address.
 *
 * It renders the same `SupportCase` the queue does, so there is no second version of a case to keep
 * in agreement. The only difference is that the reference stops being a link to itself.
 */
export default async function SupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const request = await prisma.supportRequest.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!request) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { id: request.tenantId },
    select: { id: true, name: true, isDemo: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={supportReference(request.id)}
          subtitle={tenant ? `${tenant.name} · ${request.contactName}` : request.contactName}
        />
        <div className="flex items-center gap-3 text-[12.5px] font-semibold">
          {tenant && (
            <Link href={`/clients/${tenant.id}`} className="text-brand-700 hover:underline">
              Open the client
            </Link>
          )}
          <Link href="/support" className="text-ink-500 hover:text-ink-900">
            ← All support
          </Link>
        </div>
      </div>

      <Card>
        <div className="px-4 py-3.5">
          <SupportCase
            request={request as unknown as SupportCaseRow}
            tenant={tenant ?? undefined}
            now={new Date()}
            linkToCase={false}
          />
        </div>
      </Card>
    </div>
  );
}
