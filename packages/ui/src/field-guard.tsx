"use client";

import { useEffect } from "react";

/**
 * Instant, in-place feedback on a numeric field that has been typed into wrongly (Y1).
 *
 * ## The problem
 *
 * `<input type="number">` does something surprising: when you type letters into it, the browser
 * **refuses to expose the text**. `input.value` is `""` and `input.validity.badInput` is `true`. So
 * from the page's point of view the field looks *empty*, not *wrong* — nothing marks it, nothing
 * says anything, and on submit the server receives `""`.
 *
 * That is why this platform's number fields felt broken: you typed, nothing objected, and either the
 * form saved a value you did not choose or the submit did nothing visible at all.
 *
 * ## Why one listener instead of 71 components
 *
 * There are 71 numeric inputs across the four staff apps, in forms written over months. Replacing
 * each with a validated component would be a long change with a long tail of ones that got missed,
 * and the ones that got missed would be exactly the ones nobody looks at.
 *
 * This attaches once per app, at the layout, and covers every numeric input that exists now or is
 * added later — including inputs inside modals and rows rendered after this mounted, because it
 * listens on the document rather than on the elements.
 *
 * A component-level replacement is still worth doing for the highest-traffic forms; this is the
 * floor, not the ceiling.
 *
 * ## What it does
 *
 * - **On typing:** the moment a field goes bad, it is outlined and a message appears under it. The
 *   message is removed the moment the field becomes valid again.
 * - **On submit:** if any numeric field in the form is bad, the submit is stopped, the first bad
 *   field is focused and scrolled to, and its message is shown. Stopping it is the point — the
 *   alternative is the silent save of a wrong number.
 *
 * It never blocks a submit for a field that is merely *empty*. Blank means "unset" all over this
 * product and forcing a value would break every optional field.
 */

const MARK = "data-revio-field-error";

/**
 * ⚠️ MEASURED, NOT ASSUMED — and the first version of this file was wrong.
 *
 * The obvious implementation watches `input.validity.badInput`. Driving a real browser showed that
 * for the reported case — typing letters into `<input type="number">` — **`badInput` stays false**.
 * Chrome does not store the letters and mark the field invalid; it **discards the keystrokes
 * entirely**. `value` becomes `""`, no `input` event fires at all, and the field is indistinguishable
 * from one the user deliberately cleared.
 *
 * That is precisely why this felt broken to use: the keystrokes vanish and nothing explains why.
 *
 * The event that *does* fire is `beforeinput`, carrying the rejected character in `e.data`. So that
 * is what this listens to. `badInput` is still checked, because it does become true for a pasted or
 * partial value like "1e" or "1.2.3" — a different case, equally worth catching.
 */
const NUMERIC_CHARS = /^[0-9.,eE+\-\s]*$/;

/**
 * What to call the field in the message.
 *
 * Prefers the label the user can actually see. Falling back to the `name` attribute produces
 * "Sync Horizon Days" for a field captioned "Sync horizon (days)" — close enough to be understood,
 * far enough off to look like the machine talking rather than the product.
 */
function labelOf(input: HTMLInputElement): string {
  /*
   * ⚠️ NOT `label.textContent`. In this codebase a `<Field>` renders the caption, the input AND a
   * hint inside one `<label>`, so textContent yields "Sync horizon (days)How far ahead to push".
   * Worse, the error element this component injects sits inside that label too — so reading
   * textContent a second time folded the previous error message into the new one, and the message
   * grew every keystroke. Measured in a browser, not reasoned about.
   *
   * The caption is the FIRST piece of text in the label, so take exactly that.
   */
  const label = input.labels?.[0];
  if (label) {
    for (const node of Array.from(label.childNodes)) {
      if (node === input) break;
      if (node instanceof HTMLElement && node.hasAttribute(MARK)) continue;
      if (node instanceof HTMLElement && node.contains(input)) continue;
      const text = node.textContent?.trim();
      if (text) return text;
    }
  }
  const aria = input.getAttribute("aria-label");
  if (aria) return aria;
  const name = input.name || "This field";
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Wording aimed at what to do next, not at the constraint that was violated. */
function messageFor(input: HTMLInputElement): string | null {
  const v = input.validity;
  const Name = labelOf(input);

  // `badInput` is the one that matters: letters typed into a number field. The browser hides the
  // text, so without this the user has no idea why nothing is happening.
  if (v.badInput) return `${Name} must be a number — remove any letters or symbols.`;
  if (v.rangeUnderflow) return `${Name} must be at least ${input.min}.`;
  if (v.rangeOverflow) return `${Name} must be no more than ${input.max}.`;
  if (v.stepMismatch) return `${Name} is not a step this field accepts.`;
  return null;
}

function clearError(input: HTMLInputElement) {
  input.removeAttribute("aria-invalid");
  input.style.removeProperty("border-color");
  const next = input.parentElement?.querySelector(`[${MARK}]`);
  if (next) next.remove();
}

function showError(input: HTMLInputElement, message: string) {
  input.setAttribute("aria-invalid", "true");
  // Inline style rather than a class: this component ships to four apps whose Tailwind builds do
  // not share a safelist, and a class that is not in the built CSS would silently do nothing —
  // which is the same category of bug this whole component exists to fix.
  input.style.borderColor = "#dc2626";

  const existing = input.parentElement?.querySelector(`[${MARK}]`);
  if (existing) {
    existing.textContent = message;
    return;
  }
  const el = document.createElement("p");
  el.setAttribute(MARK, "");
  el.setAttribute("role", "alert");
  el.textContent = message;
  el.style.cssText = "margin-top:4px;font-size:12px;line-height:1.4;color:#dc2626";
  input.insertAdjacentElement("afterend", el);
}

function check(input: HTMLInputElement): boolean {
  const message = messageFor(input);
  if (message) {
    showError(input, message);
    return false;
  }
  clearError(input);
  return true;
}

function isNumeric(el: EventTarget | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && (el.type === "number" || el.inputMode === "numeric");
}

export function FieldGuard() {
  useEffect(() => {
    /*
     * The keystroke the browser is about to throw away. This is the one that matters: no `input`
     * event follows, so this is the only moment at which we can tell the user why their typing did
     * nothing. We do NOT preventDefault — the browser is already discarding it, and intercepting
     * would break pasting a legitimate value.
     */
    const onBeforeInput = (e: Event) => {
      const target = e.target;
      if (!isNumeric(target)) return;
      const data = (e as InputEvent).data;
      if (data && !NUMERIC_CHARS.test(data)) {
        showError(target, `${labelOf(target)} only accepts numbers — “${data}” was not entered.`);
      }
    };

    const onInput = (e: Event) => {
      if (isNumeric(e.target)) check(e.target);
    };

    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const bad = [...form.querySelectorAll<HTMLInputElement>("input")].filter(
        (i) => isNumeric(i) && !check(i),
      );
      if (bad.length === 0) return;
      // Capture phase, so this runs before React's own submit handling and before the server action
      // is invoked.
      e.preventDefault();
      e.stopPropagation();
      bad[0]?.focus();
      bad[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
