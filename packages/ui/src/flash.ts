import { cookies } from "next/headers";

/**
 * A one-shot message from a server action to the next page the user sees.
 *
 * The problem it solves: 134 early `return;` statements across 82 server actions, every one of them
 * a place where a user pressed a button, something legitimately refused it, and the screen came
 * back looking exactly as it did before. A form that silently does nothing is worse than an error —
 * the user's own conclusion is that the software is broken, and their next move is to press it again.
 *
 * Why a cookie rather than a return value: these actions return `Promise<void>` and are wired
 * straight to `<form action={…}>` in server components. Converting them to result-returning actions
 * means a `useActionState` client component per call site — 82 of them — which is a rewrite, not a
 * fix. A cookie needs one line inside the action and nothing at the call site, so the remaining
 * silent paths can be closed one at a time by whoever next touches them.
 *
 * Not `httpOnly`, deliberately: the toast clears itself from the browser after it has been shown,
 * which is the only way to make it one-shot without a second round trip. Nothing secret goes in it.
 */
export type FlashKind = "error" | "success" | "info";

export interface Flash {
  kind: FlashKind;
  message: string;
}

export const FLASH_COOKIE = "revio_flash";

/**
 * Say why an action refused, or confirm that it worked.
 *
 * Call it immediately before the `return` or `redirect` that ends the action. Message rules: say
 * what happened and what to do about it, in the user's words. "That room is already occupied — pick
 * another" beats "Conflict".
 */
export async function setFlash(kind: FlashKind, message: string): Promise<void> {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, JSON.stringify({ kind, message }), {
    path: "/",
    // Long enough to survive a redirect and a slow render, short enough that a message never
    // resurfaces later in the session attached to something the user is no longer doing.
    maxAge: 30,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Convenience for the overwhelmingly common case. */
export async function flashError(message: string): Promise<void> {
  await setFlash("error", message);
}

/** Read the pending message, if any. The toast component clears it browser-side once shown. */
export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Flash>;
    if (typeof parsed.message !== "string" || parsed.message === "") return null;
    const kind: FlashKind =
      parsed.kind === "success" || parsed.kind === "info" ? parsed.kind : "error";
    // Truncated rather than trusted: this is rendered, and the cookie is writable by the browser.
    return { kind, message: parsed.message.slice(0, 300) };
  } catch {
    // A malformed cookie is not worth an error page — the user loses one message.
    return null;
  }
}
