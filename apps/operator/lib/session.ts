import "server-only";
import { forSystem } from "@revio/db";
import { checkSessionValidity } from "@revio/core";
import { readSessionToken, verifySessionToken } from "./auth";

// Operator perimeter sees all tenants → bypass RLS (app.bypass=on) for every query.
const prisma = forSystem();

/** Operator perimeter — sees ALL tenants. Resolves the logged-in operator staff user. */
export interface OperatorSession {
  perimeter: "operator";
  userId: string;
  name: string;
  role: "super_admin" | "support";
}

export async function getOperatorSession(): Promise<OperatorSession | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload || payload.kind !== "operator") return null;

  const op = await prisma.operatorUser.findUnique({ where: { id: payload.sub } });
  if (!op) return null;
  // Until 2026-08-12 this check did not exist and could not: OperatorUser had no `active` column, so
  // the console that reads every hotel's data had no way to revoke a leaver short of deleting a row
  // the ClientAccount relation will not let you delete.
  if (!checkSessionValidity({ issuedAt: payload.issuedAt, sessionsValidFrom: op.sessionsValidFrom, active: op.active }).ok) {
    return null;
  }
  return { perimeter: "operator", userId: op.id, name: op.name, role: op.role as OperatorSession["role"] };
}
