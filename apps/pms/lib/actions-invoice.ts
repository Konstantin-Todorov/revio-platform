"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { generateInvoice, type DocType } from "./invoice";
import { str } from "./mutation-helpers";

const DOC_TYPES = ["invoice", "proforma", "credit_note"];

/** Issue a tax document from a folio (spec §4.3). Company invoices need a buyer VAT ID. */
export async function issueInvoice(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("No session");
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
  redirect(`/invoice/${id}`);
}
