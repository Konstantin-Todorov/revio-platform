import type { Translations } from "./i18n";

/**
 * The Guest emails screen, its editor and its logo upload — one set of words for RevioLink,
 * RevioCRS and RevioPMS, which all show the same screen over the same rows.
 *
 * **Strings only**, `{name}` placeholders: the editor and the upload are client components.
 * `templates` is keyed by the template key in `@revio/core`; its English `label` is held to core's
 * by `apps/pms/lib/i18n/product-drift.test.ts`.
 */
export interface GuestEmailsStrings {
  title: string;
  subtitle: string;
  language: {
    title: string;
    /** Shown before the choice: what the setting decides. */
    body: string;
    saved: string;
  };
  tabs: { emails: string; look: string };
  stages: Record<"booking" | "before" | "after" | "waitlist", string>;
  status: { always: string; on: string; off: string; notYet: string; notYetHint: string; yours: string; ours: string };
  templates: Record<string, { label: string; when: string }>;
  team: string;
  teamLink: string;
  look: {
    sender: string;
    senderHint: string;
    senderName: string;
    replyTo: string;
    colour: string;
    footer: string;
    footerPlaceholder: string;
    design: string;
    designHint: string;
    typeface: string;
    save: string;
    logo: string;
    preview: string;
    previewHint: string;
    from: string;
    replyToShort: string;
  };
  themes: Record<string, { label: string; blurb: string }>;
  fonts: Record<string, string>;
  editor: {
    back: string;
    reset: string;
    save: string;
    saving: string;
    saved: string;
    unsaved: string;
    leaveConfirm: string;
    /** "{language}" */
    oursNote: string;
    send: string;
    sendHint: string;
    always: string;
    subject: string;
    message: string;
    insert: string;
    insertHint: string;
    /** "{value}" */
    example: string;
    preview: string;
    defaultBadge: string;
    /** "{language}" */
    yoursTitle: string;
    oursTitle: string;
    notYet: string;
  };
  logo: {
    none: string;
    upload: string;
    uploading: string;
    remove: string;
    hint: string;
    /** "{kb}" */
    tooBig: string;
    notImage: string;
    pick: string;
    alt: string;
  };
}

