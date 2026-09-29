import type { Translations } from "@revio/ui/i18n";
import type { StayTermsProblem } from "@revio/core";

/**
 * Payment & cancellation terms — what a guest pays, when, and what cancelling costs.
 *
 * The sentences a GUEST reads are not here: they live beside the arithmetic in `@revio/core`
 * (`stayTermsWords`) so the preview on this screen and the booking page print the same words.
 */
export interface TermsStrings {
  nav: string;
  navBlurb: string;
  title: string;
  subtitle: string;
  add: string;
  empty: string;
  emptyHint: string;
  back: string;
  newTitle: string;
  usedBy: (n: number) => string;
  unused: string;
  edit: string;
  name: string;
  namePlaceholder: string;
  code: string;
  paymentTitle: string;
  payment: Record<"guarantee" | "deposit" | "prepay", { label: string; hint: string }>;
  depositKind: Record<"percent" | "first_night" | "fixed", string>;
  depositPercent: string;
  depositFixed: string;
  balanceTitle: string;
  balanceAtHotel: string;
  balanceCharge: string;
  balanceDays: string;
  cancelTitle: string;
  refundable: string;
  nonRefundable: string;
  nonRefundableHint: string;
  freeDays: string;
  freeDaysHint: string;
  lateFee: string;
  noShowFee: string;
  fee: Record<"first_night" | "full" | "percent", string>;
  feePercent: string;
  previewTitle: string;
  previewHint: string;
  problems: Record<StayTermsProblem, string>;
  nameRequired: string;
  codeTaken: (code: string) => string;
  deleteText: string;
  deleteNote: string;
  planTab: string;
  planTitle: string;
  planSubtitle: string;
  planNone: string;
  planNoneHint: string;
  manage: string;
  notLive: string;
}

