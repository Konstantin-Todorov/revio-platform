import "server-only";
import { forSystem } from "@revio/db";
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
  return { perimeter: "operator", userId: op.id, name: op.name, role: op.role as OperatorSession["role"] };
}
