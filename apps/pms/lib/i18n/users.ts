import type { Translations } from "@revio/ui/i18n";

/** What the staff table and the invite form say. **Strings only** — a client component reads it. */
export interface UsersManagerStrings {
  invite: string;
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  role: string;
  inviting: string;
  inviteButton: string;
  invited: string;
  identityNote: string;
  staff: string;
  cols: { person: string; role: string; status: string; access: string };
  you: string;
  active: string;
  deactivated: string;
  deactivate: string;
  reactivate: string;
  scopedNote: string;
}

/** Staff & Access Management — who is working, who worked, who can sign in. */
export interface UsersStrings {
  title: string;
  subtitle: (property: string) => string;
  /** The page's three views: who is in now · when people worked · who can sign in. */
  tabs: { aria: string; now: string; history: string; people: string };
  working: {
    title: string;
    subtitle: string;
    active: (n: number) => string;
    none: string;
    since: (time: string) => string;
    byStaff: string;
    clockOutTitle: (name: string) => string;
    clockOut: string;
    clockSomeoneIn: string;
    clockIn: string;
    recordedAsYou: string;
  };
  shifts: {
    title: string;
    subtitle: (from: string, to: string) => string;
    total: (hours: string, people: number) => string;
    none: string;
    suspect: (n: number, hours: number) => string;
    cols: { member: string; workedAs: string; days: string; shifts: string; hours: string };
    open: (n: number) => string;
    note: string;
    /** "3h 20m" — the hour and minute marks, so a duration reads in the reader's language. */
    h: string;
    m: string;
  };
  manager: UsersManagerStrings;
  actions: {
    notManager: string;
    nameEmail: string;
    validRole: string;
    exists: string;
    notARole: string;
  };
}

