import { fill, translate, type Locale, type Translations } from "./i18n";

type StepText = { title: string; doneTitle?: string; lead: string };

/**
 * First-run setup, shared by the three staff products — the frame, the field groups, and each step's
 * heading. **Strings only**: the field groups are client components.
 *
 * The step headings are written in English in `@revio/core` (`welcomeFlow`), which decides WHICH
 * steps a hotel sees; this says them. Keyed by step, never by the English sentence.
 */
export interface WelcomeStrings {
  shell: {
    setup: string;
    /** "{n} of {total}" */
    stepOf: string;
    /** "Step {n} of {total}" */
    stepAria: string;
    back: string;
    later: string;
    laterNote: string;
    /** "Already set up — shared with {products}." */
    sharedWith: string;
    and: string;
    saving: string;
    continue: string;
    saveAndContinue: string;
  };
  steps: {
    property: StepText;
    rooms: StepText;
    units: StepText;
    prices: StepText;
    taxes: StepText;
    brand: StepText;
    delivery: StepText;
    team: StepText;
    /** RevioLink's last step — rooms go on sale. */
    goliveLink: StepText;
    golive: StepText;
    /** "{product} runs on the same records…" */
    shared: StepText;
  };
  property: {
    yourHotel: string;
    name: string;
    address: string;
    addressPlaceholder: string;
    addressHint: string;
    email: string;
    emailPlaceholder: string;
    emailHint: string;
    phone: string;
    phonePlaceholder: string;
    operate: string;
    currency: string;
    currencies: Record<"EUR" | "USD" | "GBP" | "RON", string>;
    timezone: string;
    checkIn: string;
    checkOut: string;
  };
  tax: {
    vat: string;
    vatNote: string;
    standard: string;
    standardHint: string;
    accommodation: string;
    accommodationHint: string;
    cityTax: string;
    cityTaxNote: string;
    /** "Amount ({currency})" */
    amount: string;
    cityTaxPlaceholder: string;
    issuer: string;
    issuerNote: string;
    company: string;
    companyPlaceholder: string;
    vatNumber: string;
    registeredAddress: string;
    registeredAddressPlaceholder: string;
  };
  brand: {
    sender: string;
    senderHint: string;
    colour: string;
    colourAria: string;
    logo: string;
    logoHint: string;
    preview: string;
    dear: string;
    viewBooking: string;
    sameColour: string;
  };
  /** Keyed by `WelcomeWriteCode` from `@revio/db`. `price_no_plan` takes "{screen}". */
  errors: Record<
    "property_name" | "contact_email" | "roomtype_name" | "roomtype_count" | "roomtype_guests"
    | "price_amount" | "price_no_roomtype" | "price_no_plan" | "price_exists" | "vat_range" | "city_tax",
    string
  >;
}

