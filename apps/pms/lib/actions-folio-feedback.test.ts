import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./actions-folio.ts", import.meta.url), "utf8");

const mutationNames = [
  "postCharge",
  "postPayment",
  "addStayExtra",
  "removeStayExtra",
  "captureDeposit",
  "useDeposit",
  "refundDeposit",
  "createFolio",
  "removeFolio",
  "resolveFolio",
  "resolveMoveDifference",
  "moveFolioLine",
  "voidFolioLine",
] as const;

function exportedAction(name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start, `${name} must remain an exported action`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

describe("folio mutation feedback", () => {
  it.each(mutationNames)("%s confirms a completed mutation", (name) => {
    expect(exportedAction(name)).toContain('setFlash("success"');
  });

  it("has no legacy query-string refusals that render without an explanation", () => {
    expect(source).not.toMatch(/redirect\(`\/folio\/\$\{reservationId\}\?error=/);
  });

  it("sets an explanation before each remaining redirect", () => {
    const lines = source.split("\n");
    for (const [index, line] of lines.entries()) {
      if (!/^\s*redirect\(/.test(line)) continue;
      expect(lines.slice(Math.max(0, index - 4), index).join("\n"), `redirect on line ${index + 1}`).toContain("flashError(");
    }
  });
});