export const users: Translations<UsersStrings> = {
  en: {
    title: "Staff & Access Management",
    subtitle: (p) => `${p} · who’s working today + who can sign in and what they can touch — one shared Revio identity`,
    tabs: { aria: "Staff views", now: "On shift now", history: "Shift history", people: "People & access" },
    working: {
      title: "Working today",
      subtitle: "Live — staff currently clocked in, by department",
      active: (n) => `${n} active`,
      none: "No one is clocked in right now. Staff clock themselves in from their own view (Housekeeping / Maintenance), or you can do it for them below.",
      since: (t) => `since ${t}`,
      byStaff: " · by staff",
      clockOutTitle: (n) => `Clock ${n} out`,
      clockOut: "Clock out",
      clockSomeoneIn: "Clock someone in",
      clockIn: "Clock in",
      recordedAsYou: "Recorded as started by you, not by them.",
    },
    shifts: {
      title: "Shift record",
      subtitle: (f, t) => `${f} → ${t} · who worked and for how long`,
      total: (h, p) => `${h} across ${p} ${p === 1 ? "person" : "people"}`,
      none: "No shifts recorded in this period. Staff clock in from their own view (Housekeeping / Maintenance).",
      suspect: (n, h) => `${n} shift${n === 1 ? " has" : "s have"} been open for more than ${h} hours — almost certainly a missed clock-out. They are excluded from the totals rather than guessed at.`,
      cols: { member: "Staff member", workedAs: "Worked as", days: "Days", shifts: "Shifts", hours: "Hours" },
      open: (n) => `(${n} open)`,
      note: "An operational record of clock-ins, not a payroll or attendance system. Totals count closed shifts only.",
      h: "h",
      m: "m",
    },
    manager: {
      invite: "Invite a person",
      name: "Name",
      namePlaceholder: "Jane Doe",
      email: "Email",
      emailPlaceholder: "jane@hotel.com",
      role: "Role",
      inviting: "Inviting…",
      inviteButton: "Invite",
      invited: "Invited — they'll get an email and choose their own password.",
      identityNote: "One identity per person across every Revio product — this invites or re-roles the shared account, it never creates a PMS-only login.",
      staff: "Staff",
      cols: { person: "Person", role: "Role", status: "Status", access: "Access" },
      you: "YOU",
      active: "Active",
      deactivated: "Deactivated",
      deactivate: "Deactivate",
      reactivate: "Reactivate",
      scopedNote: "Housekeeper is the scoped mobile view; Outlet / POS is the outlet-only posting view — role-gated screens layer onto these assignments.",
    },
    actions: {
      notManager: "Only an Owner, Admin or Manager can manage staff.",
      nameEmail: "Name and email are required.",
      validRole: "Pick a valid role.",
      exists: "A person with that email already exists on the platform.",
      notARole: "That isn’t a role this property has. Reload the page and try again.",
    },
  },
  bg: {
    title: "Персонал и достъп",
    subtitle: (p) => `${p} · кой работи днес, кой може да влиза и до какво има достъп — един общ профил в Revio`,
    tabs: { aria: "Изгледи на персонала", now: "На смяна сега", history: "История на смените", people: "Хора и достъп" },
    working: {
      title: "На смяна днес",
      subtitle: "На живо — служителите, които в момента са на смяна, по отдели",
      active: (n) => `${n} на смяна`,
      none: "В момента никой не е на смяна. Служителите започват смяната си от своя изглед (Хаускийпинг / Поддръжка), или Вие можете да го направите вместо тях по-долу.",
      since: (t) => `от ${t}`,
      byStaff: " · от колега",
      clockOutTitle: (n) => `Приключи смяната на ${n}`,
      clockOut: "Край на смяната",
      clockSomeoneIn: "Започни смяна на служител",
      clockIn: "Начало на смяна",
      recordedAsYou: "Записва се като започната от Вас, не от тях.",
    },
    shifts: {
      title: "Отчет на смените",
      subtitle: (f, t) => `${f} → ${t} · кой е работил и колко време`,
      total: (h, p) => `${h} общо за ${p} ${p === 1 ? "човек" : "души"}`,
      none: "Няма записани смени за този период. Служителите започват смяната си от своя изглед (Хаускийпинг / Поддръжка).",
      suspect: (n, h) => `${n} ${n === 1 ? "смяна е отворена" : "смени са отворени"} повече от ${h} часа — почти сигурно е пропуснато приключване. Те не влизат в сумите, вместо да бъдат налучквани.`,
      cols: { member: "Служител", workedAs: "Работил като", days: "Дни", shifts: "Смени", hours: "Часове" },
      open: (n) => `(${n} ${n === 1 ? "отворена" : "отворени"})`,
      note: "Оперативен отчет на смените, а не система за заплати или присъствие. Сумите включват само приключени смени.",
      h: " ч",
      m: " мин",
    },
    manager: {
      invite: "Поканете служител",
      name: "Име",
      namePlaceholder: "Мария Иванова",
      email: "Имейл",
      emailPlaceholder: "maria@hotel.bg",
      role: "Роля",
      inviting: "Изпращане…",
      inviteButton: "Покани",
      invited: "Поканата е изпратена — служителят ще получи имейл и сам ще избере паролата си.",
      identityNote: "Един профил на човек във всички продукти на Revio — тук каните или сменяте ролята на общия профил, никога не се създава отделен вход само за PMS.",
      staff: "Персонал",
      cols: { person: "Служител", role: "Роля", status: "Статус", access: "Достъп" },
      you: "ВИЕ",
      active: "Активен",
      deactivated: "Деактивиран",
      deactivate: "Деактивирай",
      reactivate: "Активирай отново",
      scopedNote: "Ролята „Хаускийпинг“ вижда ограничен мобилен изглед; „Точка на продажба“ може само да начислява в своя обект — екраните се показват според ролята.",
    },
    actions: {
      notManager: "Само собственик, администратор или управител може да управлява персонала.",
      nameEmail: "Името и имейлът са задължителни.",
      validRole: "Изберете валидна роля.",
      exists: "В платформата вече има човек с този имейл.",
      notARole: "Тази роля не съществува за този обект. Презаредете страницата и опитайте отново.",
    },
  },
};
