"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Info, RotateCcw } from "lucide-react";
import { renderEmail, type EmailBrand, type EmailDetail } from "@revio/core";
import { fill, translate } from "./i18n";
import { useLocale } from "./i18n-context";
import { guestEmailsStrings } from "./guest-emails-strings";

/**
 * The focused email editor: wording on the left, the guest's actual inbox view on the right.
 *
 * The preview re-renders on every keystroke rather than on save. `renderEmail` is a pure function in
 * @revio/core with no DB or network, so the same code that produces the real email runs here in the
 * browser — what the hotel sees while typing is not an approximation of the output, it IS the output.
 */
export function EmailEditor({
  templateKey, label, description, canDisable, notice, variables,
  locale, locales, enabled: initialEnabled, subject: initialSubject, body: initialBody,
  customised, brand, details, defaults, saveAction, resetAction, backHref, langHref,
}: {
  templateKey: string;
  label: string;
  description: string;
  canDisable: boolean;
  /** Why this email will not go out as things stand (nothing this hotel runs sends it), said above the
   *  wording so nobody writes it expecting it to go. Null when it sends. */
  notice: string | null;
  variables: Record<string, string>;
  locale: string;
  locales: { key: string; label: string; edited: boolean; primary: boolean }[];
  enabled: boolean;
  subject: string;
  body: string;
  customised: boolean;
  brand: EmailBrand;
  details: EmailDetail[];
  defaults: { subject: string; body: string };
  /** The app's own actions — the perimeter is per product. */
  saveAction: (fd: FormData) => Promise<void>;
  resetAction: (fd: FormData) => Promise<void>;
  backHref: string;
  /** Where another language of this email opens — "{lang}" is filled. */
  langHref: string;
}) {
  const router = useRouter();
  const all = translate(guestEmailsStrings, useLocale());
  const s = all.editor;
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = subject !== initialSubject || body !== initialBody || enabled !== initialEnabled;
  const localeLabel = locales.find((l) => l.key === locale)?.label ?? locale;

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
      await saveAction(fd);
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
      await resetAction(fd);
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
    <div className="flex flex-col gap-4">
      {/* One deliberate way out, and the save state — the only chrome in focus mode. */}
      {/* Sits inside the product's own Settings frame, under its topbar — so the Save bar sticks just
          below that bar rather than to the top of the window. */}
      <header className="sticky top-[60px] z-10 rounded-lg border border-surface-border bg-white/95 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-800"
          >
            <ArrowLeft className="h-4 w-4" /> {s.back}
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-ink-900">{label}</h1>
            <p className="truncate text-[11.5px] text-ink-400">{description}</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/*
              Language. Each one is its OWN wording — switching is a navigation, and the page
              remounts this editor so the text always matches the tab.

              Deliberately here and not in Settings: a hotel translates one email at a time, and
              flipping a global setting to do it would mean four navigations per email and would
              conflate "which language am I writing" with "which language do guests receive".
              The second one is a real setting and lives in Settings — it is marked below.
            */}
            <div className="flex items-center gap-1 rounded-md border border-surface-border bg-white p-0.5">
              {locales.map((l) => (
                <Link
                  key={l.key}
                  href={fill(langHref, { lang: l.key })}
                  onClick={(e) => {
                    // Losing typed wording to a mis-click is worse than one confirm.
                    if (dirty && !confirm(s.leaveConfirm)) {
                      e.preventDefault();
                    }
                  }}
                  title={fill(l.edited ? s.yoursTitle : s.oursTitle, { language: l.label })}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    locale === l.key ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"
                  }`}
                >
                  {l.label}
                  {l.primary && (
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide ${
                        locale === l.key ? "text-white/70" : "text-ink-400"
                      }`}
                    >
                      {s.defaultBadge}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      l.edited
                        ? locale === l.key ? "bg-white" : "bg-success-500"
                        : locale === l.key ? "bg-white/35" : "bg-ink-200"
                    }`}
                  />
                </Link>
              ))}
            </div>

            {customised && (
              <button
                onClick={resetToDefault}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-2 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {s.reset}
              </button>
            )}
            <button
              onClick={save}
              disabled={pending || (!dirty && !saved)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saved ? <><Check className="h-3.5 w-3.5" /> {s.saved}</> : pending ? s.saving : dirty ? s.save : s.saved}
            </button>
          </div>
        </div>
      </header>

      <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Left — the wording */}
        <div className="space-y-4">
          {/*
            Say whose words these are. Our translation is good enough to send unedited, so a hotel
            that opens Bulgarian sees real Bulgarian — but it must never be ambiguous whether the
            text on screen is theirs or ours, because that decides whether they need to do anything.
          */}
          {notice && (
            <p className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-2.5 text-[12px] text-warning-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {notice}
            </p>
          )}
          {!customised && (
            <p className="rounded-lg border border-surface-border bg-surface-muted px-4 py-2.5 text-[12px] text-ink-600">
              {fill(s.oursNote, { language: localeLabel })}
            </p>
          )}

          {canDisable ? (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-surface-border bg-white p-4 shadow-card">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-600"
              />
              <span className="text-[12.5px] text-ink-700">
                <span className="block font-semibold text-ink-900">{s.send}</span>
                {s.sendHint}
              </span>
            </label>
          ) : (
            <p className="rounded-lg border border-surface-border bg-white px-4 py-2.5 text-[12px] text-ink-600">{s.always}</p>
          )}

          <div className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{s.subject}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-surface-border bg-white px-2.5 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600"
            />

            <label className="mb-1 mt-4 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{s.message}</label>
            <textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="w-full resize-y rounded-md border border-surface-border bg-white px-2.5 py-2 font-mono text-[12.5px] leading-relaxed text-ink-900 outline-none transition-colors focus:border-brand-600"
            />

            <div className="mt-3">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                {s.insert}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(variables).map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    title={fill(s.example, { value: variables[v] ?? "" })}
                    className="rounded border border-surface-border bg-surface-muted px-1.5 py-1 font-mono text-[11px] text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-ink-400">
                {s.insertHint}
              </p>
            </div>
          </div>
        </div>

        {/* Right — exactly what lands in the inbox, updating as you type */}
        <div className="xl:sticky xl:top-[140px] xl:self-start">
          <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            <div className="border-b border-surface-border px-4 py-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                {s.preview}
              </div>
              <div className="mt-1.5 text-[11.5px] text-ink-500">
                <span className="font-semibold text-ink-700">{all.look.from}</span> {preview.fromName}
                {preview.replyTo && <> · <span className="font-semibold text-ink-700">{all.look.replyToShort}</span> {preview.replyTo}</>}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-900">{preview.subject}</div>
            </div>
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              className="h-[calc(100vh-260px)] min-h-[460px] w-full bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
