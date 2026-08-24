/**
 * Re-encrypt every stored credential under a new CONNECTIVITY_SECRET (N5).
 *
 * Rotating an encryption key is not a swap. Every row in the database is sealed with the old key, so
 * changing the variable alone turns every hotel's OTA credentials into noise — silently, and
 * discovered later when a rate push fails for reasons nobody can explain.
 *
 * The three steps, of which this is the second:
 *
 *   1. On every service: set `CONNECTIVITY_SECRET_PREVIOUS` to the CURRENT key and
 *      `CONNECTIVITY_SECRET` to the new one. `decryptSecret` tries the new key and falls back to
 *      the old, so the platform keeps working throughout and there is no unreadable window.
 *   2. Run this. It reads each row (old key), writes it back (new key), and verifies the result.
 *   3. Remove `CONNECTIVITY_SECRET_PREVIOUS`. Anything still needing the old key now fails loudly,
 *      which is what you want: the rotation is complete or it is not.
 *
 *   CONNECTIVITY_SECRET=<new> CONNECTIVITY_SECRET_PREVIOUS=<old> \
 *   DATABASE_URL="postgresql://..." pnpm --filter @revio/db rotate-connectivity-key
 *
 * Idempotent: a row already under the new key is read, re-sealed identically, and counted as done.
 * Safe to re-run after an interruption.
 */
import { forSystem } from "../src/rls.js";
import { decryptSecret, encryptSecret, hasPreviousKey, keyHint } from "../src/crypto.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.CONNECTIVITY_SECRET && !process.env.AUTH_SECRET) {
    console.error("Refusing to run: no CONNECTIVITY_SECRET (or AUTH_SECRET) is set.");
    process.exit(2);
  }
  if (!hasPreviousKey()) {
    // Without the old key, rows sealed under it cannot be read — and this script would "succeed"
    // having re-encrypted nothing, which is the worst possible outcome because it looks like a
    // finished rotation.
    console.error(
      "Refusing to run: CONNECTIVITY_SECRET_PREVIOUS is not set.\n" +
        "Set it to the OLD key before rotating, or existing rows cannot be read at all.",
    );
    process.exit(2);
  }

  const db = forSystem();
  const rows = await db.connectivityCredential.findMany({
    select: { id: true, tenantId: true, cipher: true },
  });

  console.log(`\n${rows.length} credential(s) to re-encrypt${DRY_RUN ? " (dry run)" : ""}.\n`);

  let rotated = 0;
  let failed = 0;

  for (const row of rows) {
    let plain: string;
    try {
      plain = decryptSecret(row.cipher);
    } catch {
      // Readable by NEITHER key. Reported, never guessed at, and never deleted — a credential we
      // cannot read is a problem for a human, and destroying it would turn a recoverable mistake
      // into a hotel that silently stops syncing.
      console.error(`  FAIL  ${row.id} (tenant ${row.tenantId}) — readable by neither key`);
      failed++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  would rotate  ${row.id} — ${keyHint(plain)}`);
      rotated++;
      continue;
    }

    const cipher = encryptSecret(plain);
    await db.connectivityCredential.update({ where: { id: row.id }, data: { cipher } });

    // Read it back through the same path the application uses. Writing a row that cannot be
    // decrypted is the one failure this script exists to prevent, so it is checked rather than
    // assumed.
    const verify = decryptSecret(
      (await db.connectivityCredential.findUniqueOrThrow({
        where: { id: row.id },
        select: { cipher: true },
      })).cipher,
    );
    if (verify !== plain) {
      console.error(`  FAIL  ${row.id} — re-encrypted value did not read back identically`);
      failed++;
      continue;
    }

    console.log(`  ok    ${row.id} — ${keyHint(plain)}`);
    rotated++;
  }

  console.log(`\n${rotated} rotated, ${failed} failed.`);
  if (failed > 0) {
    console.error("Leave CONNECTIVITY_SECRET_PREVIOUS in place until every row is resolved.\n");
    process.exit(1);
  }
  if (!DRY_RUN) {
    console.log("Every credential now reads under the new key.");
    console.log("Remove CONNECTIVITY_SECRET_PREVIOUS from each service to finish the rotation.\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/client.js");
    await prisma.$disconnect();
  });