export const guestEmailsStrings: Translations<GuestEmailsStrings> = {
  en: {
    title: "Guest emails",
    subtitle: "What your guests receive from you — in your words, your language and your branding.",
    language: {
      title: "Your guests receive emails in",
      body: "Every email below goes out in this language. Change it and the next email a guest receives is in the new one.",
      saved: "Saved",
    },
    tabs: { emails: "Emails", look: "Look & sender" },
    stages: { booking: "When they book", before: "Before they arrive", after: "After the stay", waitlist: "Waiting list" },
    status: {
      always: "Sent automatically",
      on: "On",
      off: "Off",
      notYet: "Not sent yet",
      notYetHint: "You can write it now; nothing sends it yet.",
      yours: "your wording",
      ours: "our wording",
    },
    templates: {
      booking_confirmation: { label: "Booking confirmation", when: "When a booking is made on your booking page, or confirmed in RevioCRS" },
      booking_modified: { label: "Booking changed", when: "When the dates, room or price of a booking change in RevioCRS" },
      booking_cancelled: { label: "Booking cancelled", when: "When a booking is cancelled in RevioCRS" },
      pre_arrival: { label: "Before arrival", when: "A few days before check-in" },
      folio_receipt: { label: "Bill / receipt", when: "At check-out in RevioPMS, with the itemised bill" },
      post_stay: { label: "After departure", when: "After check-out" },
      waitlist_joined: { label: "Waitlist — joined", when: "When a guest joins the waiting list on your booking page" },
      waitlist_offer: { label: "Waitlist — a room opened", when: "When a room frees up for a guest on the waiting list" },
      waitlist_expired: { label: "Waitlist — the held room was released", when: "When a guest did not take up the room in time" },
    },
    team: "Emails to your own team — new bookings and the daily arrivals list — are set up separately.",
    teamLink: "Bookings & email →",
    look: {
      sender: "Sender and footer",
      senderHint: "The guest sees your name and replies reach you. The sending address stays ours, so your mail lands in the inbox rather than spam.",
      senderName: "Sender name",
      replyTo: "Reply-to address",
      colour: "Brand colour",
      footer: "Footer (address / legal line)",
      footerPlaceholder: "1 Vitosha Blvd, Sofia · +359 2 000 0000",
      design: "Design",
      designHint: "Four genuinely different layouts — pick by eye.",
      typeface: "Typeface",
      save: "Save look & sender",
      logo: "Logo",
      preview: "Preview",
      previewHint: "Your booking confirmation, exactly as a guest receives it",
      from: "From:",
      replyToShort: "Reply-to:",
    },
    themes: {
      classic: { label: "Classic", blurb: "Serif masthead, hairline rules, centred. Traditional luxury." },
      modern: { label: "Modern", blurb: "Solid colour banner, bold left-aligned type, tinted detail block." },
      minimal: { label: "Minimal", blurb: "No frame, no rules. Wide margins and quiet type." },
      boutique: { label: "Boutique", blurb: "Letter-spaced small caps, framed panel, editorial feel." },
    },
    fonts: { serif: "Serif", sans: "Sans", mixed: "Serif headings, sans body" },
    editor: {
      back: "All guest emails",
      reset: "Reset",
      save: "Save changes",
      saving: "Saving…",
      saved: "Saved",
      unsaved: "Unsaved changes",
      leaveConfirm: "You have unsaved changes. Leave them and switch language?",
      oursNote: "This is our {language} wording — it sends as it is. Edit and save to make it yours; Reset brings ours back.",
      send: "Send this email",
      sendHint: "Switch off and your guests never receive it. Everything else stays as you left it.",
      always: "Cannot be switched off — a guest must have this in writing.",
      subject: "Subject",
      message: "Message",
      insert: "Click to insert",
      insertHint: "These are filled in for each guest when the email is sent. The preview shows example values.",
      example: "Example: {value}",
      preview: "Live preview — as the guest receives it",
      defaultBadge: "guests get this",
      yoursTitle: "{language} — your own wording",
      oursTitle: "{language} — our wording, not yet edited",
      notYet: "Nothing sends this email yet — you can write it now, and it will go out once it is switched on for your hotel.",
    },
    logo: {
      none: "No logo yet",
      upload: "Upload logo",
      uploading: "Uploading…",
      remove: "Remove",
      hint: "PNG, JPEG or GIF, up to 300 KB. A wide logo on a transparent background works best — it sits at the top of every guest email.",
      tooBig: "That image is {kb} KB — please use one under 300 KB.",
      notImage: "That file isn’t a PNG, JPEG or GIF. Email clients can’t show other formats.",
      pick: "Choose an image first.",
      alt: "Your logo",
    },
  },
  bg: {
    title: "Имейли към гостите",
    subtitle: "Какво получават гостите Ви от Вас — с Вашите думи, на Вашия език и с Вашия облик.",
    language: {
      title: "Гостите Ви получават имейли на",
      body: "Всеки имейл по-долу се изпраща на този език. Смените ли го, следващият имейл до гост е на новия език.",
      saved: "Запазено",
    },
    tabs: { emails: "Имейли", look: "Облик и подател" },
    stages: { booking: "При резервация", before: "Преди пристигане", after: "След престоя", waitlist: "Списък на чакащите" },
    status: {
      always: "Изпраща се автоматично",
      on: "Включен",
      off: "Изключен",
      notYet: "Още не се изпраща",
      notYetHint: "Можете да го напишете сега; все още нищо не го изпраща.",
      yours: "Ваш текст",
      ours: "наш текст",
    },
    templates: {
      booking_confirmation: { label: "Потвърждение на резервация", when: "При резервация от системата за директни резервации или потвърждение в RevioCRS" },
      booking_modified: { label: "Променена резервация", when: "Когато датите, стаята или цената на резервация се променят в RevioCRS" },
      booking_cancelled: { label: "Анулирана резервация", when: "Когато резервация се анулира в RevioCRS" },
      pre_arrival: { label: "Преди пристигане", when: "Няколко дни преди настаняването" },
      folio_receipt: { label: "Сметка", when: "При напускане в RevioPMS, с подробната сметка" },
      post_stay: { label: "Благодарност след престоя", when: "След напускане" },
      waitlist_joined: { label: "Списък на чакащите — записване", when: "Когато гост се запише в списъка на чакащите от системата за директни резервации" },
      waitlist_offer: { label: "Списък на чакащите — освободи се стая", when: "Когато се освободи стая за гост от списъка" },
      waitlist_expired: { label: "Списък на чакащите — стаята беше освободена", when: "Когато гостът не е резервирал стаята навреме" },
    },
    team: "Имейлите към Вашия екип — нови резервации и дневният списък с пристигания — се настройват отделно.",
    teamLink: "Резервации и имейл →",
    look: {
      sender: "Подател и долен текст",
      senderHint: "Гостът вижда Вашето име и отговорите стигат до Вас. Адресът, от който изпращаме, остава наш, за да стига пощата във входящата кутия, а не в спама.",
      senderName: "Име на подателя",
      replyTo: "Адрес за отговор",
      colour: "Цвят на марката",
      footer: "Долен текст (адрес / правна информация)",
      footerPlaceholder: "бул. Витоша 1, София · +359 2 000 0000",
      design: "Дизайн",
      designHint: "Четири наистина различни оформления — изберете на око.",
      typeface: "Шрифт",
      save: "Запази облика и подателя",
      logo: "Лого",
      preview: "Преглед",
      previewHint: "Потвърждението на резервация, точно както го получава гостът",
      from: "От:",
      replyToShort: "Отговор до:",
    },
    themes: {
      classic: { label: "Класически", blurb: "Заглавие със серифен шрифт, тънки линии, центрирано. Традиционен лукс." },
      modern: { label: "Модерен", blurb: "Цветна лента, удебелен текст вляво, оцветен блок с детайли." },
      minimal: { label: "Минималистичен", blurb: "Без рамка и линии. Широки полета и спокоен текст." },
      boutique: { label: "Бутиков", blurb: "Разредени главни букви, рамкиран панел, списанийно усещане." },
    },
    fonts: { serif: "Серифен", sans: "Безсерифен", mixed: "Серифни заглавия, безсерифен текст" },
    editor: {
      back: "Всички имейли към гостите",
      reset: "Върни нашия",
      save: "Запази промените",
      saving: "Запазване…",
      saved: "Запазено",
      unsaved: "Незапазени промени",
      leaveConfirm: "Имате незапазени промени. Да ги оставим и да сменим езика?",
      oursNote: "Това е нашият текст на {language} — изпраща се такъв, какъвто е. Редактирайте и запазете, за да стане Ваш; „Върни нашия“ връща нашия.",
      send: "Изпращай този имейл",
      sendHint: "Изключите ли го, гостите Ви никога не го получават. Всичко останало остава както сте го оставили.",
      always: "Не може да се изключи — гостът трябва да го има писмено.",
      subject: "Тема",
      message: "Съобщение",
      insert: "Кликнете, за да вмъкнете",
      insertHint: "Попълват се за всеки гост при изпращане. Прегледът показва примерни стойности.",
      example: "Пример: {value}",
      preview: "Преглед на живо — както го получава гостът",
      defaultBadge: "гостите получават този",
      yoursTitle: "{language} — Ваш текст",
      oursTitle: "{language} — наш текст, още нередактиран",
      notYet: "Все още нищо не изпраща този имейл — можете да го напишете сега и той ще тръгне, щом бъде включен за Вашия хотел.",
    },
    logo: {
      none: "Още няма лого",
      upload: "Качи лого",
      uploading: "Качване…",
      remove: "Премахни",
      hint: "PNG, JPEG или GIF, до 300 KB. Най-добре стои широко лого на прозрачен фон — то е най-горе във всеки имейл до гост.",
      tooBig: "Изображението е {kb} KB — моля, използвайте такова под 300 KB.",
      notImage: "Този файл не е PNG, JPEG или GIF. Имейл програмите не показват други формати.",
      pick: "Първо изберете изображение.",
      alt: "Вашето лого",
    },
  },
};
