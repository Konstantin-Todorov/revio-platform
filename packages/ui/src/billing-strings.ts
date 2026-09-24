import type { BillingIdentityField, BillingIdentityProblemCode } from "@revio/core";
import type { Translations } from "./i18n";

/**
 * The hotel's own billing section — the bill (`BillingPanel`), the company-details form
 * (`BillingIdentityForm`) and the page that holds them, which is the same in all three products.
 *
 * **Strings only**, `{name}` placeholders filled with `fill()`: the form is a client component.
 *
 * ⚠️ What stays English: the invoice itself and its line items (`Invoice.lineItems` is a record of
 * what was billed, written when it was issued) — legal documents are not translated until somebody
 * qualified does it (`@revio/ui/i18n`).
 */
export interface BillingStrings {
  panel: {
    monthlyPlan: string;
    perMonth: string;
    /** "{n}" */
    roomsOne: string;
    roomsMany: string;
    platformFee: string;
    /** "{n}" products */
    bundleDiscount: string;
    bundleHint: string;
    total: string;
    vatNote: string;
    /** "{names}" · "{dates}" */
    trialsOne: string;
    trialsMany: string;
    /** Joins two names or dates — "and". */
    and: string;
    owedOne: string;
    /** "{n}" */
    owedMany: string;
    /** "{amount}" */
    owedTotal: string;
    byTransfer: string;
    reference: string;
    invoices: string;
    invoicesIntro: string;
    noInvoices: string;
    cols: { period: string; for: string; amount: string; status: string };
    /** "{amount}" */
    refunded: string;
    paid: string;
    due: string;
    payByCard: string;
    testLink: string;
    wrongBefore: string;
    /** " or write to {email}" */
    wrongEmail: string;
    wrongAfter: string;
  };
  /** Keyed by `ROOM_TIERS[].plan`, so the price list and the bill say the same words. */
  tiers: Record<"starter" | "growth" | "scale" | "enterprise", string>;
  form: {
    fields: Record<BillingIdentityField, string>;
    hints: Partial<Record<BillingIdentityField, string>>;
    problems: Record<BillingIdentityProblemCode, string>;
    save: string;
    saving: string;
    saved: string;
    /** "{date}" */
    lastUpdated: string;
    nothingSaved: string;
    notPermitted: string;
  };
  page: {
    keptTitle: string;
    keptBody: string;
    failedTitle: string;
    failedBody: string;
    companyTitle: string;
    companyBefore: string;
    companyStrong: string;
    companyAfter: string;
    promptMissing: string;
    /** "{fields}" — the field names, lower case, comma separated. */
    promptIncomplete: string;
  };
}

