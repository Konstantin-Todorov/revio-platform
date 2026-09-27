import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's Settings — the section nav, property, delivery, team, users and account — plus the
 * refusals of the settings, users and guest-email actions. Where RevioCRS has the same words for the
 * same thing (`reservation/lib/i18n/settings.ts`) they are the same here.
 */
export interface CmSettingsStrings {
  title: string;
  navLabel: string;
  elsewhereLabel: string;
  sections: Record<"property" | "emails" | "delivery" | "team" | "billing" | "account", { label: string; blurb: string }>;
  elsewhere: Record<"users" | "channels" | "rooms" | "help", { label: string; blurb: string }>;
  account: { twoFactor: string; twoFactorSub: string; signIn: string; signInSub: string };
  property: {
    title: string;
    rooms: (n: number) => string;
    properties: string;
    active: string;
    name: string;
    timezone: string;
    currency: string;
    currencyHint: string;
    horizon: string;
    horizonHint: string;
    checkIn: string;
    checkOut: string;
    convertTitle: (c: string) => string;
    convertNo: string;
    convertYes: string;
    contactEmail: string;
    phone: string;
    saved: string;
    saving: string;
    save: string;
    add: string;
    addTitle: string;
    addLead: string;
    addNamePlaceholder: string;
    adding: string;
    cancel: string;
  };
  delivery: {
    title: string;
    subtitle: string;
    guestEmails: string;
    guestEmailsSub: string;
    primary: string;
    primaryHint: string;
    secondary: string;
    secondaryHint: string;
    summaries: string;
    today: string;
    tomorrow: string;
    sendAt: string;
    to: Record<"primary" | "secondary" | "both", string>;
    saved: string;
    connected: string;
    notConnected: string;
    test: string;
    saving: string;
    save: string;
  };
  team: {
    title: string;
    count: (n: number) => string;
    manage: string;
    connectTitle: string;
    connectBody: string;
  };
  users: {
    title: string;
    subtitle: string;
    card: string;
    you: string;
    remove: (name: string) => string;
    removeLabel: string;
    onlyManagers: string;
    rolesNote: string;
    roles: Record<"owner" | "admin" | "revenue_manager" | "distribution_manager" | "read_only", string>;
    invite: string;
    inviteTitle: string;
    inviteLead: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    role: string;
    inviting: string;
    send: string;
    cancel: string;
  };
  errors: {
    staffDenied: string;
    propertyDenied: string;
    nameEmail: string;
    validRole: string;
    emailTaken: string;
    notARole: string;
    lastOwner: string;
    propertyName: string;
    validEmails: string;
    sendTimes: string;
    emailsDenied: string;
    emailGone: string;
    notALanguage: string;
  };
}