export const terms: Translations<TermsStrings> = {
  en: {
    nav: "Payment & cancellation",
    navBlurb: "What a guest pays, when, and what cancelling costs",
    title: "Payment & cancellation terms",
    subtitle: "Each rate plan uses one of these. Your booking page shows them next to every price, and charges by them.",
    add: "New terms",
    empty: "No terms yet.",
    emptyHint: "Until a rate plan has terms, your booking page only takes a card as a guarantee and states no cancellation rules.",
    back: "All terms",
    newTitle: "New terms",
    usedBy: (n) => (n === 1 ? "Used by 1 rate plan" : `Used by ${n} rate plans`),
    unused: "Not used by any rate plan",
    edit: "Edit",
    name: "Name",
    namePlaceholder: "e.g. Flexible — free cancellation 3 days",
    code: "Code",
    paymentTitle: "When the guest pays",
    payment: {
      guarantee: { label: "Card guarantee", hint: "Nothing is charged at booking. The card secures the room." },
      deposit: { label: "Deposit", hint: "Part is charged at booking, the rest later." },
      prepay: { label: "Pay in full", hint: "The whole stay is charged at booking." },
    },
    depositKind: { percent: "A percentage", first_night: "The first night", fixed: "A fixed amount" },
    depositPercent: "Percentage of the stay",
    depositFixed: "Amount",
    balanceTitle: "The rest",
    balanceAtHotel: "Paid at the hotel",
    balanceCharge: "Charged automatically before arrival",
    balanceDays: "Days before arrival",
    cancelTitle: "Cancellation",
    refundable: "Free cancellation for a period",
    nonRefundable: "Non-refundable",
    nonRefundableHint: "Cancelling or changing at any time costs the whole stay.",
    freeDays: "Free until how many days before arrival",
    freeDaysHint: "0 = until the arrival day",
    lateFee: "After that, cancelling costs",
    noShowFee: "If the guest does not arrive",
    fee: { first_night: "The first night", full: "The whole stay", percent: "A percentage of the stay" },
    feePercent: "Percentage",
    previewTitle: "What a guest reads",
    previewHint: "An example: 3 nights at 100 per night, arriving in 30 days.",
    problems: {
      deposit_value_missing: "Enter the deposit amount.",
      deposit_percent_range: "A percentage is between 1 and 100.",
      late_fee_percent_range: "The cancellation percentage is between 1 and 100.",
      no_show_percent_range: "The no-show percentage is between 1 and 100.",
      free_cancel_days_range: "Days before arrival is between 0 and 365.",
      balance_days_range: "Days before arrival is between 0 and 365.",
      prepay_with_balance: "Paying in full leaves nothing to charge later.",
    },
    nameRequired: "Give the terms a name.",
    codeTaken: (c) => `Another set of terms already uses the code ${c}.`,
    deleteText: "Delete these terms. Rate plans that use them go back to a card guarantee with no stated terms.",
    deleteNote: "Rate plans using these terms will have none.",
    planTab: "Payment & cancellation",
    planTitle: "Payment & cancellation",
    planSubtitle: "The terms this rate is sold on — shown next to its price on your booking page.",
    planNone: "No terms",
    planNoneHint: "Card guarantee only, no stated cancellation rules.",
    manage: "Manage terms",
    notLive: "Online payment on your booking page is not switched on yet. Until it is, the page takes a card only as a guarantee and says the stay is paid at the hotel — your cancellation terms already apply.",
  },
  bg: {
    nav: "Плащане и анулиране",
    navBlurb: "Какво плаща гостът, кога и колко струва анулирането",
    title: "Условия за плащане и анулиране",
    subtitle: "Всеки ценови план използва едни от тях. Страницата Ви за резервации ги показва до всяка цена и таксува по тях.",
    add: "Нови условия",
    empty: "Все още няма условия.",
    emptyHint: "Докато ценовият план няма условия, страницата за резервации само взема карта като гаранция и не посочва правила за анулиране.",
    back: "Всички условия",
    newTitle: "Нови условия",
    usedBy: (n) => (n === 1 ? "Използват се от 1 ценови план" : `Използват се от ${n} ценови плана`),
    unused: "Не се използват от ценови план",
    edit: "Редакция",
    name: "Име",
    namePlaceholder: "напр. Гъвкава — безплатно анулиране 3 дни",
    code: "Код",
    paymentTitle: "Кога плаща гостът",
    payment: {
      guarantee: { label: "Гаранция с карта", hint: "При резервация не се таксува нищо. Картата гарантира стаята." },
      deposit: { label: "Депозит", hint: "Част се таксува при резервация, останалото — по-късно." },
      prepay: { label: "Пълно предплащане", hint: "Целият престой се таксува при резервация." },
    },
    depositKind: { percent: "Процент", first_night: "Първата нощувка", fixed: "Фиксирана сума" },
    depositPercent: "Процент от престоя",
    depositFixed: "Сума",
    balanceTitle: "Останалото",
    balanceAtHotel: "Плаща се в хотела",
    balanceCharge: "Удържа се автоматично преди пристигане",
    balanceDays: "Дни преди пристигане",
    cancelTitle: "Анулиране",
    refundable: "Безплатно анулиране за определен период",
    nonRefundable: "Без възстановяване",
    nonRefundableHint: "Анулиране или промяна по всяко време струва целия престой.",
    freeDays: "Безплатно до колко дни преди пристигане",
    freeDaysHint: "0 = до деня на пристигане",
    lateFee: "След това анулирането струва",
    noShowFee: "Ако гостът не се яви",
    fee: { first_night: "Първата нощувка", full: "Целия престой", percent: "Процент от престоя" },
    feePercent: "Процент",
    previewTitle: "Какво чете гостът",
    previewHint: "Пример: 3 нощувки по 100 на нощ, пристигане след 30 дни.",
    problems: {
      deposit_value_missing: "Въведете размера на депозита.",
      deposit_percent_range: "Процентът е между 1 и 100.",
      late_fee_percent_range: "Процентът за анулиране е между 1 и 100.",
      no_show_percent_range: "Процентът при неявяване е между 1 и 100.",
      free_cancel_days_range: "Дните преди пристигане са между 0 и 365.",
      balance_days_range: "Дните преди пристигане са между 0 и 365.",
      prepay_with_balance: "При пълно предплащане няма какво да се удържа по-късно.",
    },
    nameRequired: "Дайте име на условията.",
    codeTaken: (c) => `Други условия вече използват кода ${c}.`,
    deleteText: "Изтриване на условията. Ценовите планове, които ги използват, се връщат към гаранция с карта без посочени условия.",
    deleteNote: "Ценовите планове с тези условия ще останат без условия.",
    planTab: "Плащане и анулиране",
    planTitle: "Плащане и анулиране",
    planSubtitle: "Условията, при които се продава този план — показват се до цената му на страницата за резервации.",
    planNone: "Без условия",
    planNoneHint: "Само гаранция с карта, без посочени правила за анулиране.",
    manage: "Управление на условията",
    notLive: "Онлайн плащането на страницата Ви за резервации още не е включено. Дотогава страницата взема карта само като гаранция и посочва, че престоят се плаща в хотела — условията Ви за анулиране вече важат.",
  },
};
