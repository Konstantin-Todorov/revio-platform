import type { Translations } from "@revio/ui/i18n";

/**
 * The folio — the guest's bill — and the folio list. Accounting Bulgarian as a Bulgarian hotel's
 * bookkeeper says it: сметка, салдо, начисление, вземане, фактура, проформа, кредитно известие.
 *
 * ⚠️ The TAX DOCUMENT itself (`/invoice/[id]`) is not in here: it is a legal document, and it stays
 * as it is until somebody qualified signs off its Bulgarian wording (see `@revio/ui/i18n`).
 */
type Resolution = { label: string; detail: string; cta: string; notePlaceholder: string };
type MoveOption = { label: string; detail: string; cta: string };

export interface FolioStrings {
  back: string;
  title: (guest: string) => string;
  subtitle: (rooms: string | null, currency: string, closed: boolean, folios: number) => string;
  closed: string;
  errors: Record<string, string>;
  somethingWrong: string;
  outcome: Record<"settled" | "outstanding" | "paid_offsystem" | "written_off", string>;
  resolutions: Record<"reopen" | "paid_offsystem" | "receivable" | "written_off", Resolution>;
  moveOptions: Record<"comp" | "charge" | "refund" | "waive" | "custom", MoveOption>;
  kinds: Record<string, string>;
  outlets: Record<string, string>;
  docs: Record<"invoice" | "proforma" | "credit_note", string>;
  decisions: Record<"settled" | "paid_offsystem" | "outstanding" | "written_off", { headline: string; meaning: string }>;
  move: {
    upgraded: string; downgraded: string; moved: string;
    booked: (booked: string, staying: string, room: string) => string;
    pricedOver: (nights: number, from: string | null) => string;
    noNights: string;
    difference: string;
    managerDecides: string;
    amountCents: string;
    reasonOptional: string;
    unchanged: (booked: string) => string;
    landedLead: string;
    landedBody: string;
  };
  managerOnly: string;
  removeSplit: string;
  remove: string;
  emptySplit: string;
  folioSuffix: string;
  void: string;
  voidLine: string;
  moveTo: string;
  go: string;
  charges: (a: string) => string;
  payments: (a: string) => string;
  depositsHeldTitle: string;
  depositsHeld: (a: string) => string;
  balance: string;
  across: (n: number) => string;
  companyPlaceholder: string;
  opening: string;
  split: string;
  payment: {
    title: string;
    methods: { cash: string; card: string; company_account: string; bank_transfer: string };
    amount: (currency: string) => string;
    reference: string;
    recording: string;
    take: string;
    note: (gateway: string) => string;
    gatewayTest: string;
    gatewayMock: string;
  };
  checkout: {
    title: string;
    stillHeld: (a: string) => string;
    stillHeldBody: string;
    settled: string;
    outstandingLead: string;
    outstandingTail: (folios: number) => string;
    overridePlaceholder: string;
    withBalance: string;
    emailBill: string;
  };
  charge: {
    title: string;
    state: string;
    kinds: { minibar: string; extra: string; fee: string };
    description: string;
    posting: string;
    add: string;
  };
  extras: {
    title: string;
    none: string;
    count: (n: number) => string;
    note: string;
    perNight: (a: string) => string;
    stopTitle: string;
    namePlaceholder: string;
    pricePlaceholder: (currency: string) => string;
    adding: string;
    add: string;
  };
  invoicing: {
    title: string;
    none: string;
    issued: (n: number) => string;
    note: string;
    document: string;
    folio: string;
    billTo: string;
    buyerVat: string;
    company: string;
    issuing: string;
    issue: string;
  };
  deposits: {
    title: string;
    noTypes: string;
    heldState: (a: string) => string;
    noneHeld: string;
    held: string;
    heldNote: string;
    noTypesBody: [string, string, string];
    setUp: string;
    type: string;
    heldBehaviour: string;
    appliedBehaviour: string;
    method: string;
    capturing: string;
    take: string;
    all: string;
    applying: string;
    use: string;
    refunding: string;
    refund: string;
  };
  closedSettled: (a: string) => string;
  noteLabel: string;
  decided: (date: string) => string;
  staysOn: string;
  receivablesList: string;
  closedOutstanding: (a: string) => string;
  closedOutstandingBody: string;
  untilResolved: string;
  otherOutstanding: (folio: string, n: number) => string;
  managerSettles: string;
  changeDecision: string;
  footnote: string;
  /**
   * Text the SYSTEM wrote into the data in English — the primary folio's label, a few fixed line
   * descriptions. Matched exactly and translated at display; anything a person typed is shown as
   * typed. Lines already stored keep their English in the database, which is correct: it is a record.
   */
  systemText: Record<string, string>;
}