export const welcomeStrings: Translations<WelcomeStrings> = {
  en: {
    shell: {
      setup: "setup",
      stepOf: "{n} of {total}",
      stepAria: "Step {n} of {total}",
      back: "Back",
      later: "I’ll do this later",
      laterNote: "— it stays on your checklist.",
      sharedWith: "Already set up — shared with {products}.",
      and: "and",
      saving: "Saving…",
      continue: "Continue",
      saveAndContinue: "Save and continue",
    },
    steps: {
      property: { title: "Your property", doneTitle: "Your property details", lead: "Name, address and contact details. These appear on the confirmations your guests receive." },
      rooms: { title: "What do you sell?", doneTitle: "Your room types", lead: "Your room types and how many of each. Everything else is built on this." },
      units: { title: "Your actual rooms", lead: "Room 101, 102, 201 — the doors housekeeping cleans and guests sleep behind." },
      prices: { title: "Set a starting price", doneTitle: "Your prices", lead: "One price to begin with — you can vary it by date once you are trading." },
      taxes: { title: "Tax and invoicing", doneTitle: "Your tax and invoicing setup", lead: "Your VAT rates and the legal details that must appear on every invoice you issue." },
      brand: { title: "How you look to guests", doneTitle: "Your logo and colour", lead: "Your logo and colour. Used on every email you send, and on your own booking page." },
      delivery: { title: "Where your bookings go", lead: "Channel bookings are emailed here the moment they arrive." },
      team: { title: "Add your team", doneTitle: "Your team's logins", lead: "Everyone gets their own login. Nobody shares a password." },
      goliveLink: { title: "Put your rooms on sale", lead: "Connect a channel and start sending availability. Nothing has left Revio until you do." },
      golive: { title: "You're ready", lead: "Everything is in place. Here is what we set up for you." },
      shared: { title: "Most of this is already done", lead: "{product} runs on the same records as the products you already use. Nothing here was copied — it is the same data, so it can never drift apart." },
    },
    property: {
      yourHotel: "Your hotel",
      name: "Property name",
      address: "Address",
      addressPlaceholder: "ul. Vitosha 12, Sofia 1000, Bulgaria",
      addressHint: "Shown on booking confirmations.",
      email: "Contact email",
      emailPlaceholder: "reception@yourhotel.com",
      emailHint: "Where guests reply.",
      phone: "Phone",
      phonePlaceholder: "+359 2 000 0000",
      operate: "How you operate",
      currency: "Currency",
      currencies: { EUR: "EUR — Euro", USD: "USD — US dollar", GBP: "GBP — Pound sterling", RON: "RON — Romanian leu" },
      timezone: "Time zone",
      checkIn: "Check-in from",
      checkOut: "Check-out by",
    },
    tax: {
      vat: "VAT",
      vatNote: "Bulgarian defaults shown — change them if your rates differ.",
      standard: "Standard rate (%)",
      standardHint: "Extras, minibar, restaurant.",
      accommodation: "Accommodation rate (%)",
      accommodationHint: "The reduced rate on the room itself.",
      cityTax: "City tax",
      cityTaxNote: "Charged per person per night. Leave empty if your city has none.",
      amount: "Amount ({currency})",
      cityTaxPlaceholder: "1.50",
      issuer: "Who issues the invoice",
      issuerNote: "The legal details printed on every invoice. Usually your company, not the hotel's trading name.",
      company: "Company name",
      companyPlaceholder: "Hotel Sofia EOOD",
      vatNumber: "VAT number",
      registeredAddress: "Registered address",
      registeredAddressPlaceholder: "ul. Vitosha 12, Sofia 1000",
    },
    brand: {
      sender: "Sender name",
      senderHint: "Who guest emails appear to come from.",
      colour: "Your colour",
      colourAria: "Brand colour",
      logo: "Logo link (optional)",
      logoHint: "You can upload one later in Settings — a link is quicker if you already have it online.",
      preview: "Preview",
      dear: "Dear Elena, your booking is confirmed.",
      viewBooking: "View your booking",
      sameColour: "The same colour is used on your own booking page unless you change it there.",
    },
    errors: {
      property_name: "Your property needs a name.",
      contact_email: "That contact email doesn't look right.",
      roomtype_name: "Give the room type a name — “Double Room” is fine.",
      roomtype_count: "How many of these rooms do you have?",
      roomtype_guests: "How many guests fit in one?",
      price_amount: "Enter a nightly price.",
      price_no_roomtype: "Add a room type first — a price belongs to a room.",
      price_no_plan: "There is no active rate plan to price. Add one in {screen}, then come back — a price has to live on a plan.",
      price_exists: "Those dates already have prices, so nothing was changed. Edit them on the calendar or in Bulk update.",
      vat_range: "VAT must be between 0 and 100.",
      city_tax: "City tax must be a number, or left empty.",
    },
  },
  bg: {
    shell: {
      setup: "настройка",
      stepOf: "{n} от {total}",
      stepAria: "Стъпка {n} от {total}",
      back: "Назад",
      later: "Ще го направя по-късно",
      laterNote: "— остава в списъка Ви със задачи.",
      sharedWith: "Вече е настроено — общо с {products}.",
      and: "и",
      saving: "Запазване…",
      continue: "Продължи",
      saveAndContinue: "Запази и продължи",
    },
    steps: {
      property: { title: "Вашият обект", doneTitle: "Данните на обекта", lead: "Име, адрес и данни за контакт. Те се показват в потвържденията, които получават гостите Ви." },
      rooms: { title: "Какво продавате?", doneTitle: "Вашите типове стаи", lead: "Типовете стаи и колко от всеки имате. Всичко останало се гради върху това." },
      units: { title: "Физическите стаи", lead: "Стая 101, 102, 201 — вратите, които хаускийпингът почиства и зад които спят гостите." },
      prices: { title: "Начална цена", doneTitle: "Вашите цени", lead: "Една цена за начало — ще можете да я променяте по дати, щом започнете да продавате." },
      taxes: { title: "Данъци и фактуриране", doneTitle: "Данъци и фактуриране", lead: "Ставките на ДДС и юридическите данни, които трябва да има на всяка издадена фактура." },
      brand: { title: "Как Ви виждат гостите", doneTitle: "Лого и цвят", lead: "Вашето лого и цвят. Използват се във всеки имейл и на собствената Ви страница за директни резервации." },
      delivery: { title: "Къде отиват резервациите", lead: "Резервациите от каналите се изпращат на този имейл в момента, в който пристигнат." },
      team: { title: "Добавете екипа си", doneTitle: "Профилите на екипа", lead: "Всеки има собствен вход. Никой не споделя парола." },
      goliveLink: { title: "Пуснете стаите в продажба", lead: "Свържете канал и започнете да изпращате наличност. Нищо не е излязло от Revio, докато не го направите." },
      golive: { title: "Готови сте", lead: "Всичко е на мястото си. Ето какво настроихме за Вас." },
      shared: { title: "Повечето вече е готово", lead: "{product} работи върху същите записи като продуктите, които вече ползвате. Нищо не е копирано — това са същите данни, затова никога не могат да се разминат." },
    },
    property: {
      yourHotel: "Вашият хотел",
      name: "Име на обекта",
      address: "Адрес",
      addressPlaceholder: "ул. Витоша 12, София 1000",
      addressHint: "Показва се в потвържденията на резервациите.",
      email: "Имейл за контакт",
      emailPlaceholder: "reception@vashiathotel.bg",
      emailHint: "Където гостите отговарят.",
      phone: "Телефон",
      phonePlaceholder: "+359 2 000 0000",
      operate: "Как работите",
      currency: "Валута",
      currencies: { EUR: "EUR — евро", USD: "USD — щатски долар", GBP: "GBP — британски паунд", RON: "RON — румънска лея" },
      timezone: "Часова зона",
      checkIn: "Настаняване от",
      checkOut: "Напускане до",
    },
    tax: {
      vat: "ДДС",
      vatNote: "Показани са българските ставки по подразбиране — променете ги, ако Вашите са различни.",
      standard: "Основна ставка (%)",
      standardHint: "Екстри, минибар, ресторант.",
      accommodation: "Ставка за настаняване (%)",
      accommodationHint: "Намалената ставка за самата нощувка.",
      cityTax: "Туристически данък",
      cityTaxNote: "Начислява се на човек на нощувка. Оставете празно, ако в общината Ви няма такъв.",
      amount: "Сума ({currency})",
      cityTaxPlaceholder: "1,50",
      issuer: "Кой издава фактурата",
      issuerNote: "Юридическите данни върху всяка фактура. Обикновено това е фирмата Ви, а не търговското име на хотела.",
      company: "Име на фирмата",
      companyPlaceholder: "Хотел София ЕООД",
      vatNumber: "ДДС номер",
      registeredAddress: "Адрес на регистрация",
      registeredAddressPlaceholder: "ул. Витоша 12, София 1000",
    },
    brand: {
      sender: "Име на подателя",
      senderHint: "От чие име изглеждат имейлите до гостите.",
      colour: "Вашият цвят",
      colourAria: "Цвят на марката",
      logo: "Връзка към лого (по желание)",
      logoHint: "Можете да качите лого по-късно в Настройки — връзката е по-бърза, ако вече го имате онлайн.",
      preview: "Преглед",
      dear: "Здравейте, Елена, резервацията Ви е потвърдена.",
      viewBooking: "Вижте резервацията си",
      sameColour: "Същият цвят се използва и на страницата Ви за директни резервации, освен ако не го смените там.",
    },
    errors: {
      property_name: "Обектът трябва да има име.",
      contact_email: "Имейлът за контакт не изглежда правилен.",
      roomtype_name: "Дайте име на типа стая — „Двойна стая“ е напълно достатъчно.",
      roomtype_count: "Колко стаи от този тип имате?",
      roomtype_guests: "Колко гости се побират в една?",
      price_amount: "Въведете цена за нощувка.",
      price_no_roomtype: "Първо добавете тип стая — цената принадлежи на стая.",
      price_no_plan: "Няма активен ценови план за цената. Добавете такъв в {screen} и се върнете — цената трябва да е в ценови план.",
      price_exists: "За тези дати вече има цени, затова нищо не е променено. Редактирайте ги в календара или с масовата промяна.",
      vat_range: "ДДС трябва да е между 0 и 100.",
      city_tax: "Туристическият данък трябва да е число или да остане празен.",
    },
  },
};

/**
 * A step's heading in the reader's language — the flow still comes from `welcomeFlow` in core; this
 * only says it. The English is core's own text, so an unknown key falls back to what core wrote.
 */
export function welcomeStepText(
  key: string,
  product: string,
  locale: Locale,
  fallback: { title: string; lead: string },
): { title: string; doneTitle: string; lead: string } {
  const steps = translate(welcomeStrings, locale).steps as Record<string, StepText>;
  const k = key === "golive" && product === "RevioLink" ? "goliveLink" : key;
  const s = steps[k];
  if (!s) return { title: fallback.title, doneTitle: fallback.title, lead: fallback.lead };
  return { title: s.title, doneTitle: s.doneTitle ?? s.title, lead: fill(s.lead, { product }) };
}
