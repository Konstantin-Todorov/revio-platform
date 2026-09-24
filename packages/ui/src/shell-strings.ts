import type { Translations } from "./i18n";

/**
 * The pieces every product's frame shows — the notification bell, ⌘K search and Get help.
 * **Strings only** (`{name}` placeholders): all three are client components.
 */
export interface ShellStrings {
  notifications: {
    title: string;
    /** "{n}" unread */
    ariaUnread: string;
    markAllRead: string;
    needsAttention: string;
    empty: string;
    today: string;
    yesterday: string;
    justNow: string;
    minAgo: string;
    hAgo: string;
    dAgoOne: string;
    dAgo: string;
  };
  search: {
    aria: string;
    placeholder: string;
    typeMore: string;
    searching: string;
    /** "{q}" */
    nothing: string;
    /** "{q}" */
    seeAll: string;
    kinds: Record<string, string>;
  };
  help: {
    trigger: string;
    weHaveIt: string;
    referenceBefore: string;
    referenceAfter: string;
    close: string;
    intro: string;
    mightBeIt: string;
    allHelp: string;
    howUrgent: string;
    whatsHappening: string;
    placeholder: string;
    sending: string;
    send: string;
    cancel: string;
    kinds: Record<"urgent" | "problem" | "question", { label: string; hint: string; promise: string }>;
  };
}

export const shellStrings: Translations<ShellStrings> = {
  en: {
    notifications: {
      title: "Notifications",
      ariaUnread: "Notifications — {n} unread",
      markAllRead: "Mark all read",
      needsAttention: "Needs attention",
      empty: "Nothing needs you, and nothing has happened since you last looked.",
      today: "Today",
      yesterday: "Yesterday",
      justNow: "just now",
      minAgo: "{n} min ago",
      hAgo: "{n} h ago",
      dAgoOne: "1 d ago",
      dAgo: "{n} d ago",
    },
    search: {
      aria: "Search",
      placeholder: "Search…",
      typeMore: "Type at least two characters.",
      searching: "Searching…",
      nothing: "Nothing matches “{q}”.",
      seeAll: "See every result for “{q}” →",
      kinds: {
        client: "Clients", hotel: "Hotels", reservation: "Reservations", guest: "Guests", person: "People",
        room: "Room types", unit: "Rooms", rate: "Rate plans", channel: "Channels", invoice: "Invoices", page: "Go to",
      },
    },
    help: {
      trigger: "Get help",
      weHaveIt: "We have it",
      referenceBefore: "Your reference is",
      referenceAfter: "We have your email address and will reply there —",
      close: "Close",
      intro: "We can see which hotel and which screen you are on, so start with what went wrong.",
      mightBeIt: "This might be it",
      allHelp: "All help →",
      howUrgent: "How urgent is it?",
      whatsHappening: "What is happening?",
      placeholder: "Booking page returns an error when I press save on rates.",
      sending: "Sending…",
      send: "Send to Revio",
      cancel: "Cancel",
      kinds: {
        urgent: {
          label: "Guests are affected right now",
          hint: "Check-in is blocked, the booking page is down, a room was sold twice.",
          promise: "We aim to reply within 2 hours, 08:00–22:00 EET.",
        },
        problem: {
          label: "Something is wrong, but we can work around it",
          hint: "A screen is failing, a number looks incorrect, a channel is not updating.",
          promise: "We aim to reply within one working day.",
        },
        question: {
          label: "A question about how something works",
          hint: "How do I set this up, what does this figure mean, can it do X.",
          promise: "We aim to reply within two working days.",
        },
      },
    },
  },
  bg: {
    notifications: {
      title: "Известия",
      ariaUnread: "Известия — {n} непрочетени",
      markAllRead: "Маркирай всички като прочетени",
      needsAttention: "Изисква внимание",
      empty: "Нищо не Ви чака и нищо не се е случило, откакто погледнахте последно.",
      today: "Днес",
      yesterday: "Вчера",
      justNow: "току-що",
      minAgo: "преди {n} мин",
      hAgo: "преди {n} ч",
      dAgoOne: "преди 1 ден",
      dAgo: "преди {n} дни",
    },
    search: {
      aria: "Търсене",
      placeholder: "Търсене…",
      typeMore: "Въведете поне два знака.",
      searching: "Търсене…",
      nothing: "Нищо не съвпада с „{q}“.",
      seeAll: "Всички резултати за „{q}“ →",
      kinds: {
        client: "Клиенти", hotel: "Хотели", reservation: "Резервации", guest: "Гости", person: "Хора",
        room: "Типове стаи", unit: "Стаи", rate: "Ценови планове", channel: "Канали", invoice: "Фактури", page: "Отиди на",
      },
    },
    help: {
      trigger: "Помощ",
      weHaveIt: "Получихме го",
      referenceBefore: "Номерът на запитването Ви е",
      referenceAfter: "Имаме имейла Ви и ще отговорим там —",
      close: "Затвори",
      intro: "Виждаме в кой хотел и на кой екран сте, така че започнете с това какво се е объркало.",
      mightBeIt: "Може би това е отговорът",
      allHelp: "Цялата помощ →",
      howUrgent: "Колко е спешно?",
      whatsHappening: "Какво се случва?",
      placeholder: "Страницата за директни резервации дава грешка, когато запазвам цените.",
      sending: "Изпращане…",
      send: "Изпрати към Revio",
      cancel: "Отказ",
      kinds: {
        urgent: {
          label: "Засегнати са гости в момента",
          hint: "Настаняването е блокирано, страницата за директни резервации не работи, стая е продадена два пъти.",
          promise: "Стремим се да отговорим до 2 часа, 08:00–22:00 ч. българско време.",
        },
        problem: {
          label: "Нещо не е наред, но можем да го заобиколим",
          hint: "Екран дава грешка, число изглежда грешно, канал не се обновява.",
          promise: "Стремим се да отговорим до един работен ден.",
        },
        question: {
          label: "Въпрос как работи нещо",
          hint: "Как да настроя това, какво означава тази цифра, може ли да прави Х.",
          promise: "Стремим се да отговорим до два работни дни.",
        },
      },
    },
  },
};
