import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: process.env.PROD_DB! } } });
const cols = await p.$queryRawUnsafe<{ column_name: string }[]>(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ChannelRatePlanMapping' ORDER BY column_name`);
console.log("ChannelRatePlanMapping columns:", cols.map((c) => c.column_name).join(", "));
const m = await p.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null }[]>(
  `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 3`);
for (const r of m) console.log(`  ${r.finished_at ? "✓" : "…"} ${r.migration_name}`);
await p.$disconnect();
