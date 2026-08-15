"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "./authz";
import { generateInvoice, type DocType } from "./invoice";
import { str } from "./mutation-helpers";

const DOC_TYPES = ["invoice", "proforma", "credit_note"];

/** Issue a tax document from a folio (spec §4.3). Company invoices need a buyer VAT ID. */
export async function issueInvoice(fd: FormData): Promise<void> {
  // A tax document is a legal artefact with a gapless number — manager-only, and gated here
  // because a server action commits before the layout's route-guard ever runs.
  const session = await requireCapability("manage");
  if (!session) return;
  const reservationId = str(fd, "reservationId");
  const docType = (DOC_TYPES.includes(str(fd, "docType")) ? str(fd, "docType") : "invoice") as DocType;
  const buyerName = str(fd, "buyerName");
  if (!buyerName) redirect(`/folio/${reservationId}?error=buyer`);

  const id = await generateInvoice({
    reservationId,
    folioId: str(fd, "folioId") || undefined,
    docType,
    buyerName,
    buyerVatId: str(fd, "buyerVatId") || null,
    buyerAddress: str(fd, "buyerAddress") || null,
    userId: session.userId,
  });
  if (!id) redirect(`/folio/${reservationId}?error=invoice`);
  revalidatePath(`/folio/${reservationId}`);
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
  redirect(`/invoice/${id}`);
}
