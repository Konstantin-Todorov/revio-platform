import "server-only";

/**
 * Operator perimeter — sees ALL tenants. This is the SaaS operator (us), not a hotel.
 * Dev resolver: a fixed operator identity. Real auth (staff SSO) replaces only this function.
 * There is intentionally no tenantId here: the operator is cross-tenant by design.
 */
export interface OperatorSession {
  perimeter: "operator";
  userId: string;
  name: string;
  role: "super_admin" | "support";
}

export async function getOperatorSession(): Promise<OperatorSession> {
  return { perimeter: "operator", userId: "op-dev", name: "Revio Operator", role: "super_admin" };
}
