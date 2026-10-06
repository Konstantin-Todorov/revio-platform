import type { Translations } from "@revio/ui/i18n";
import type { BarStatus } from "../tape-chart";

/**
 * What the draggable grid and the stay dialog say. **Strings only, by type** — these cross to client
 * components, and a function here would make Next refuse to render the calendar at all (see `fill`
 * in `@revio/ui/i18n`). `{name}` placeholders are filled in the browser; a count's wording comes as
 * a one/many pair.
 */
export interface CalendarGridStrings {
  bars: Record<BarStatus, string>;
  room: string;
  noFloor: string;
  floor: string;
  occupiedNights: string;
  guestOne: string;
  guestMany: string;
  pinned: string;
  dragToMove: string;
  freeOcc: string;
  movedTo: string;
  /** A room by its label inside `movedTo` — Bulgarian says "стая 101", English just "101". */
  roomNamed: string;
  theNewRoom: string;
  assess: {
    upgraded: string;
    downgraded: string;
    moved: string;
    booked: string;
    nowIn: string;
    roomParen: string;
    unchanged: string;
    differenceOne: string;
    differenceMany: string;
    decide: string;
    later: string;
    settle: string;
  };
  dragHintLead: string;
  differentType: string;
  dragHintTail: string;
  stay: CalendarStayStrings;
  extend: CalendarExtendStrings;
}

/** Extending a stay — the drag handle on a bar's end, and the dialog that prices it. */
export interface CalendarExtendStrings {
  handle: string;
  title: string;
  desc: string;
  nights: string;
  fewer: string;
  more: string;
  newCheckOut: string;
  nightOne: string;
  nightMany: string;
  perNight: string;
  noRate: string;
  ratePlan: string;
  total: string;
  totalHint: string;
  totalNeeded: string;
  fees: string;
  linkedTitle: string;
  linkedBody: string;
  confirm: string;
  cancel: string;
  loading: string;
  extendedTo: string;
  linkedCreated: string;
  refusals: Record<"not_found" | "not_movable" | "room_taken" | "sold_out" | "no_price" | "too_long" | "changed", string>;
}

export interface CalendarStayStrings {
  descOne: string;
  descMany: string;
  checkIn: string;
  checkOut: string;
  folio: string;
  postCharge: string;
  fullView: string;
  status: string;
  inHouse: string;
  notArrived: string;
  crossTitle: string;
  booked: string;
  stayingIn: string;
  unchanged: string;
  roomType: string;
  folioBalance: string;
  pinned: string;
  overstayed: string;
  extend: string;
}

export interface CalendarStrings {
  title: string;
  subtitle: string;
  previous: string;
  next: string;
  today: string;
  range: (days: number) => string;
  pinLegend: string;
  noRoomsTitle: string;
  noRoomsBefore: string;
  rooms: string;
  noRoomsAfter: string;
  footnote: (span: number, from: string, today: string) => string;
  grid: CalendarGridStrings;
}

