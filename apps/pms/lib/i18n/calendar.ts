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
      `Showing ${span} nights from ${from}. Drag a stay onto another room to move it. Rates are not shown here — they live in RevioCRS; this grid is about rooms and people. Today is ${today}.`,
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
      `Показани са ${span} нощувки от ${from}. Плъзнете престой върху друга стая, за да го преместите. Цените не се показват тук — те са в RevioCRS; тази таблица е за стаите и хората. Днес е ${today}.`,
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
      },
    },
  },
};
