"use client";

import { useState } from "react";

/**
 * The field groups shared by the three products' first-run screens.
 *
 * Markup only — no server action, no data access. Each app wraps these in its own `<form action={…}>`
 * because a server action belongs to the app that owns the write, but the *questions* are platform
 * facts: a property's address is one address whichever product asked for it.
 *
 * Extracted at the moment the second and third callers appeared (RevioCRS and RevioPMS both need
 * `PropertyFields` and `TaxFields`), never speculatively.
 */

export const welcomeInput =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600";
export const welcomeLabel = "mb-1 block text-[12.5px] font-semibold text-ink-700";
const hint = "mt-1 block text-[12px] text-ink-400";

export function WelcomeError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{message}</p>;
}

/** A labelled section inside a longer screen, so a grouped screen still reads as separate thoughts. */
export function WelcomeSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[13.5px] font-bold text-ink-900">{title}</h2>
        {note && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export interface PropertyFieldValues {
  name: string;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
  timezone: string;
  baseCurrency: string;
  checkInTime: string;
  checkOutTime: string;
}

/**
 * Who and where the hotel is.
 *
 * Grouped rather than split across four screens because it is one thought, and because the address
 * and contact email are not cosmetic: they print on every confirmation a guest receives. Currency and
 * timezone are prefilled from provisioning and confirmed here — a wrong currency is discovered on an
 * OTA, and a wrong timezone moves every arrival date by a day.
 */
export function PropertyFields({ values }: { values: PropertyFieldValues }) {
  return (
    <div className="space-y-6">
      <WelcomeSection title="Your hotel">
        <label className="block">
          <span className={welcomeLabel}>Property name</span>
          <input name="name" defaultValue={values.name} required className={welcomeInput} />
        </label>

        <label className="block">
          <span className={welcomeLabel}>Address</span>
          <input
            name="address"
            defaultValue={values.address ?? ""}
            className={welcomeInput}
            placeholder="ul. Vitosha 12, Sofia 1000, Bulgaria"
          />
          <span className={hint}>Shown on booking confirmations.</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={welcomeLabel}>Contact email</span>
            <input
              name="contactEmail"
              type="email"
              defaultValue={values.contactEmail ?? ""}
              className={welcomeInput}
              placeholder="reception@yourhotel.com"
            />
            <span className={hint}>Where guests reply.</span>
          </label>
          <label className="block">
            <span className={welcomeLabel}>Phone</span>
            <input
              name="phone"
              defaultValue={values.phone ?? ""}
              className={welcomeInput}
              placeholder="+359 2 000 0000"
            />
          </label>
        </div>
      </WelcomeSection>

      <WelcomeSection title="How you operate">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={welcomeLabel}>Currency</span>
            <select name="baseCurrency" defaultValue={values.baseCurrency} className={welcomeInput}>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — US dollar</option>
              <option value="GBP">GBP — Pound sterling</option>
              <option value="RON">RON — Romanian leu</option>
            </select>
          </label>
          <label className="block">
            <span className={welcomeLabel}>Time zone</span>
            <select name="timezone" defaultValue={values.timezone} className={welcomeInput}>
              <option value="Europe/Sofia">Europe/Sofia</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Athens">Europe/Athens</option>
              <option value="Europe/Bucharest">Europe/Bucharest</option>
              <option value="Europe/Madrid">Europe/Madrid</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={welcomeLabel}>Check-in from</span>
            <input name="checkInTime" type="time" defaultValue={values.checkInTime} className={welcomeInput} />
          </label>
          <label className="block">
            <span className={welcomeLabel}>Check-out by</span>
            <input name="checkOutTime" type="time" defaultValue={values.checkOutTime} className={welcomeInput} />
          </label>
        </div>
      </WelcomeSection>
    </div>
  );
}

export interface TaxFieldValues {
  vatStandardPct: number;
  vatReducedPct: number;
  /** Existing city tax per person per night, in major units, or "" when none is set. */
  cityTax: string;
  currency: string;
  invoiceIssuerName: string | null;
  invoiceVatId: string | null;
  invoiceAddress: string | null;
}

/**
 * Everything that makes an invoice correct.
 *
 * The issuer identity was previously asked nowhere at all, so a hotel could finish setup, take a
 * booking and issue a tax document with no VAT number on it — which in most jurisdictions is not an
 * invoice, it is a piece of paper. VAT rates carry jurisdiction defaults and are still shown rather
 * than assumed: they are a money field, and a default nobody reads is money decided by us.
 */
export function TaxFields({ values }: { values: TaxFieldValues }) {
  return (
    <div className="space-y-6">
      <WelcomeSection title="VAT" note="Bulgarian defaults shown — change them if your rates differ.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={welcomeLabel}>Standard rate (%)</span>
            <input
              name="vatStandardPct"
              type="number"
              min={0}
              max={100}
              defaultValue={values.vatStandardPct}
              className={welcomeInput}
            />
            <span className={hint}>Extras, minibar, restaurant.</span>
          </label>
          <label className="block">
            <span className={welcomeLabel}>Accommodation rate (%)</span>
            <input
              name="vatReducedPct"
              type="number"
              min={0}
              max={100}
              defaultValue={values.vatReducedPct}
              className={welcomeInput}
            />
            <span className={hint}>The reduced rate on the room itself.</span>
          </label>
        </div>
      </WelcomeSection>

      <WelcomeSection title="City tax" note="Charged per person per night. Leave empty if your city has none.">
        <label className="block sm:max-w-[16rem]">
          <span className={welcomeLabel}>Amount ({values.currency})</span>
          <input
            name="cityTax"
            inputMode="decimal"
            defaultValue={values.cityTax}
            className={welcomeInput}
            placeholder="1.50"
          />
        </label>
      </WelcomeSection>

      <WelcomeSection
        title="Who issues the invoice"
        note="The legal details printed on every invoice. Usually your company, not the hotel's trading name."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={welcomeLabel}>Company name</span>
            <input
              name="invoiceIssuerName"
              defaultValue={values.invoiceIssuerName ?? ""}
              className={welcomeInput}
              placeholder="Hotel Sofia EOOD"
            />
          </label>
          <label className="block">
            <span className={welcomeLabel}>VAT number</span>
            <input
              name="invoiceVatId"
              defaultValue={values.invoiceVatId ?? ""}
              className={welcomeInput}
              placeholder="BG123456789"
            />
          </label>
        </div>
        <label className="block">
          <span className={welcomeLabel}>Registered address</span>
          <input
            name="invoiceAddress"
            defaultValue={values.invoiceAddress ?? ""}
            className={welcomeInput}
            placeholder="ul. Vitosha 12, Sofia 1000"
          />
        </label>
      </WelcomeSection>
    </div>
  );
}

/**
 * The personalisation step. The only screen in first-run that gives something back.
 *
 * A live preview rather than a form: the point of asking is that they see the result, which is also
 * why this is the step most likely to be finished rather than skipped. One answer brands both the
 * hotel's email and its own booking page — `bookingBrandColor` is null-inherits-email, so the second
 * surface follows without being asked about.
 */
export function BrandFields({
  propertyName,
  senderName,
  brandColor,
  logoUrl,
}: {
  propertyName: string;
  senderName: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}) {
  const [colour, setColour] = useState(brandColor ?? "#0E7C86");
  const [name, setName] = useState(senderName ?? propertyName);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={welcomeLabel}>Sender name</span>
          <input
            name="emailSenderName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={welcomeInput}
            placeholder={propertyName}
          />
          <span className={hint}>Who guest emails appear to come from.</span>
        </label>

        <label className="block">
          <span className={welcomeLabel}>Your colour</span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-surface-border bg-white p-1"
              aria-label="Brand colour"
            />
            <input
              name="emailBrandColor"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className={welcomeInput}
            />
          </span>
        </label>
      </div>

      <label className="block">
        <span className={welcomeLabel}>Logo link (optional)</span>
        <input name="emailLogoUrl" defaultValue={logoUrl ?? ""} className={welcomeInput} placeholder="https://…" />
        <span className={hint}>
          You can upload one later in Settings — a link is quicker if you already have it online.
        </span>
      </label>

      {/* What they are actually buying with this screen. */}
      <div className="overflow-hidden rounded-lg border border-surface-border bg-white">
        <div className="border-b border-surface-border px-4 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-400">
          Preview
        </div>
        <div className="p-5">
          <div className="text-[13px] font-bold" style={{ color: colour }}>
            {name || propertyName}
          </div>
          <p className="mt-2 text-[13px] text-ink-700">Dear Elena, your booking is confirmed.</p>
          <span
            className="mt-3 inline-block rounded-md px-3.5 py-2 text-[12.5px] font-semibold text-white"
            style={{ backgroundColor: colour }}
          >
            View your booking
          </span>
          <p className="mt-4 text-[11.5px] text-ink-400">
            The same colour is used on your own booking page unless you change it there.
          </p>
        </div>
      </div>
    </div>
  );
}
