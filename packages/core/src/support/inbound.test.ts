import { describe, expect, it } from "vitest";
import {
  REPLY_MARKER,
  bareAddress,
  decideInbound,
  isAutomatedEmail,
  referenceInSubject,
  referenceSuffix,
  stripQuotedReply,
} from "./inbound";
import { supportReference } from "./support";

describe("referenceInSubject — which ticket this belongs to", () => {
  it("finds the reference a mail client carried through the reply", () => {
    expect(referenceInSubject("Re: SR-2LBNMO · Revio support")).toBe("SR-2LBNMO");
    expect(referenceInSubject("RE: RE: Fwd: SR-2LBNMO")).toBe("SR-2LBNMO");
  });

  it("is case-insensitive, because clients rewrite subjects", () => {
    expect(referenceInSubject("re: sr-2lbnmo hello")).toBe("SR-2LBNMO");
  });

  it("is null when there is none", () => {
    expect(referenceInSubject("My rates are wrong")).toBeNull();
    expect(referenceInSubject("")).toBeNull();
  });

  it("round-trips whatever supportReference produced", () => {
    const id = "cmtrurie80005xljohf2lbnmo";
    const ref = supportReference(id);
    expect(referenceInSubject(`Re: ${ref} · Revio support`)).toBe(ref);
    expect(id.endsWith(referenceSuffix(ref))).toBe(true);
  });
});

describe("isAutomatedEmail — the check that stops a mail loop", () => {
  it("catches the standard header", () => {
    expect(isAutomatedEmail({ headers: { "Auto-Submitted": "auto-replied" } })).toBe(true);
    // "no" is what a real person's mail says, per RFC 3834.
    expect(isAutomatedEmail({ headers: { "Auto-Submitted": "no" } })).toBe(false);
  });

  it("catches the headers everything else actually uses", () => {
    expect(isAutomatedEmail({ headers: { Precedence: "bulk" } })).toBe(true);
    expect(isAutomatedEmail({ headers: { "X-Autoreply": "yes" } })).toBe(true);
    expect(isAutomatedEmail({ headers: { "X-Auto-Response-Suppress": "OOF" } })).toBe(true);
  });

  it("catches a bounce, which would otherwise be answered forever", () => {
    expect(isAutomatedEmail({ headers: { From: "MAILER-DAEMON@mail.example.com" } })).toBe(true);
    expect(isAutomatedEmail({ headers: { "Return-Path": "<>" } })).toBe(true);
  });

  it("catches the servers that set no header at all, by subject", () => {
    for (const s of [
      "Out of Office: Re: SR-2LBNMO",
      "Automatic reply: your message",
      "Undeliverable: Re: SR-2LBNMO",
      "Delivery Status Notification (Failure)",
    ]) {
      expect(isAutomatedEmail({ subject: s })).toBe(true);
    }
  });

  it("lets a real person through", () => {
    expect(isAutomatedEmail({ subject: "Re: SR-2LBNMO · Revio support", headers: { From: "elena@marinabay.test" } })).toBe(false);
  });
});

describe("stripQuotedReply — what they typed, not what they replied over", () => {
  it("cuts exactly on our own marker", () => {
    const body = `It is still not showing.\n\n${REPLY_MARKER}\n\nOn 4 Sep we wrote: try relinking the rate plan.`;
    expect(stripQuotedReply(body)).toBe("It is still not showing.");
  });

  it("cuts on the attribution line when the marker is missing", () => {
    const body = "Still broken.\n\nOn Thu, 4 Sep 2026 at 21:12, Revio Support <support@reviosoft.app> wrote:\n> try this";
    expect(stripQuotedReply(body)).toBe("Still broken.");
  });

  it("cuts on Outlook's original-message rule", () => {
    expect(stripQuotedReply("Thanks!\n\n-----Original Message-----\nFrom: Revio")).toBe("Thanks!");
  });

  it("cuts a trailing quote block", () => {
    expect(stripQuotedReply("No change.\n\n> That rate plan was not linked\n> please check")).toBe("No change.");
  });

  it("keeps a quote the person wrote around, rather than losing their words", () => {
    const body = "> you said the Sea View was fixed\n\nIt is not — the Family Suite is fine though.";
    expect(stripQuotedReply(body)).toContain("Family Suite is fine");
  });

  it("survives CRLF, which is what actually arrives over SMTP", () => {
    expect(stripQuotedReply(`Hello.\r\n\r\n${REPLY_MARKER}\r\nold stuff`)).toBe("Hello.");
  });

  it("is empty for an empty body rather than throwing", () => {
    expect(stripQuotedReply("")).toBe("");
    expect(stripQuotedReply("   \n  ")).toBe("");
  });
});

describe("bareAddress", () => {
  it("takes the address out of a display name", () => {
    expect(bareAddress("Elena Marinova <Elena@MarinaBay.test>")).toBe("elena@marinabay.test");
    expect(bareAddress("elena@marinabay.test")).toBe("elena@marinabay.test");
  });
});

describe("decideInbound — the whole decision", () => {
  const person = { headers: { "Auto-Submitted": "no" } };

  it("files a reply against the ticket in the subject", () => {
    const d = decideInbound({ ...person, subject: "Re: SR-2LBNMO", text: `Still broken.\n${REPLY_MARKER}\nold` });
    expect(d).toEqual({ action: "reply", reference: "SR-2LBNMO", body: "Still broken." });
  });

  it("treats an email with no reference as a new request", () => {
    const d = decideInbound({ ...person, subject: "My rates are wrong", text: "The August prices are missing." });
    expect(d).toEqual({ action: "new", body: "The August prices are missing." });
  });

  it("ignores an out-of-office even when it quotes the reference", () => {
    const d = decideInbound({ subject: "Out of office: Re: SR-2LBNMO", text: "I am away until Monday." });
    expect(d).toEqual({ action: "ignore", reason: "automated" });
  });

  it("ignores a reply that is nothing but the quoted history", () => {
    const d = decideInbound({ ...person, subject: "Re: SR-2LBNMO", text: `${REPLY_MARKER}\n\n> everything below` });
    expect(d).toEqual({ action: "ignore", reason: "empty" });
  });
});