export const folio: Translations<FolioStrings> = {
  en: {
    back: "Folios",
    title: (g) => `Folio — ${g}`,
    subtitle: (rooms, currency, closed, n) => `${rooms ? `Room ${rooms} · ` : ""}${currency}${closed ? " · closed" : ""}${n > 1 ? ` · ${n} folios` : ""}`,
    closed: "Closed",
    errors: {
      charge: "Enter a description and a positive amount.",
      payment: "Choose a method and a positive amount.",
      closed: "This folio is closed — no more postings.",
      voidaccom: "Accommodation lines can’t be voided (they come from the reservation).",
      balance: "Settle the balance first, or check out with an override below.",
      deposit: "Enter a positive amount (and, to capture, a deposit type).",
      extra: "Enter a name and a positive per-night price.",
      buyer: "Enter who the invoice is billed to.",
      invoice: "Couldn’t issue the invoice — is there a folio to bill?",
      gateway: "The card gateway declined the transaction — try again or use another method.",
      folioprimary: "The main folio is the stay’s bill — it can’t be removed, only closed.",
      folioclosed: "A closed folio is part of the financial record — correct it with a credit note.",
      foliolines: "Move this folio’s charges back to another folio first, then remove it.",
      departed: "This stay has already checked out. Reopen it to make changes.",
    },
    somethingWrong: "Something went wrong — try again.",
    outcome: { settled: "Settled", outstanding: "Outstanding", paid_offsystem: "Paid off-system", written_off: "Written off" },
    resolutions: {
      reopen: { label: "Reopen and take payment", detail: "Reopens the folio so a payment can be posted normally, then it closes at zero.", cta: "Reopen", notePlaceholder: "" },
      paid_offsystem: { label: "Mark as paid — settled off-system", detail: "The money arrived another way: bank transfer, cash, an external card terminal.", cta: "Mark paid", notePlaceholder: "Method and reference" },
      receivable: { label: "Keep as a receivable", detail: "Still owed and still being chased — billed to a company, invoice sent.", cta: "Keep chasing", notePlaceholder: "Who owes it, and by when" },
      written_off: { label: "Write off", detail: "The balance is forgiven. Recorded as a loss, never as a payment.", cta: "Write off", notePlaceholder: "Reason for the write-off" },
    },
    moveOptions: {
      comp: { label: "Complimentary", detail: "Given away. Nothing is posted, and it is recorded as a comp so it can be counted.", cta: "Comp it" },
      charge: { label: "Charge the difference", detail: "Post the extra to the folio — the guest pays for the better room.", cta: "Charge" },
      refund: { label: "Refund the difference", detail: "Money goes back to the guest for the lesser room.", cta: "Refund" },
      waive: { label: "Waive it", detail: "Nothing goes back. The owed amount is removed, and the decision is logged.", cta: "Waive" },
      custom: { label: "Set an amount", detail: "Any of the above at a figure you choose.", cta: "Apply" },
    },
    kinds: {
      accommodation: "Room", minibar: "Minibar", extra: "Extra", fee: "Fee", tax: "Tax", payment: "Payment",
      deposit_held: "Deposit held", deposit_use: "Deposit applied", deposit_refund: "Deposit refunded",
    },
    outlets: { room: "Room", minibar: "Minibar", extra: "Extra", spa: "Spa", bar: "Bar", restaurant: "Restaurant", other: "Other" },
    docs: { invoice: "Invoice", proforma: "Proforma", credit_note: "Credit note" },
    decisions: {
      settled: { headline: "Settled through the folio", meaning: "Paid in full, the ordinary way." },
      paid_offsystem: { headline: "Paid off-system", meaning: "The money arrived by bank transfer, cash or an external terminal. The folio still shows a balance because nothing was posted through it — that is deliberate, so the payment is never double-counted as revenue we processed." },
      outstanding: { headline: "Kept as a receivable", meaning: "Still owed and still being chased. It stays on the receivables list until that changes." },
      written_off: { headline: "Written off", meaning: "The balance is forgiven and recorded as a loss. It is never counted as a payment." },
    },
    move: {
      upgraded: "Upgraded to a different room type", downgraded: "Downgraded to a different room type", moved: "Moved to a different room type",
      booked: (b, s, r) => `Booked ${b}, staying in ${s} (room ${r}).`,
      pricedOver: (n, from) => `Priced over ${n} night${n === 1 ? "" : "s"}${from ? ` from ${from}` : ""} — nights already slept are not re-priced.`,
      noNights: "No nights left to re-price.",
      difference: "Difference",
      managerDecides: "A manager decides what happens to this amount.",
      amountCents: "Amount in cents",
      reasonOptional: "Reason (optional)",
      unchanged: (b) => `The booking itself is unchanged and nothing was sent to any channel — the guest still bought ${b}.`,
      landedLead: "Moved to a different room type.",
      landedBody: "The booking is unchanged — the guest still bought what they bought, and nothing was sent to any channel. If the new room prices differently, post the difference as a charge, or comp it. Either way it is recorded.",
    },
    managerOnly: "Manager approval required",
    removeSplit: "Remove this empty split folio",
    remove: "Remove",
    emptySplit: "Nothing on this folio yet — move charges across from the main one.",
    folioSuffix: " folio",
    void: "void",
    voidLine: "Void line",
    moveTo: "move…",
    go: "go",
    charges: (a) => `Charges ${a}`,
    payments: (a) => `Payments −${a}`,
    depositsHeldTitle: "A held deposit is a liability — outside charges and payments until applied or refunded",
    depositsHeld: (a) => `Deposits held ${a}`,
    balance: "Balance",
    across: (n) => `across ${n} folio${n === 1 ? "" : "s"}`,
    companyPlaceholder: "Company",
    opening: "Opening…",
    split: "Split",
    payment: {
      title: "Record a payment",
      methods: { cash: "Cash", card: "Card", company_account: "Company account", bank_transfer: "Bank transfer" },
      amount: (c) => `Amount (${c})`,
      reference: "Reference (optional)",
      recording: "Recording…",
      take: "Take",
      note: (g) => `Cash / company / bank are drawer entries. Card runs through the payment gateway (${g}) — only a token is stored, never a card number.`,
      gatewayTest: "Stripe test-mode",
      gatewayMock: "mock",
    },
    checkout: {
      title: "Check out",
      stillHeld: (a) => `${a} still held.`,
      stillHeldBody: "Use it against the balance or refund it before the guest leaves.",
      settled: "Balance settled",
      outstandingLead: "Outstanding balance of",
      outstandingTail: (n) => `across ${n} folio${n === 1 ? "" : "s"}. Settle it above, or check out with an override (logged).`,
      overridePlaceholder: "Override reason (e.g. bill to company)",
      withBalance: "Check out with balance",
      emailBill: "Email the guest their bill",
    },
    charge: {
      title: "Post a charge",
      state: "Minibar, an extra, a one-off fee",
      kinds: { minibar: "Minibar", extra: "Extra", fee: "Fee" },
      description: "Description",
      posting: "Posting…",
      add: "Add",
    },
    extras: {
      title: "Stay extras",
      none: "None on this stay",
      count: (n) => `${n} recurring per night`,
      note: "Recurring per night — posts at each night audit. Doesn’t change the booked rate plan; the folio reflects reality.",
      perNight: (a) => `${a} / night`,
      stopTitle: "Stop this extra (nights already accrued stay on the bill)",
      namePlaceholder: "e.g. Breakfast",
      pricePlaceholder: (c) => `Per night (${c})`,
      adding: "Adding…",
      add: "Add for the stay",
    },
    invoicing: {
      title: "Invoicing",
      none: "No invoice issued yet",
      issued: (n) => `${n} issued`,
      note: "Charges live on folios; an invoice renders them as a numbered tax document — gapless series, tax per rate, accommodation broken out.",
      document: "Document",
      folio: "Folio",
      billTo: "Bill to",
      buyerVat: "Buyer VAT ID",
      company: "(company)",
      issuing: "Issuing…",
      issue: "Issue",
    },
    deposits: {
      title: "Deposits",
      noTypes: "No deposit types set up",
      heldState: (a) => `${a} held — apply or refund before checkout`,
      noneHeld: "None held",
      held: "Held:",
      heldNote: "money held that may be returned — outside the balance until applied",
      noTypesBody: ["A deposit type decides whether the money is", "held", "as a liability or applied to the bill straight away — so one has to exist before a deposit can be taken."],
      setUp: "Set them up in Configuration",
      type: "Type",
      heldBehaviour: "held",
      appliedBehaviour: "applied",
      method: "Method",
      capturing: "Capturing…",
      take: "Take deposit",
      all: "all",
      applying: "Applying…",
      use: "Use deposit",
      refunding: "Refunding…",
      refund: "Refund",
    },
    closedSettled: (a) => `This folio is closed and settled. Final balance ${a}.`,
    noteLabel: "Note:",
    decided: (d) => `Decided ${d}.`,
    staysOn: "It stays on the",
    receivablesList: "receivables list",
    closedOutstanding: (a) => `Closed with ${a} outstanding.`,
    closedOutstandingBody: "The stay has ended and this money is still owed. It stays on the",
    untilResolved: "until it is resolved.",
    otherOutstanding: (f, n) => `These resolutions apply to ${f} — ${n} other folio${n === 1 ? " on this stay is" : "s on this stay are"} also outstanding and ${n === 1 ? "needs" : "need"} resolving separately.`,
    managerSettles: "A manager settles this. You can see what is owed and what the options are, but not choose one.",
    changeDecision: "Change this decision",
    footnote: "Money that arrived off-system and money that was written off both close the folio at zero, and are recorded separately — one is revenue collected, the other is revenue lost.",
    systemText: { Guest: "Guest", "City tax": "City tax", "Prepaid via OTA": "Prepaid via OTA", "Deposit applied to balance": "Deposit applied to balance", "Deposit refunded": "Deposit refunded" },
  },
  bg: {
    back: "Сметки",
    title: (g) => `Сметка — ${g}`,
    subtitle: (rooms, currency, closed, n) => `${rooms ? `Стая ${rooms} · ` : ""}${currency}${closed ? " · затворена" : ""}${n > 1 ? ` · ${n} сметки` : ""}`,
    closed: "Затворена",
    errors: {
      charge: "Въведете описание и положителна сума.",
      payment: "Изберете начин на плащане и положителна сума.",
      closed: "Сметката е затворена — не могат да се добавят записи.",
      voidaccom: "Нощувките не могат да се анулират — те идват от резервацията.",
      balance: "Първо уредете салдото или изпишете госта с изключение по-долу.",
      deposit: "Въведете положителна сума (а за приемане — и тип депозит).",
      extra: "Въведете име и положителна цена на нощувка.",
      buyer: "Въведете на кого се издава фактурата.",
      invoice: "Фактурата не беше издадена — има ли сметка за фактуриране?",
      gateway: "Картовата система отказа плащането — опитайте отново или изберете друг начин.",
      folioprimary: "Основната сметка е сметката на престоя — не може да се премахне, само да се затвори.",
      folioclosed: "Затворената сметка е част от счетоводния запис — коригира се с кредитно известие.",
      foliolines: "Първо преместете начисленията от тази сметка в друга, после я премахнете.",
      departed: "Този престой вече е приключил. Отворете го отново, за да правите промени.",
    },
    somethingWrong: "Нещо се обърка — опитайте отново.",
    outcome: { settled: "Уредена", outstanding: "Неплатена", paid_offsystem: "Платена извън системата", written_off: "Отписана" },
    resolutions: {
      reopen: { label: "Отвори отново и приеми плащане", detail: "Сметката се отваря, плащането се записва по обичайния начин и тя се затваря на нула.", cta: "Отвори", notePlaceholder: "" },
      paid_offsystem: { label: "Отбележи като платена — извън системата", detail: "Парите са дошли по друг начин: банков превод, в брой, външен ПОС терминал.", cta: "Платена", notePlaceholder: "Начин и основание" },
      receivable: { label: "Остави като вземане", detail: "Все още се дължи и се търси — към фирма, фактурата е изпратена.", cta: "Остави", notePlaceholder: "Кой дължи и до кога" },
      written_off: { label: "Отпиши", detail: "Сумата се опрощава. Записва се като загуба, никога като плащане.", cta: "Отпиши", notePlaceholder: "Причина за отписването" },
    },
    moveOptions: {
      comp: { label: "Безплатно", detail: "Подарява се. Нищо не се начислява и се записва като комплимент, за да може да се отчете.", cta: "Подари" },
      charge: { label: "Начисли разликата", detail: "Разликата се добавя към сметката — гостът плаща за по-добрата стая.", cta: "Начисли" },
      refund: { label: "Върни разликата", detail: "Парите се връщат на госта за по-скромната стая.", cta: "Върни" },
      waive: { label: "Опрости", detail: "Нищо не се връща. Дължимата сума се премахва и решението се записва.", cta: "Опрости" },
      custom: { label: "Въведи сума", detail: "Някое от горните, но на сума по Ваш избор.", cta: "Приложи" },
    },
    kinds: {
      accommodation: "Нощувка", minibar: "Минибар", extra: "Допълнително", fee: "Такса", tax: "Данък", payment: "Плащане",
      deposit_held: "Задържан депозит", deposit_use: "Приспаднат депозит", deposit_refund: "Върнат депозит",
    },
    outlets: { room: "Стая", minibar: "Минибар", extra: "Допълнително", spa: "СПА", bar: "Бар", restaurant: "Ресторант", other: "Друго" },
    docs: { invoice: "Фактура", proforma: "Проформа", credit_note: "Кредитно известие" },
    decisions: {
      settled: { headline: "Уредена чрез сметката", meaning: "Платена изцяло, по обичайния начин." },
      paid_offsystem: { headline: "Платена извън системата", meaning: "Парите са дошли по банков път, в брой или през външен терминал. Сметката още показва салдо, защото нищо не е минало през нея — това е нарочно, за да не се отчете плащането два пъти като приход." },
      outstanding: { headline: "Оставена като вземане", meaning: "Все още се дължи и се търси. Остава в списъка с вземания, докато това се промени." },
      written_off: { headline: "Отписана", meaning: "Сумата е опростена и записана като загуба. Никога не се отчита като плащане." },
    },
    move: {
      upgraded: "Преместен в по-добър тип стая", downgraded: "Преместен в по-скромен тип стая", moved: "Преместен в друг тип стая",
      booked: (b, s, r) => `Резервирал ${b}, настанен в ${s} (стая ${r}).`,
      pricedOver: (n, from) => `Изчислено за ${n} ${n === 1 ? "нощувка" : "нощувки"}${from ? ` от ${from}` : ""} — изминалите нощувки не се преизчисляват.`,
      noNights: "Не остават нощувки за преизчисляване.",
      difference: "Разлика",
      managerDecides: "Управител решава какво става с тази сума.",
      amountCents: "Сума в стотинки",
      reasonOptional: "Причина (по желание)",
      unchanged: (b) => `Самата резервация не е променена и нищо не е изпратено към каналите — гостът е купил ${b}.`,
      landedLead: "Преместен в друг тип стая.",
      landedBody: "Резервацията не е променена — гостът е купил това, което е купил, и нищо не е изпратено към каналите. Ако новата стая е с друга цена, начислете разликата или я подарете. И в двата случая се записва.",
    },
    managerOnly: "Нужно е одобрение от управител",
    removeSplit: "Премахни тази празна допълнителна сметка",
    remove: "Премахни",
    emptySplit: "В тази сметка още няма нищо — преместете начисления от основната.",
    folioSuffix: " (сметка)",
    void: "анулирано",
    voidLine: "Анулирай реда",
    moveTo: "премести…",
    go: "ок",
    charges: (a) => `Начисления ${a}`,
    payments: (a) => `Плащания −${a}`,
    depositsHeldTitle: "Задържаният депозит е задължение — не е нито начисление, нито плащане, докато не бъде приспаднат или върнат",
    depositsHeld: (a) => `Задържани депозити ${a}`,
    balance: "Салдо",
    across: (n) => `по ${n} ${n === 1 ? "сметка" : "сметки"}`,
    companyPlaceholder: "Фирма",
    opening: "Отваряне…",
    split: "Раздели",
    payment: {
      title: "Приемане на плащане",
      methods: { cash: "В брой", card: "Карта", company_account: "Фирмена сметка", bank_transfer: "Банков превод" },
      amount: (c) => `Сума (${c})`,
      reference: "Основание (по желание)",
      recording: "Записване…",
      take: "Приеми",
      note: (g) => `В брой, фирмена сметка и банков превод са записи в касата. Картата минава през платежната система (${g}) — пази се само токен, никога номерът на картата.`,
      gatewayTest: "Stripe тестов режим",
      gatewayMock: "симулация",
    },
    checkout: {
      title: "Напускане",
      stillHeld: (a) => `${a} все още са задържани.`,
      stillHeldBody: "Приспаднете ги от салдото или ги върнете, преди гостът да си тръгне.",
      settled: "Салдото е уредено",
      outstandingLead: "Неплатено салдо",
      outstandingTail: (n) => `по ${n} ${n === 1 ? "сметка" : "сметки"}. Уредете го по-горе или изпишете госта с изключение (записва се).`,
      overridePlaceholder: "Причина за изключението (напр. фактура към фирма)",
      withBalance: "Напускане с неплатено салдо",
      emailBill: "Изпрати сметката на госта по имейл",
    },
    charge: {
      title: "Начисляване",
      state: "Минибар, допълнителна услуга, еднократна такса",
      kinds: { minibar: "Минибар", extra: "Допълнително", fee: "Такса" },
      description: "Описание",
      posting: "Начисляване…",
      add: "Добави",
    },
    extras: {
      title: "Допълнителни услуги за престоя",
      none: "Няма за този престой",
      count: (n) => `${n} на нощувка`,
      note: "Начисляват се всяка нощ при затварянето на деня. Не променят резервирания ценови план — сметката отразява реалността.",
      perNight: (a) => `${a} / нощувка`,
      stopTitle: "Спри тази услуга (вече начислените нощувки остават в сметката)",
      namePlaceholder: "напр. Закуска",
      pricePlaceholder: (c) => `На нощувка (${c})`,
      adding: "Добавяне…",
      add: "Добави за престоя",
    },
    invoicing: {
      title: "Фактуриране",
      none: "Още няма издадена фактура",
      issued: (n) => `${n} ${n === 1 ? "издадена" : "издадени"}`,
      note: "Начисленията са в сметките; фактурата ги превръща в номериран данъчен документ — поредна номерация без пропуски, данък по ставки, нощувките отделно.",
      document: "Документ",
      folio: "Сметка",
      billTo: "Получател",
      buyerVat: "ДДС номер на получателя",
      company: "(за фирма)",
      issuing: "Издаване…",
      issue: "Издай",
    },
    deposits: {
      title: "Депозити",
      noTypes: "Няма настроени типове депозити",
      heldState: (a) => `${a} задържани — приспаднете или върнете преди напускане`,
      noneHeld: "Няма задържани",
      held: "Задържани:",
      heldNote: "пари, които може да бъдат върнати — извън салдото, докато не бъдат приспаднати",
      noTypesBody: ["Типът депозит определя дали парите се", "задържат", "като задължение или се приспадат от сметката веднага — затова трябва да има поне един, преди да се приеме депозит."],
      setUp: "Настройте ги в Конфигурация",
      type: "Тип",
      heldBehaviour: "задържан",
      appliedBehaviour: "приспаднат",
      method: "Начин",
      capturing: "Приемане…",
      take: "Приеми депозит",
      all: "всичко",
      applying: "Приспадане…",
      use: "Приспадни депозита",
      refunding: "Връщане…",
      refund: "Върни",
    },
    closedSettled: (a) => `Сметката е затворена и уредена. Крайно салдо ${a}.`,
    noteLabel: "Бележка:",
    decided: (d) => `Решено на ${d}.`,
    staysOn: "Остава в",
    receivablesList: "списъка с вземания",
    closedOutstanding: (a) => `Затворена с неплатени ${a}.`,
    closedOutstandingBody: "Престоят е приключил, а тази сума още се дължи. Остава в",
    untilResolved: "докато не бъде уредена.",
    otherOutstanding: (f, n) => `Тези действия се отнасят за „${f}“ — още ${n} ${n === 1 ? "сметка по този престой е неплатена и трябва" : "сметки по този престой са неплатени и трябва"} да се уредят отделно.`,
    managerSettles: "Това се урежда от управител. Виждате какво се дължи и какви са възможностите, но не можете да изберете.",
    changeDecision: "Промени решението",
    footnote: "Платеното извън системата и отписаното затварят сметката на нула, но се записват отделно — едното е събран приход, другото е загубен.",
    systemText: { Guest: "Гост", "City tax": "Туристически данък", "Prepaid via OTA": "Предплатено чрез OTA", "Deposit applied to balance": "Депозит, приспаднат от салдото", "Deposit refunded": "Върнат депозит" },
  },
};