export const calendar: Translations<CalendarStrings> = {
  en: {
    title: "Calendar",
    subtitle: "Every room, every night. Front Desk is today; this is the weeks ahead.",
    previous: "Previous period",
    next: "Next period",
    today: "Today",
    range: (d) => `${d}d`,
    pinLegend: "room chosen by a person — never re-assigned automatically",
    noRoomsTitle: "No rooms yet",
    noRoomsBefore: "The calendar draws physical rooms. Add them in",
    rooms: "Rooms",
    noRoomsAfter: "and every booking will appear here.",
    footnote: (span, from, today) =>
      `Showing ${span} nights from ${from}. Drag a stay onto another room to move it, or drag its right end to extend it. Rates are not shown here — they live in RevioCRS; this grid is about rooms and people. Today is ${today}.`,
    grid: {
      bars: {
        arrival: "Arriving today",
        in_house: "In house",
        due_out: "Due out today",
        overstayed: "Overstayed",
        confirmed: "Confirmed",
        blocked: "Out of order",
      },
      room: "Room",
      noFloor: "No floor set",
      floor: "Floor {floor}",
      occupiedNights: "Occupied these nights",
      guestOne: "{n} guest",
      guestMany: "{n} guests",
      pinned: "room pinned",
      dragToMove: "drag to another room to move",
      freeOcc: "Free · occ.",
      movedTo: "Moved to {room}",
      roomNamed: "{room}",
      theNewRoom: "the new room",
      assess: {
        upgraded: "Upgraded to a different room type",
        downgraded: "Downgraded to a different room type",
        moved: "Moved to a different room type",
        booked: "Booked",
        nowIn: ", now in",
        roomParen: "(room {room}).",
        unchanged: "The booking is unchanged and nothing went to any channel.",
        differenceOne: "Difference over {n} night: ",
        differenceMany: "Difference over {n} nights: ",
        decide: "Decide what happens to it on the folio — comp it, charge it, refund it or set an amount.",
        later: "Later",
        settle: "Settle it now",
      },
      dragHintLead: "Drop on another room to move this stay. A room of a",
      differentType: "different type",
      dragHintTail: "is allowed — the booking does not change, but you will be asked what to do about the price difference.",
      stay: {
        descOne: "Room {room} · {from} → {to} · {n} night",
        descMany: "Room {room} · {from} → {to} · {n} nights",
        checkIn: "Check in",
        checkOut: "Check out",
        folio: "Folio",
        postCharge: "Post charge",
        fullView: "Full view",
        status: "Status",
        inHouse: "In house",
        notArrived: "Not arrived — room held",
        crossTitle: "Accommodated in a different room type",
        booked: "Booked",
        stayingIn: "· staying in",
        unchanged: ". The booking is unchanged.",
        roomType: "Room type",
        folioBalance: "Folio balance",
        pinned: "A person chose this room, so it will not be re-assigned automatically.",
        overstayed: "Past its departure date and still in house. This distorts occupancy until it is resolved.",
        extend: "Extend stay",
      },
      extend: {
        handle: "Drag to extend the stay",
        title: "Extend {name}'s stay",
        desc: "Room {room} · now leaving {date}",
        nights: "Extra nights",
        fewer: "One night fewer",
        more: "One night more",
        newCheckOut: "New departure",
        nightOne: "{n} night",
        nightMany: "{n} nights",
        perNight: "Price per night",
        noRate: "no rate",
        ratePlan: "Rate plan: {plan}, today's price",
        total: "Price for the extra nights",
        totalHint: "You can change it — what you enter is what goes on the bill.",
        totalNeeded: "A night has no rate on this plan. Enter the price for the extra nights.",
        fees: "Added on top",
        linkedTitle: "This booking came from a channel",
        linkedBody: "The channel's booking stays as it is. The extra nights become a separate reservation in the same room, linked to it and paid at the hotel.",
        confirm: "Extend to {date}",
        cancel: "Cancel",
        loading: "Checking the room and the price…",
        extendedTo: "Stay extended to {date}",
        linkedCreated: "Extra nights booked as a linked reservation, to {date}",
        refusals: {
          not_found: "This stay is no longer on the calendar. Refresh and try again.",
          not_movable: "This guest has already left — a departed stay cannot be extended.",
          room_taken: "The room is taken on those nights. Move the next guest or choose fewer nights.",
          sold_out: "This room type is sold out on those nights.",
          no_price: "Enter the price for the extra nights.",
          too_long: "Up to 30 extra nights at a time.",
          changed: "The stay changed while this was open. Close and try again.",
        },
      },
    },
  },
  bg: {
    title: "Календар",
    subtitle: "Всяка стая, всяка нощ. Рецепцията е за днес — тук са следващите седмици.",
    previous: "Предишен период",
    next: "Следващ период",
    today: "Днес",
    range: (d) => `${d} дни`,
    pinLegend: "стая, избрана от човек — никога не се преразпределя автоматично",
    noRoomsTitle: "Все още няма стаи",
    noRoomsBefore: "Календарът показва физическите стаи. Добавете ги в",
    rooms: "Стаи",
    noRoomsAfter: "и всяка резервация ще се появи тук.",
    footnote: (span, from, today) =>
      `Показани са ${span} нощувки от ${from}. Плъзнете престой върху друга стая, за да го преместите, или десния му край, за да го удължите. Цените не се показват тук — те са в RevioCRS; тази таблица е за стаите и хората. Днес е ${today}.`,
    grid: {
      bars: {
        arrival: "Пристига днес",
        in_house: "В хотела",
        due_out: "Напуска днес",
        overstayed: "Останал след напускане",
        confirmed: "Потвърдена",
        blocked: "Извън експлоатация",
      },
      room: "Стая",
      noFloor: "Без етаж",
      floor: "Етаж {floor}",
      occupiedNights: "Заета за тези нощувки",
      guestOne: "{n} гост",
      guestMany: "{n} гости",
      pinned: "стаята е фиксирана",
      dragToMove: "плъзнете върху друга стая, за да преместите",
      freeOcc: "Своб. · заетост",
      movedTo: "Преместен в {room}",
      roomNamed: "стая {room}",
      theNewRoom: "новата стая",
      assess: {
        upgraded: "Надграден в друг тип стая",
        downgraded: "Преместен в по-нисък тип стая",
        moved: "Преместен в друг тип стая",
        booked: "Резервиран е",
        nowIn: ", сега е в",
        roomParen: "(стая {room}).",
        unchanged: "Резервацията не е променена и нищо не е изпратено към каналите.",
        differenceOne: "Разлика за {n} нощувка: ",
        differenceMany: "Разлика за {n} нощувки: ",
        decide: "Решете какво да стане с нея в сметката — опростете я, начислете я, възстановете я или задайте сума.",
        later: "По-късно",
        settle: "Уреди сега",
      },
      dragHintLead: "Пуснете върху друга стая, за да преместите престоя. Стая от",
      differentType: "друг тип",
      dragHintTail: "е позволена — резервацията не се променя, но ще бъдете попитани какво да стане с разликата в цената.",
      stay: {
        descOne: "Стая {room} · {from} → {to} · {n} нощувка",
        descMany: "Стая {room} · {from} → {to} · {n} нощувки",
        checkIn: "Настаняване",
        checkOut: "Напускане",
        folio: "Сметка",
        postCharge: "Начисли",
        fullView: "Цялата резервация",
        status: "Статус",
        inHouse: "В хотела",
        notArrived: "Не е пристигнал — стаята е запазена",
        crossTitle: "Настанен в друг тип стая",
        booked: "Резервиран е",
        stayingIn: "· отседнал в",
        unchanged: ". Резервацията не е променена.",
        roomType: "Тип стая",
        folioBalance: "Салдо по сметката",
        pinned: "Тази стая е избрана от човек, затова няма да бъде преразпределена автоматично.",
        overstayed: "Датата на напускане е минала, а гостът е още в хотела. Това изкривява заетостта, докато не бъде уредено.",
        extend: "Удължи престоя",
      },
      extend: {
        handle: "Плъзнете, за да удължите престоя",
        title: "Удължаване на престоя — {name}",
        desc: "Стая {room} · сега напуска на {date}",
        nights: "Допълнителни нощувки",
        fewer: "С една нощувка по-малко",
        more: "С една нощувка повече",
        newCheckOut: "Ново напускане",
        nightOne: "{n} нощувка",
        nightMany: "{n} нощувки",
        perNight: "Цена на нощувка",
        noRate: "няма цена",
        ratePlan: "Ценови план: {plan}, днешна цена",
        total: "Сума за допълнителните нощувки",
        totalHint: "Можете да я промените — каквото въведете, това влиза в сметката.",
        totalNeeded: "За някоя нощ няма цена по този план. Въведете цената за допълнителните нощувки.",
        fees: "Добавя се отгоре",
        linkedTitle: "Тази резервация е от канал",
        linkedBody: "Резервацията от канала остава непроменена. Допълнителните нощувки стават отделна резервация в същата стая, свързана с нея и платима в хотела.",
        confirm: "Удължи до {date}",
        cancel: "Отказ",
        loading: "Проверяваме стаята и цената…",
        extendedTo: "Престоят е удължен до {date}",
        linkedCreated: "Допълнителните нощувки са записани като свързана резервация, до {date}",
        refusals: {
          not_found: "Този престой вече не е в календара. Опреснете и опитайте отново.",
          not_movable: "Гостът вече е напуснал — приключил престой не може да се удължи.",
          room_taken: "Стаята е заета в тези нощи. Преместете следващия гост или изберете по-малко нощувки.",
          sold_out: "Този тип стая е разпродаден за тези нощи.",
          no_price: "Въведете цената за допълнителните нощувки.",
          too_long: "До 30 допълнителни нощувки наведнъж.",
          changed: "Престоят се промени, докато прозорецът беше отворен. Затворете и опитайте отново.",
        },
      },
    },
  },
};