export const billingStrings: Translations<BillingStrings> = {
  en: {
    panel: {
      monthlyPlan: "Your monthly plan",
      perMonth: "/ month",
      roomsOne: "{n} room",
      roomsMany: "{n} rooms",
      platformFee: "Platform fee",
      bundleDiscount: "Bundle discount — {n} products",
      bundleHint: "The products after the first cost us far less to run, so they cost you less",
      total: "Total each month",
      vatNote:
        "List prices exclude VAT. Whether VAT applies to you, and at what rate, depends on where your company is registered — your invoice states the treatment that was applied to it.",
      trialsOne: "{names} is on a free trial and is not in the figure above. It runs until {dates}, and nothing starts charging on its own.",
      trialsMany: "{names} are on a free trial and are not in the figure above. They run until {dates}, and nothing starts charging on its own.",
      and: "and",
      owedOne: "One invoice is waiting to be paid",
      owedMany: "{n} invoices are waiting to be paid",
      owedTotal: "{amount} in total.",
      byTransfer: "By bank transfer",
      reference: "Quote the invoice number as the reference so we can match it the same day.",
      invoices: "Invoices",
      invoicesIntro: "Every invoice we have issued you. Each one is emailed to the account owner when it is sent.",
      noInvoices: "Nothing has been invoiced yet. Your first invoice arrives at the end of your first full month.",
      cols: { period: "Period", for: "For", amount: "Amount", status: "Status" },
      refunded: "{amount} refunded",
      paid: "paid",
      due: "due",
      payByCard: "Pay by card",
      testLink: "test link — charges nothing",
      wrongBefore: "Something here looks wrong? Reply to any Revio email",
      wrongEmail: " or write to {email}",
      wrongAfter: " and a person will check it. We would rather fix a number than have you pay one you disagree with.",
    },
    tiers: { starter: "0–30 rooms", growth: "31–50 rooms", scale: "51–100 rooms", enterprise: "100+ rooms" },
    form: {
      fields: {
        legalName: "Registered company name",
        country: "Country",
        companyId: "Company number",
        vatId: "VAT number",
        addressLine: "Address",
        city: "City",
        postCode: "Post code",
        billingEmail: "Billing email",
        attention: "For the attention of",
      },
      hints: {
        legalName: "As registered, which may differ from the name guests know you by",
        companyId: "EIK in Bulgaria, company number elsewhere",
        vatId: "Leave blank if you are not VAT registered",
        country: "Two-letter code — it decides whether VAT applies",
        billingEmail: "Where invoices are sent. Blank sends them to the account owner",
        attention: "Optional — a name or a department, so it reaches the right desk",
      },
      problems: {
        legalNameRequired:
          "We need the company's registered name, exactly as it appears on your company documents — not the hotel's trading name, if they differ.",
        countryRequired: "The country decides whether VAT applies to your invoice at all, so we cannot issue one without it.",
        addressRequired: "A tax invoice must carry the customer's address.",
        cityRequired: "A tax invoice must carry the customer's city.",
        countryShape: "Give the country as its two-letter code, for example BG or DE.",
        vatShape: "That does not look like a {country} VAT number. It should start with {prefix} — check it against your registration certificate.",
        emailShape: "That email address does not look right — invoices sent to it would bounce.",
      },
      save: "Save company details",
      saving: "Saving…",
      saved: "Saved. Your next invoice will carry these details.",
      lastUpdated: "Last updated by you on {date}",
      nothingSaved: "Nothing was saved — see the fields marked below.",
      notPermitted: "Only the owner or an admin can change what this account pays for. Ask one of them.",
    },
    page: {
      keptTitle: "Billing is kept to the account owner",
      keptBody:
        "What this hotel pays, and the invoices behind it, are visible to the owner and to admins. Ask one of them if you need a copy of an invoice.",
      failedTitle: "We could not load your billing details",
      failedBody:
        "This is our problem, not yours — nothing about your account has changed. Reload the page, and if it happens again reply to any Revio email and we will look at it.",
      companyTitle: "Your company details",
      companyBefore: "These go on the invoices ",
      companyStrong: "Revio issues to you",
      companyAfter: " — not on the invoices you issue your guests, which are set up separately under your property.",
      promptMissing:
        "We do not have your company details yet, so we cannot issue you an invoice. It takes a minute and your bookkeeper will need it.",
      promptIncomplete: "Your company details are incomplete, so an invoice cannot be issued yet: {fields}.",
    },
  },
  bg: {
    panel: {
      monthlyPlan: "Вашият месечен план",
      perMonth: "/ месец",
      roomsOne: "{n} стая",
      roomsMany: "{n} стаи",
      platformFee: "Такса за платформата",
      bundleDiscount: "Отстъпка за пакет — {n} продукта",
      bundleHint: "Продуктите след първия ни струват много по-малко за поддръжка, затова и на Вас струват по-малко",
      total: "Общо на месец",
      vatNote:
        "Цените са без ДДС. Дали дължите ДДС и по каква ставка зависи от това къде е регистрирана фирмата Ви — във всяка фактура е посочено какво третиране е приложено.",
      trialsOne: "{names} е в безплатен пробен период и не е включен в сумата по-горе. Той продължава до {dates} и нищо не започва да се таксува само.",
      trialsMany: "{names} са в безплатен пробен период и не са включени в сумата по-горе. Той продължава до {dates} и нищо не започва да се таксува само.",
      and: "и",
      owedOne: "Една фактура чака плащане",
      owedMany: "{n} фактури чакат плащане",
      owedTotal: "Общо {amount}.",
      byTransfer: "С банков превод",
      reference: "Посочете номера на фактурата като основание за плащане, за да я отнесем още същия ден.",
      invoices: "Фактури",
      invoicesIntro: "Всички фактури, които сме Ви издали. Всяка се изпраща по имейл на собственика на профила, когато бъде издадена.",
      noInvoices: "Все още нищо не е фактурирано. Първата Ви фактура идва в края на първия Ви пълен месец.",
      cols: { period: "Период", for: "За", amount: "Сума", status: "Статус" },
      refunded: "{amount} възстановени",
      paid: "платена",
      due: "дължима",
      payByCard: "Плати с карта",
      testLink: "тестова връзка — нищо не се таксува",
      wrongBefore: "Нещо тук изглежда грешно? Отговорете на който и да е имейл от Revio",
      wrongEmail: " или пишете на {email}",
      wrongAfter: " и човек ще го провери. Предпочитаме да поправим сума, вместо да платите такава, с която не сте съгласни.",
    },
    tiers: { starter: "0–30 стаи", growth: "31–50 стаи", scale: "51–100 стаи", enterprise: "Над 100 стаи" },
    form: {
      fields: {
        legalName: "Регистрирано наименование на фирмата",
        country: "Държава",
        companyId: "ЕИК",
        vatId: "ДДС номер",
        addressLine: "Адрес",
        city: "Град",
        postCode: "Пощенски код",
        billingEmail: "Имейл за фактури",
        attention: "На вниманието на",
      },
      hints: {
        legalName: "Както е регистрирана — може да се различава от името, с което Ви познават гостите",
        companyId: "ЕИК в България, регистрационен номер на фирмата в други държави",
        vatId: "Оставете празно, ако не сте регистрирани по ДДС",
        country: "Двубуквен код — от него зависи дали се начислява ДДС",
        billingEmail: "Къде се изпращат фактурите. Ако е празно — на собственика на профила",
        attention: "По избор — име или отдел, за да стигне до правилния човек",
      },
      problems: {
        legalNameRequired:
          "Нужно ни е регистрираното наименование на фирмата, точно както е в документите ѝ — а не търговското име на хотела, ако се различават.",
        countryRequired: "От държавата зависи дали изобщо се начислява ДДС по фактурата Ви, затова не можем да издадем фактура без нея.",
        addressRequired: "Данъчната фактура трябва да съдържа адреса на клиента.",
        cityRequired: "Данъчната фактура трябва да съдържа града на клиента.",
        countryShape: "Въведете държавата с двубуквения ѝ код, например BG или DE.",
        vatShape: "Това не прилича на ДДС номер от {country}. Трябва да започва с {prefix} — проверете го в удостоверението си за регистрация.",
        emailShape: "Този имейл адрес не изглежда правилен — фактурите, изпратени до него, няма да стигнат.",
      },
      save: "Запази данните на фирмата",
      saving: "Запазване…",
      saved: "Запазено. Следващата Ви фактура ще е с тези данни.",
      lastUpdated: "Последно обновено от Вас на {date}",
      nothingSaved: "Нищо не е запазено — вижте отбелязаните полета по-долу.",
      notPermitted: "Само собственикът или администратор може да променя за какво плаща този профил. Обърнете се към някой от тях.",
    },
    page: {
      keptTitle: "Плащанията са видими само за собственика на профила",
      keptBody:
        "Колко плаща този хотел и фактурите за това се виждат от собственика и администраторите. Обърнете се към някой от тях, ако Ви трябва копие на фактура.",
      failedTitle: "Не успяхме да заредим данните за плащане",
      failedBody:
        "Проблемът е при нас, не при Вас — нищо в профила Ви не е променено. Презаредете страницата и ако се случи отново, отговорете на който и да е имейл от Revio и ще го проверим.",
      companyTitle: "Данни на Вашата фирма",
      companyBefore: "Те се отпечатват върху фактурите, ",
      companyStrong: "които Revio издава на Вас",
      companyAfter: " — а не върху фактурите, които Вие издавате на гостите си. Те се настройват отделно, към обекта Ви.",
      promptMissing:
        "Все още нямаме данните на фирмата Ви, затова не можем да Ви издадем фактура. Отнема минута, а счетоводителят Ви ще има нужда от нея.",
      promptIncomplete: "Данните на фирмата Ви не са пълни, затова още не може да се издаде фактура: {fields}.",
    },
  },
};
