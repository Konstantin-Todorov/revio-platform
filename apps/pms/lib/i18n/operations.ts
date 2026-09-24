import type { Translations } from "@revio/ui/i18n";

/** Maintenance and Close Day — the back office of running a property. */
export interface OperationsStrings {
  shift: { clockedInSince: (time: string) => string; notClockedIn: string; clockIn: string; clockOut: string };
  maintenance: {
    title: string;
    subtitle: string;
    titleError: string;
    newTask: string;
    whatsWrong: string;
    whatsWrongPlaceholder: string;
    roomOptional: string;
    none: string;
    priority: string;
    priorities: { low: string; normal: string; high: string };
    assignee: string;
    optional: string;
    outOfOrder: string;
    creating: string;
    add: string;
    oooNote: string;
    empty: string;
    open: string;
    done: string;
    room: (label: string, type: string) => string;
    noRoom: string;
    roomHistory: string;
    delete: string;
    statusAria: string;
    statuses: { open: string; in_progress: string; on_hold: string; done: string };
    photo: { view: string; remove: string; attach: string; alt: string };
  };
  closeday: {
    title: string;
    subtitle: (property: string) => string;
    closed: (n: number) => string;
    reminder: string;
    autoClose: string;
    overdueNoAuto: string;
    behindOne: string;
    behindMany: (n: number) => string;
    reminderBody: string;
    autoCloseBody: string;
    overdueNoAutoBody: string;
    currentDate: string;
    behindCalendar: (today: string) => string;
    report: string;
    reportSub: string;
    occupancy: string;
    roomsOf: (occ: number, total: number) => string;
    revenue: string;
    revenueSplit: (room: string, extras: string | null) => string;
    noShows: string;
    toBeFlagged: string;
    arrivals: string;
    departures: string;
    accrualNote: string;
    unarrived: string;
    everyoneArrived: string;
    arrival: (type: string, date: string) => string;
    noShow: string;
    beforeYouClose: string;
    notCheckedOut: (room: string, date: string) => string;
    checkOut: string;
    openBalance: (amount: string) => string;
    folio: string;
    closingWill: (n: number, date: string) => string;
    close: (date: string) => string;
  };
}

