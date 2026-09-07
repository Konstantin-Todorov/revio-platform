/**
 * Create the **first** operator account on a fresh install.
 *
 * The one row no screen can produce. `Settings → invite a colleague` needs an operator session to
 * reach it, and the only other writer is `db:seed`, which `TRUNCATE`s every tenant table first —
 * so on an empty database the console is a login page with nothing that can sign into it.
 *
 * Production never hit this because it was seeded once, in 2026. A restore into a clean database
 * would, and so does anyone standing the platform up a second time.
 *
 * Deliberately **not** a password. The account is created without one and invited exactly as a
 * hotel's owner is, through `issueToken` + the reset flow, so nobody at Revio ever knows another
 * person's password — the rule N2 exists to keep. The link is printed here rather than emailed,
 * because on a fresh install `RESEND_API_KEY` is usually not set yet.
 *
 *   DATABASE_URL=... pnpm --filter @revio/db bootstrap-operator \
 *     --email you@revio.app --name "Your Name"
 *
 * Idempotent: refuses rather than overwrites if that email already exists, and refuses outright once
 * any operator account exists — after the first one, invitations are the only correct path.
 */

import { PrismaClient } from "@prisma/client";
import { issueToken } from "../src/auth-tokens.js";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const email = arg("email")?.trim().toLowerCase();
const name = arg("name")?.trim();
const origin = arg("origin")?.trim().replace(/\/+$/, "") ?? "https://operator.reviosoft.app";

if (!email || !name) {
  console.error('usage: bootstrap-operator --email you@revio.app --name "Your Name" [--origin https://…]');
  process.exit(1);
}

const existing = await prisma.operatorUser.count();
if (existing > 0) {
  console.error(
    `refused: ${existing} operator account(s) already exist.\n` +
      "This script only creates the first one. Invite the rest from Settings, which records who did it.",
  );
  process.exit(1);
}

const user = await prisma.operatorUser.create({
  data: { name, email, role: "super_admin", passwordHash: null },
});

const token = await issueToken({ purpose: "invite", email, operatorUserId: user.id });

console.info(`created super-admin ${user.email}`);
console.info("\nSet the password with this link — it works once and expires in 7 days:\n");
console.info(`  ${origin}/accept-invite/${token}\n`);

await prisma.$disconnect();
