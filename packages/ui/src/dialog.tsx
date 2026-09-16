"use client";

import * as Radix from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { duration, easing } from "./motion";

/**
 * The one modal dialog.
 *
 * ## Why a library underneath, after we had already written four of these
 *
 * Seven files in this repo carry `role="dialog"` or `aria-modal`, each with its own focus handling,
 * its own Escape key listener and its own idea of what happens to the page behind it. That is the
 * "one component per concept" rule broken four ways, and the copies had already diverged: some
 * returned focus to the trigger on close and some left it on `<body>`, so a keyboard user's next Tab
 * restarted from the top of the document.
 *
 * Radix supplies **behaviour only** — the focus trap, `aria-labelledby` and `aria-describedby`
 * wiring, Escape, click-outside, `inert` on the rest of the page, and the scroll lock. All of those
 * were checked on the real screen and all of them work. It ships no styles at all, so every pixel
 * below is still ours and the design tokens are unchanged. That is the whole reason it is worth
 * taking on a dependency for this and not for, say, a button.
 *
 * ⚠️ **Focus RETURN is ours, not Radix's** — see the comment on `restoreTo` below. It is the one
 * piece of the behaviour that did not arrive for free, and it is the piece this component existed
 * to fix.
 *
 * ## The animation is stateful, not a keyframe
 *
 * Radix marks the element `data-state="open"` from its first paint, so a CSS transition has no
 * *from* state to run out of and the enter never plays. The five apps also have five separately
 * drifting Tailwind configs and none of them defines a keyframe, so an `animate-*` class would have
 * to be added in five places to work everywhere.
 *
 * So the transition is driven by one `useEffect` flip, the same way `menu.tsx` does it — no config
 * change, and identical behaviour in all five apps.
 *
 * ⚠️ **Exit is faster than enter** (195ms against 225ms), which is the rule in `motion.ts`: by the
 * time something is closing the user has already decided and is waiting on us, so a symmetrical
 * exit reads as lag.
 *
 * ## `description` is not optional-in-practice
 *
 * Radix warns at runtime when a dialog has no description, and it is right to: a screen reader
 * announces the title and then the raw contents. Pass `description={null}` deliberately when the
 * body genuinely explains itself — that spells the decision out instead of leaving a console warning
 * nobody reads.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  footerAlign = "end",
  size = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** `null` means "the body explains itself" — a deliberate choice, not an omission. */
  description: string | null;
  footer?: ReactNode;
  /**
   * `end` for a decision — Cancel sits left of Confirm, the way every OS dialog does it.
   * `start` for an action hub, where the footer is a toolbar of equal choices rather than a
   * question with an answer. Right-aligning a toolbar implies a primary action that isn't there.
   */
  footerAlign?: "start" | "end";
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}) {
  /*
   * ⚠️ Focus return is done HERE, explicitly, because Radix's own restore did not fire.
   *
   * Found by opening the real screen rather than by reasoning: with the trigger focused, Enter
   * opened the dialog, focus moved inside it, Escape closed it — and focus landed on `<body>`. The
   * trigger was still in the document and was still the same node, so there was nothing wrong with
   * the page: Radix simply had not captured it. Its `FocusScope` restores whatever was focused when
   * `Content` mounted, and mounting here is driven by a parent state flip rather than by a
   * `Dialog.Trigger`, which is the case it captures reliably.
   *
   * Capturing during render is deliberate and is the only moment that works: the child `Content`
   * mounts in this same commit and moves focus in an effect, and child effects run BEFORE the
   * parent's — so any `useEffect` here would read an `activeElement` that Radix had already moved.
   *
   * Without this, a keyboard user closes a dialog and the next Tab restarts from the top of the
   * document — which is the exact defect this component was written to remove from four hand-rolled
   * copies, so shipping it with the same hole would have been worse than leaving them alone.
   */
  const restoreTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) {
    const active = typeof document === "undefined" ? null : document.activeElement;
    restoreTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }
  wasOpen.current = open;

  // Radix keeps the node mounted while it closes, so this drives both directions.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    // A frame, so the browser paints the closed state once and has something to transition from.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const width = size === "sm" ? "max-w-[380px]" : size === "lg" ? "max-w-[640px]" : "max-w-[480px]";

  // `motion.ts` splits the curve by direction on purpose: arriving decelerates into place, leaving
  // accelerates away. Using `standard` for both is the thing that makes a dialog feel mechanical.
  const motion = shown
    ? `${duration.enter} ${easing.out}`
    : `${duration.exit} ${easing.in}`;

  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay
          className="fixed inset-0 z-50 bg-brand-900/45"
          style={{
            opacity: shown ? 1 : 0,
            transition: `opacity ${motion}`,
          }}
        />
        <Radix.Content
          onCloseAutoFocus={(e) => {
            // Take over from Radix: it would either restore to a node it never captured, or leave
            // focus on <body>. `preventScroll` stops the page jumping to the trigger on close.
            e.preventDefault();
            restoreTo.current?.focus({ preventScroll: true });
          }}
          /* The panel takes focus only programmatically, on open, never by Tab: Radix gives it
             tabIndex={-1} and moves focus here so a screen reader lands on the title. A ring drawn
             around the whole panel every time a dialog opens reads as an error state, not a
             position — so the ring lives on the things you can actually Tab to.
             a11y-lint: focus shown by focus-visible:shadow-focus on the close button below, and by
             each control the caller puts in the body and footer. */
          className={`fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] ${width} -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-overlay focus:outline-none`}
          style={{
            opacity: shown ? 1 : 0,
            transform: `translate(-50%, -50%) scale(${shown ? 1 : 0.97})`,
            transition: `opacity ${motion}, transform ${motion}`,
          }}
        >
          <div className="flex flex-col gap-1.5 px-[22px] pb-4 pt-5 pr-12">
            {/* Every dialog gets the same close affordance in the same place, rather than each
                caller remembering an X. Closing through it returns focus to whatever opened the
                dialog, by the same `onCloseAutoFocus` path as Escape and the backdrop. */}
            <Radix.Close
              aria-label="Close"
              className="absolute right-3.5 top-3.5 rounded-md p-1.5 text-ink-400 transition-[background-color,color] hover:bg-surface-muted hover:text-ink-700 focus-visible:outline-none focus-visible:shadow-focus"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Radix.Close>
            <Radix.Title className="text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink-900">
              {title}
            </Radix.Title>
            {description === null ? (
              // Radix warns without this; the warning is correct, so answer it rather than silence it.
              <Radix.Description className="sr-only">{title}</Radix.Description>
            ) : (
              <Radix.Description className="text-[12.5px] leading-relaxed text-ink-600">
                {description}
              </Radix.Description>
            )}
          </div>

          {children ? <div className="px-[22px] pb-1">{children}</div> : null}

          {footer ? (
            // `surface-page` plus a hairline, not a shadow: the footer is part of the panel, and a
            // second elevation inside an already-elevated surface reads as two cards.
            <div
              className={`mt-4 flex flex-wrap gap-2.5 border-t border-ink-100 bg-surface-page px-[22px] py-3.5 ${
                footerAlign === "start" ? "justify-start" : "justify-end"
              }`}
            >
              {footer}
            </div>
          ) : null}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

/**
 * Wrap a button in this to have it close the dialog without the caller threading `onOpenChange`
 * down. `asChild` means it renders *your* button, not another one around it.
 */
export function DialogClose({ children }: { children: ReactNode }) {
  return <Radix.Close asChild>{children}</Radix.Close>;
}