export const operations: Translations<OperationsStrings> = {
  en: {
    shift: {
      clockedInSince: (t) => `You’re clocked in since ${t}`,
      notClockedIn: "You’re not clocked in.",
      clockIn: "Clock in",
      clockOut: "Clock out",
    },
    maintenance: {
      title: "Maintenance",
      subtitle: "Log repairs and faults. Flag a room out of order to take it off sale.",
      titleError: "Give the task a title.",
      newTask: "New task",
      whatsWrong: "What’s wrong",
      whatsWrongPlaceholder: "e.g. Leaking tap",
      roomOptional: "Room (optional)",
      none: "— None —",
      priority: "Priority",
      priorities: { low: "Low", normal: "Normal", high: "High" },
      assignee: "Assignee",
      optional: "(optional)",
      outOfOrder: "Out of order",
      creating: "Creating…",
      add: "Add",
      oooNote: "Ticking “Out of order” (with a room) takes that room off sale on every channel until the task is done.",
      empty: "No maintenance tasks. Nice and quiet.",
      open: "Open",
      done: "Done",
      room: (l, t) => `Room ${l} · ${t}`,
      noRoom: "No room",
      roomHistory: "Room history",
      delete: "Delete",
      statusAria: "Task status",
      statuses: { open: "Reported", in_progress: "In progress", on_hold: "On hold — awaiting parts", done: "Done" },
      photo: { view: "View photo", remove: "Remove photo", attach: "Attach a photo of the fault", alt: "Fault" },
    },
    closeday: {
      title: "Close Day",
      subtitle: (p) => `${p} · night audit`,
      closed: (n) => `Day closed — ${n} reservation${n === 1 ? "" : "s"} marked no-show, business date rolled forward.`,
      reminder: "Close Day is due.",
      autoClose: "This day is being closed automatically.",
      overdueNoAuto: "This day is overdue and nothing will close it.",
      behindOne: "The business date is a day behind the calendar.",
      behindMany: (n) => `The business date is ${n} days behind the calendar.`,
      reminderBody: "Close it below; the reminder returns until you do.",
      autoCloseBody: "The system closes it on its next run — the same close, recorded as having had no one in it. Closing it yourself now is better.",
      overdueNoAutoBody: "Automatic close is switched off for this property, so only a person can end this day.",
      currentDate: "Current business date",
      behindCalendar: (t) => `behind calendar (${t})`,
      report: "Tonight's audit report",
      reportSub: "Occupancy, revenue accruing for the night, and the day's movements",
      occupancy: "Occupancy",
      roomsOf: (o, t) => `${o} of ${t} rooms`,
      revenue: "Revenue tonight",
      revenueSplit: (room, extras) => `room ${room}${extras ? ` · extras ${extras}` : ""}`,
      noShows: "No-shows",
      toBeFlagged: "to be flagged",
      arrivals: "arrivals today",
      departures: "departures today",
      accrualNote: "Revenue accrues nightly at the audit — the room charge for each occupied stay plus any recurring extras.",
      unarrived: "Un-arrived — will become no-shows",
      everyoneArrived: "Everyone expected has arrived. 🎉",
      arrival: (type, d) => `${type} · arrival ${d}`,
      noShow: "No-show",
      beforeYouClose: "Before you close",
      notCheckedOut: (room, d) => `Room ${room} · due out ${d} (not checked out)`,
      checkOut: "Check out",
      openBalance: (a) => `open balance ${a}`,
      folio: "Folio",
      closingWill: (n, d) => `Closing will mark the ${n} un-arrived reservation${n === 1 ? "" : "s"} as no-show, accrue tonight’s stay extras, and roll the business date to ${d} + 1 day.`,
      close: (d) => `Close ${d}`,
    },
  },
  bg: {
    shift: {
      clockedInSince: (t) => `На смяна сте от ${t}`,
      notClockedIn: "Не сте на смяна.",
      clockIn: "Начало на смяна",
      clockOut: "Край на смяна",
    },
    maintenance: {
      title: "Поддръжка",
      subtitle: "Записвайте ремонти и повреди. Маркирайте стая извън експлоатация, за да я спрете от продажба.",
      titleError: "Въведете заглавие на задачата.",
      newTask: "Нова задача",
      whatsWrong: "Какъв е проблемът",
      whatsWrongPlaceholder: "напр. Тече чешмата",
      roomOptional: "Стая (по желание)",
      none: "— Няма —",
      priority: "Спешност",
      priorities: { low: "Ниска", normal: "Нормална", high: "Висока" },
      assignee: "Отговорник",
      optional: "(по желание)",
      outOfOrder: "Извън експлоатация",
      creating: "Създаване…",
      add: "Добави",
      oooNote: "Отметката „Извън експлоатация“ (за стая) я спира от продажба във всички канали, докато задачата не приключи.",
      empty: "Няма задачи по поддръжката. Тихо и спокойно.",
      open: "Отворени",
      done: "Приключени",
      room: (l, t) => `Стая ${l} · ${t}`,
      noRoom: "Без стая",
      roomHistory: "История на стаята",
      delete: "Изтрий",
      statusAria: "Статус на задачата",
      statuses: { open: "Съобщена", in_progress: "В работа", on_hold: "Изчаква — чакат се части", done: "Приключена" },
      photo: { view: "Виж снимката", remove: "Премахни снимката", attach: "Прикачи снимка на повредата", alt: "Повреда" },
    },
    closeday: {
      title: "Затваряне на деня",
      subtitle: (p) => `${p} · нощен одит`,
      closed: (n) => `Денят е затворен — ${n} ${n === 1 ? "резервация е маркирана" : "резервации са маркирани"} като неявили се, работната дата е преместена напред.`,
      reminder: "Време е да затворите деня.",
      autoClose: "Този ден ще бъде затворен автоматично.",
      overdueNoAuto: "Този ден е просрочен и нищо няма да го затвори.",
      behindOne: "Работната дата изостава с един ден от календара.",
      behindMany: (n) => `Работната дата изостава с ${n} дни от календара.`,
      reminderBody: "Затворете го по-долу; напомнянето ще се появява, докато не го направите.",
      autoCloseBody: "Системата ще го затвори при следващото си пускане — същото затваряне, но записано като направено без човек. По-добре е да го затворите Вие сега.",
      overdueNoAutoBody: "Автоматичното затваряне е изключено за този обект, така че само човек може да приключи деня.",
      currentDate: "Текуща работна дата",
      behindCalendar: (t) => `изостава от календара (${t})`,
      report: "Отчет за нощния одит",
      reportSub: "Заетост, приходи за нощта и движението през деня",
      occupancy: "Заетост",
      roomsOf: (o, t) => `${o} от ${t} стаи`,
      revenue: "Приходи тази нощ",
      revenueSplit: (room, extras) => `нощувки ${room}${extras ? ` · допълнителни ${extras}` : ""}`,
      noShows: "Неявили се",
      toBeFlagged: "ще бъдат отбелязани",
      arrivals: "пристигания днес",
      departures: "напускания днес",
      accrualNote: "Приходите се начисляват всяка нощ при одита — нощувката за всеки зает престой плюс повтарящите се допълнителни услуги.",
      unarrived: "Непристигнали — ще станат неявили се",
      everyoneArrived: "Всички очаквани гости са пристигнали. 🎉",
      arrival: (type, d) => `${type} · пристигане ${d}`,
      noShow: "Неявил се",
      beforeYouClose: "Преди да затворите",
      notCheckedOut: (room, d) => `Стая ${room} · напуска ${d} (не е изписан)`,
      checkOut: "Напускане",
      openBalance: (a) => `неплатено салдо ${a}`,
      folio: "Сметка",
      closingWill: (n, d) => `Затварянето ще отбележи ${n} ${n === 1 ? "непристигнала резервация" : "непристигнали резервации"} като неявили се, ще начисли допълнителните услуги за нощта и ще премести работната дата от ${d} с един ден напред.`,
      close: (d) => `Затвори ${d}`,
    },
  },
};
