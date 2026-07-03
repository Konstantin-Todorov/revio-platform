/** The spec's eight permission groups — roles are saved group×level combinations. */
export const PERMISSION_GROUPS = [
  "reservations", "rates", "inventory", "restrictions", "users", "reports", "distribution", "finance",
] as const;