export const settings: Translations<CmSettingsStrings> = {
  en: {
    title: "Settings",
    navLabel: "Settings sections",
    elsewhereLabel: "Elsewhere",
    sections: {
      property: { label: "Property", blurb: "Your hotel's details, and the properties on this account" },
      emails: { label: "Guest emails", blurb: "What your guests receive, in which language, and how it looks" },
      delivery: { label: "Bookings & email", blurb: "Where channel bookings are sent, and the daily arrivals summary for your team" },
      team: { label: "Team", blurb: "The people on this account and what they may do" },
      billing: { label: "Billing", blurb: "What you pay, and every invoice we have issued" },
      account: { label: "Your account", blurb: "Two-factor authentication and your sessions" },
    },
    elsewhere: {
      users: { label: "Users", blurb: "Add, edit and deactivate the people on this account" },
      channels: { label: "Channels", blurb: "Connect an OTA and map your rooms and rates" },
      rooms: { label: "Rooms & rates", blurb: "Room types, rate plans and prices" },
      help: { label: "Help & support", blurb: "Answers, and every request you have sent us" },
    },
    account: {
      twoFactor: "Two-factor authentication",
      twoFactorSub: "Protects this account in every Revio product you use",
      signIn: "Your sign-in",
      signInSub: "Sessions on this and any other device",
    },
    property: {
      title: "Property",
      rooms: (n) => `${n} physical rooms across the active room types`,
      properties: "Properties",
      active: "active",
      name: "Property name",
      timezone: "Time zone",
      currency: "Base currency",
      currencyHint: "Channels inherit this",
      horizon: "Sync horizon (days)",
      horizonHint: "How far ahead to push",
      checkIn: "Check-in",
      checkOut: "Check-out",
      convertTitle: (c) => `Changing currency to ${c} — would you like to convert all existing rates?`,
      convertNo: "No — only change the displayed currency (every rate value stays the same)",
      convertYes: "Yes — convert every rate at this exchange rate:",
      contactEmail: "Contact email",
      phone: "Phone",
      saved: "Settings saved.",
      saving: "Saving…",
      save: "Save settings",
      add: "Add property",
      addTitle: "Add a property",
      addLead: "For chains — add another hotel to this account. It appears in the property switcher and gets its own rooms, rates and channels.",
      addNamePlaceholder: "Grand Marina — Varna",
      adding: "Adding…",
      cancel: "Cancel",
    },
    delivery: {
      title: "Reservation delivery & notifications",
      subtitle: "Where channel bookings are emailed, plus the daily arrival summaries",
      guestEmails: "Guest emails →",
      guestEmailsSub: "Your branding, and the wording of every email your guests receive",
      primary: "Primary reservation email",
      primaryHint: "New channel bookings are emailed here when no PMS/CRS takes delivery",
      secondary: "Secondary reservation email",
      secondaryHint: "Optional copy — e.g. the manager",
      summaries: "Arrival summaries",
      today: "Today's arrivals",
      tomorrow: "Tomorrow's arrivals",
      sendAt: "send at",
      to: { primary: "Primary email", secondary: "Secondary email", both: "Both emails" },
      saved: "Delivery settings saved.",
      connected: "Email sending is connected.",
      notConnected: "Email sending is not connected yet — messages are recorded but not delivered.",
      test: "Send test email",
      saving: "Saving…",
      save: "Save delivery settings",
    },
    team: {
      title: "Team",
      count: (n) => `${n} user${n === 1 ? "" : "s"} on this account`,
      manage: "Manage users",
      connectTitle: "Connect another system",
      connectBody: "Already running a different PMS? We can connect it to RevioLink so your availability stays in one place. Talk to us and we’ll set it up with you.",
    },
    users: {
      title: "User Management",
      subtitle: "Your team — invite staff, assign roles, remove access",
      card: "Users & Permissions",
      you: "you",
      remove: (n) => `Remove ${n}`,
      removeLabel: "Remove",
      onlyManagers: "Only an Owner or Admin can manage users.",
      rolesNote: "Roles: Owner (everything) · Admin (operations + team) · Revenue Manager (rates) · Distribution Manager (channels/ARI) · Read-only. Every change is scoped to your hotel and audited.",
      roles: { owner: "Owner", admin: "Admin", revenue_manager: "Revenue Manager", distribution_manager: "Distribution Manager", read_only: "Read-only" },
      invite: "Invite user",
      inviteTitle: "Invite a team member",
      inviteLead: "They’ll get access to this hotel, scoped to their role. An invitation goes to their email and they choose their own password.",
      name: "Name",
      namePlaceholder: "Lena Koch",
      email: "Email",
      emailPlaceholder: "lena@hotel.com",
      role: "Role",
      inviting: "Inviting…",
      send: "Send invite",
      cancel: "Cancel",
    },
    errors: {
      staffDenied: "Only an Owner or Admin can manage users.",
      propertyDenied: "Only an Owner or Admin can add a property.",
      nameEmail: "Name and email are required.",
      validRole: "Pick a valid role.",
      emailTaken: "A user with that email already exists.",
      notARole: "That isn’t a role this account has. Reload the page and try again.",
      lastOwner: "This is the last owner. Make somebody else an owner first — an account with no owner cannot be managed.",
      propertyName: "Property name is required.",
      validEmails: "Enter valid email addresses.",
      sendTimes: "Send times must be HH:MM.",
      emailsDenied: "Only an owner or admin can change guest emails. Ask one of them.",
      emailGone: "That email or language no longer exists. Reload the page and try again.",
      notALanguage: "That isn’t a language we send in. Reload the page and try again.",
    },
  },
  bg: {
    title: "Настройки",
    navLabel: "Раздели на настройките",
    elsewhereLabel: "Другаде",
    sections: {
      property: { label: "Обект", blurb: "Данните на хотела и обектите в този акаунт" },
      emails: { label: "Имейли до гостите", blurb: "Какво получават гостите, на какъв език и как изглежда" },
      delivery: { label: "Резервации и имейл", blurb: "Къде се изпращат резервациите от каналите и дневният списък с пристигащи за екипа" },
      team: { label: "Екип", blurb: "Хората в този акаунт и какво могат да правят" },
      billing: { label: "Плащания към Revio", blurb: "Какво плащате и всяка фактура, която сме издали" },
      account: { label: "Вашият профил", blurb: "Двуфакторна защита и сесиите Ви" },
    },
    elsewhere: {
      users: { label: "Потребители", blurb: "Добавяне, редакция и деактивиране на хората в този акаунт" },
      channels: { label: "Канали", blurb: "Свързване на OTA и съответствия на стаите и цените" },
      rooms: { label: "Стаи и цени", blurb: "Типове стаи, ценови планове и цени" },
      help: { label: "Помощ и поддръжка", blurb: "Отговори и всяка заявка, която сте ни изпратили" },
    },
    account: {
      twoFactor: "Двуфакторна защита",
      twoFactorSub: "Защитава този профил във всеки продукт на Revio, който ползвате",
      signIn: "Вашият вход",
      signInSub: "Сесии на това и на всяко друго устройство",
    },
    property: {
      title: "Обект",
      rooms: (n) => `${n} ${n === 1 ? "физическа стая" : "физически стаи"} в активните типове стаи`,
      properties: "Обекти",
      active: "текущ",
      name: "Име на обекта",
      timezone: "Часова зона",
      currency: "Основна валута",
      currencyHint: "Каналите я наследяват",
      horizon: "Период на синхронизация (дни)",
      horizonHint: "Колко напред да се изпраща",
      checkIn: "Настаняване",
      checkOut: "Напускане",
      convertTitle: (c) => `Смяна на валутата на ${c} — да се превалутират ли всички съществуващи цени?`,
      convertNo: "Не — сменя се само показваната валута (всички стойности на цените остават същите)",
      convertYes: "Да — превалутирай всички цени по този курс:",
      contactEmail: "Имейл за контакт",
      phone: "Телефон",
      saved: "Настройките са запазени.",
      saving: "Запазване…",
      save: "Запази настройките",
      add: "Добави обект",
      addTitle: "Нов обект",
      addLead: "За вериги — добавете още един хотел в този акаунт. Той се появява в избора на обект и има собствени стаи, цени и канали.",
      addNamePlaceholder: "Гранд Марина — Варна",
      adding: "Добавяне…",
      cancel: "Отказ",
    },
    delivery: {
      title: "Доставка на резервации и известия",
      subtitle: "Къде се изпращат по имейл резервациите от каналите, плюс дневните списъци с пристигащи",
      guestEmails: "Имейли до гостите →",
      guestEmailsSub: "Вашият брандинг и текстът на всеки имейл, който получават гостите",
      primary: "Основен имейл за резервации",
      primaryHint: "Новите резервации от каналите се изпращат тук, когато няма PMS/CRS, който да ги поеме",
      secondary: "Допълнителен имейл за резервации",
      secondaryHint: "Копие по желание — напр. за управителя",
      summaries: "Списъци с пристигащи",
      today: "Пристигащи днес",
      tomorrow: "Пристигащи утре",
      sendAt: "изпращане в",
      to: { primary: "Основния имейл", secondary: "Допълнителния имейл", both: "И двата имейла" },
      saved: "Настройките за доставка са запазени.",
      connected: "Изпращането на имейли е свързано.",
      notConnected: "Изпращането на имейли още не е свързано — съобщенията се записват, но не се доставят.",
      test: "Изпрати тестов имейл",
      saving: "Запазване…",
      save: "Запази настройките за доставка",
    },
    team: {
      title: "Екип",
      count: (n) => `${n} ${n === 1 ? "потребител" : "потребители"} в този акаунт`,
      manage: "Управление на потребителите",
      connectTitle: "Свързване на друга система",
      connectBody: "Вече ползвате друга PMS? Можем да я свържем с RevioLink, така че наличността Ви да е на едно място. Пишете ни и ще го настроим заедно.",
    },
    users: {
      title: "Потребители",
      subtitle: "Вашият екип — поканете служители, задайте роли, спрете достъп",
      card: "Потребители и права",
      you: "Вие",
      remove: (n) => `Премахни ${n}`,
      removeLabel: "Премахни",
      onlyManagers: "Само собственик или администратор може да управлява потребителите.",
      rolesNote: "Роли: Собственик (всичко) · Администратор (работа + екип) · Мениджър приходи (цени) · Мениджър дистрибуция (канали, наличност, цени и ограничения) · Само преглед. Всяка промяна е само за Вашия хотел и се записва.",
      roles: { owner: "Собственик", admin: "Администратор", revenue_manager: "Мениджър приходи", distribution_manager: "Мениджър дистрибуция", read_only: "Само преглед" },
      invite: "Покани потребител",
      inviteTitle: "Покана за член на екипа",
      inviteLead: "Ще получи достъп до този хотел според ролята си. Поканата отива на имейла му и той сам избира паролата си.",
      name: "Име",
      namePlaceholder: "Мария Иванова",
      email: "Имейл",
      emailPlaceholder: "maria@hotel.bg",
      role: "Роля",
      inviting: "Изпращане…",
      send: "Изпрати покана",
      cancel: "Отказ",
    },
    errors: {
      staffDenied: "Само собственик или администратор може да управлява потребителите.",
      propertyDenied: "Само собственик или администратор може да добавя обект.",
      nameEmail: "Името и имейлът са задължителни.",
      validRole: "Изберете валидна роля.",
      emailTaken: "Вече има потребител с този имейл.",
      notARole: "Такава роля няма в този акаунт. Презаредете страницата и опитайте отново.",
      lastOwner: "Това е последният собственик. Първо направете някой друг собственик — акаунт без собственик не може да се управлява.",
      propertyName: "Името на обекта е задължително.",
      validEmails: "Въведете валидни имейл адреси.",
      sendTimes: "Часовете за изпращане трябва да са във формат ЧЧ:ММ.",
      emailsDenied: "Само собственик или администратор може да променя имейлите до гостите. Помолете някого от тях.",
      emailGone: "Този имейл или език вече не съществува. Презаредете страницата и опитайте отново.",
      notALanguage: "Не изпращаме имейли на този език. Презаредете страницата и опитайте отново.",
    },
  },
};
