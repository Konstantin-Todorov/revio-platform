"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, RotateCcw, Users } from "lucide-react";
import { renderEmail, type EmailBrand, type EmailDetail } from "@revio/core";
import { saveEmailTemplate, resetEmailTemplate } from "@/lib/actions-email";

/**
 * The focused email editor: wording on the left, the guest's actual inbox view on the right.
 *
 * The preview re-renders on every keystroke rather than on save. `renderEmail` is a pure function in
 * @revio/core with no DB or network, so the same code that produces the real email runs here in the
 * browser — what the hotel sees while typing is not an approximation of the output, it IS the output.
 */
export function EmailEditor({
  templateKey, label, description, audience, canDisable, variables,
  locale, locales, enabled: initialEnabled, subject: initialSubject, body: initialBody,
  customised, brand, details, defaults,
}: {
  templateKey: string;
  label: string;
  description: string;
  audience: "guest" | "staff";
  canDisable: boolean;
  variables: Record<string, string>;
  locale: string;
  locales: { key: string; label: string }[];
  enabled: boolean;
  subject: string;
  body: string;
  customised: boolean;
  brand: EmailBrand;
  details: EmailDetail[];
  defaults: { subject: string; body: string };
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = subject !== initialSubject || body !== initialBody || enabled !== initialEnabled;

  const preview = useMemo(
    () => renderEmail({ subject, body, brand, vars: variables, details, preheader: description }),
    [subject, body, brand, variables, details, description],
  );

  function save() {
    const fd = new FormData();
    fd.set("key", templateKey);
    fd.set("locale", locale);
    fd.set("subject", subject);
    fd.set("body", body);
    if (enabled) fd.set("enabled", "on");
    startTransition(async () => {
      await saveEmailTemplate(fd);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function resetToDefault() {
    setSubject(defaults.subject);
    setBody(defaults.body);
    const fd = new FormData();
    fd.set("key", templateKey);
    fd.set("locale", locale);
    startTransition(async () => {
      await resetEmailTemplate(fd);
      router.refresh();
    });
  }

  /** Insert a placeholder at the cursor — quicker and less error-prone than typing the braces. */
  function insertVar(name: string) {
    const el = document.getElementById("email-body") as HTMLTextAreaElement | null;
    const token = `{{${name}}}`;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? start;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* One deliberate way out, and the save state — the only chrome in focus mode. */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-5 py-3">
          <Link
            href="/settings/emails"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-800"
          >
            <ArrowLeft className="h-4 w-4" /> All emails
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-ink-900">{label}</h1>
            <p className="truncate text-[11.5px] text-ink-400">{description}</p>
          </div>

          {audience === "staff" && (
            <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-500">
              <Users className="h-3 w-3" /> internal
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Language: each one is its own wording, so switching is a navigation, not a toggle. */}
            <div className="flex items-center gap-1 rounded-md border border-surface-border bg-white p-0.5">
              {locales.map((l) => (
                <Link
                  key={l.key}
                  href={`/email/${templateKey}?lang=${l.key}`}
                  className={`rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    locale === l.key ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {customised && (
              <button
                onClick={resetToDefault}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-2 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
            <button
              onClick={save}
              disabled={pending || (!dirty && !saved)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        {/* Left — the wording */}
        <div className="space-y-4">
          {canDisable && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-surface-border bg-white p-4 shadow-card">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-600"
              />
              <span className="text-[12.5px] text-ink-700">
                <span className="block font-semibold text-ink-900">Send this email</span>
                Switch off and your guests never receive it. Everything else stays as you left it.
              </span>
            </label>
          )}

          <div className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-surface-border bg-white px-2.5 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600"
            />

            <label className="mb-1 mt-4 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Message</label>
            <textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="w-full resize-y rounded-md border border-surface-border bg-white px-2.5 py-2 font-mono text-[12.5px] leading-relaxed text-ink-900 outline-none transition-colors focus:border-brand-600"
            />

            <div className="mt-3">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                Click to insert
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(variables).map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    title={`Example: ${variables[v]}`}
                    className="rounded border border-surface-border bg-surface-muted px-1.5 py-1 font-mono text-[11px] text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-ink-400">
                These are filled in per guest when the email is sent. The preview shows example values.
              </p>
            </div>
          </div>
        </div>

        {/* Right — exactly what lands in the inbox, updating as you type */}
        <div className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            <div className="border-b border-surface-border px-4 py-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                Live preview — as the guest receives it
              </div>
              <div className="mt-1.5 text-[11.5px] text-ink-500">
                <span className="font-semibold text-ink-700">From:</span> {preview.fromName}
                {preview.replyTo && <> · <span className="font-semibold text-ink-700">Reply-to:</span> {preview.replyTo}</>}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-900">{preview.subject}</div>
            </div>
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              className="h-[calc(100vh-230px)] min-h-[420px] w-full bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
