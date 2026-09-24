import type { RegisterProblemCode } from "@revio/core";
import type { Translations } from "@revio/ui/i18n";

/**
 * The guest register (Регистър на настанените туристи) — the month list and the per-stay card.
 *
 * The English screen carries the Bulgarian legal names beside its own words (ЕСТИ, образец, ЗМДТ),
 * because those are what an inspector and an accountant say. In Bulgarian they simply are the words.
 */
export interface RegisterStrings {
  title: string;
  subtitle: string;
  export: (month: string) => string;
  counts: (registrations: number, nights: number) => string;
  notReady: (incomplete: number, total: number) => string;
  notReadyBody: string;
  tax: {
    title: string;
    subtitle: string;
    noRateBefore: string;
    configuration: string;
    noRateAfter: string;
    thisMonth: string;
    monthLine: (nights: number, due: string) => string;
    yearToDate: string;
    yearLine: (nights: number, due: string) => string;
    floor: string;
    setBedsBefore: string;
    setBedsAfter: string;
    cleared: string;
    clearedLine: (floor: string) => string;
    shortLine: (floor: string, due: string) => string;
    note: [string, string, string];
  };
  list: {
    title: string;
    subtitle: (from: string, to: string) => string;
    empty: string;
    cols: { no: string; registered: string; guest: string; citizenship: string; document: string; room: string; arrived: string; departed: string; nights: string };
    notCaptured: string;
    inHouse: string;
    cancelled: string;
    missing: (n: number) => string;
    complete: string;
    exportNote: string;
  };
  card: {
    title: string;
    subtitle: string;
    completeOf: (complete: number, total: number) => string;
    opensAtCheckIn: string;
    notCapturedYet: string;
    cancelled: string;
    room: (label: string) => string;
    cyrillic: string;
    latin: string;
    firstName: string;
    firstNamePlaceholder: { cyrillic: string; latin: string };
    patronymic: string;
    patronymicHint: string;
    familyName: string;
    familyNamePlaceholder: { cyrillic: string; latin: string };
    dateOfBirth: string;
    sex: string;
    female: string;
    male: string;
    citizenship: string;
    personalNumber: string;
    personalNumberHint: string;
    documentType: string;
    docTypes: { id_card: string; passport: string; other: string };
    documentNumber: string;
    documentSeries: string;
    seriesHint: { unknown: string; required: string; notNeeded: string };
    issuedBy: string;
    roomFloor: string;
    touristPackage: string;
    remove: string;
    reinstateTitle: string;
    cancelTitle: string;
    reinstate: string;
    cancel: string;
    save: string;
    keptFor: string;
    adding: string;
    addGuest: string;
    problems: Record<RegisterProblemCode, string>;
  };
}

export const register: Translations<RegisterStrings> = {
  en: {
    title: "Guest register",
    subtitle: "Регистър на настанените туристи · every guest who stayed the night, in the order they were registered",
    export: (m) => `Export ${m}`,
    counts: (r, n) => `${r} registration${r === 1 ? "" : "s"} · ${n} night${n === 1 ? "" : "s"}`,
    notReady: (i, t) => `${i} of these ${t} aren’t ready to file.`,
    notReadyBody: "Something the register has to contain is still missing — click a name below to finish it. The export includes them as they are, so the gaps are visible rather than silent.",
    tax: {
      title: "Tourist tax",
      subtitle: "Туристически данък · ЗМДТ чл. 61с — the municipality assesses this from your ЕСТИ data, so the register is the tax base",
      noRateBefore: "Your municipality’s rate per night isn’t set yet, so there is nothing to total. Add it in",
      configuration: "Configuration",
      noRateAfter: "— each council sets its own, by settlement and by category.",
      thisMonth: "This month",
      monthLine: (n, d) => `${n} night${n === 1 ? "" : "s"} · pay by ${d}`,
      yearToDate: "Year to date",
      yearLine: (n, d) => `${n} night${n === 1 ? "" : "s"} · declare by ${d}`,
      floor: "Annual floor · 30%",
      setBedsBefore: "Set your declared bed count to see this. Your rooms suggest",
      setBedsAfter: ".",
      cleared: "Cleared",
      clearedLine: (f) => `Above the ${f} minimum — nothing extra owed.`,
      shortLine: (f, d) => `Short of the ${f} minimum · due ${d}`,
      note: [
        "The 30% floor is measured over the whole",
        "calendar year",
        ", never a single month — a quiet February is not topped up, only a quiet twelve months. The year-to-date figure moves as the year fills, so treat it as a projection until December. These are your own nights at your own rate; have your accountant confirm the return before it is filed.",
      ],
    },
    list: {
      title: "Registrations",
      subtitle: (f, t) => `${f} → ${t} · ordered by пореден номер, the way the register is kept`,
      empty: "Nobody was registered this month. Entries open automatically when a guest is checked in.",
      cols: { no: "№", registered: "Registered", guest: "Guest", citizenship: "Citizenship", document: "Document", room: "Room", arrived: "Arrived", departed: "Departed", nights: "Nights" },
      notCaptured: "not captured",
      inHouse: "in house",
      cancelled: "cancelled",
      missing: (n) => `${n} missing`,
      complete: "complete",
      exportNote: "The export has the columns of the official образец, in its order, so it can be checked against the template line by line. It downloads as an Excel workbook — open it, check it, and upload it to ЕСТИ. The CSV button is there if you prefer one. Documents are shown here by their last four characters only — the full number is in the export and on the guest’s own entry.",
    },
    card: {
      title: "Guest register",
      subtitle: "Регистър на настанените туристи · required by law for every guest who stays the night, not only the person who booked",
      completeOf: (c, t) => `${c} of ${t} complete`,
      opensAtCheckIn: "The register opens at check-in, one entry per guest in the room.",
      notCapturedYet: "Not captured yet",
      cancelled: "cancelled",
      room: (l) => ` · room ${l}`,
      cyrillic: "кирилица",
      latin: "latin",
      firstName: "First name",
      firstNamePlaceholder: { cyrillic: "Мария", latin: "John" },
      patronymic: "Patronymic",
      patronymicHint: "бащино · often blank",
      familyName: "Family name",
      familyNamePlaceholder: { cyrillic: "Иванова", latin: "Smith" },
      dateOfBirth: "Date of birth",
      sex: "Sex",
      female: "Female",
      male: "Male",
      citizenship: "Citizenship",
      personalNumber: "Personal number",
      personalNumberHint: "ЕГН / ЛНЧ",
      documentType: "Document type",
      docTypes: { id_card: "Лична карта · ID card", passport: "Паспорт · Passport", other: "Друг · Other" },
      documentNumber: "Document number",
      documentSeries: "Document series",
      seriesHint: { unknown: "non-EU/EEA only", required: "required", notNeeded: "not needed" },
      issuedBy: "Issued by",
      roomFloor: "Room · floor",
      touristPackage: "Part of a tourist package",
      remove: "Remove",
      reinstateTitle: "Put this registration back",
      cancelTitle: "Mark this registration cancelled — it keeps its number",
      reinstate: "Reinstate",
      cancel: "Cancel",
      save: "Save",
      keptFor: "Kept for two years. A guest asking to be forgotten has their profile anonymised — the register entry stands, because the law requires it.",
      adding: "Adding…",
      addGuest: "Add a guest",
      problems: {
        register_no: "The register number is missing.",
        registered_at: "The registration date is missing.",
        first_name: "First name is required.",
        last_name: "Family name is required.",
        nationality: "Citizenship is required.",
        script_cyrillic: "A Bulgarian citizen's name goes in Cyrillic, as the document writes it.",
        script_latin: "A foreign citizen's name goes in Latin, as the passport writes it.",
        sex: "Sex is required.",
        date_of_birth: "Date of birth is required.",
        document_type: "Say which kind of document this is.",
        document_number: "Identity document number is required.",
        document_country: "The country that issued the document is required.",
        unit: "Assign a room — the register records which one the guest slept in.",
        arrival_date: "Arrival date is missing.",
        document_series: "For a non-EU/EEA citizen the register needs the document series as well as its number.",
        personal_id: "ЕГН is required for a Bulgarian citizen.",
        departure_invalid: "Departure date is not a valid date.",
        departure_before_arrival: "Departure is before arrival.",
      },
    },
  },
  bg: {
    title: "Регистър на гостите",
    subtitle: "Регистър на настанените туристи · всеки гост, нощувал в обекта, в реда на регистриране",
    export: (m) => `Експорт за ${m}`,
    counts: (r, n) => `${r} ${r === 1 ? "регистрация" : "регистрации"} · ${n} ${n === 1 ? "нощувка" : "нощувки"}`,
    notReady: (i, t) => `${i} от тези ${t} не са готови за подаване.`,
    notReadyBody: "Липсват данни, които регистърът задължително съдържа — щракнете върху име по-долу, за да ги допълните. Експортът ги включва такива, каквито са, така че пропуските се виждат, а не се губят.",
    tax: {
      title: "Туристически данък",
      subtitle: "ЗМДТ чл. 61с — общината го определя по данните Ви в ЕСТИ, затова регистърът е основата за данъка",
      noRateBefore: "Ставката на общината Ви на нощувка още не е зададена, затова няма какво да се сумира. Добавете я в",
      configuration: "Конфигурация",
      noRateAfter: "— всяка община определя своя, по населено място и по категория.",
      thisMonth: "Този месец",
      monthLine: (n, d) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · платете до ${d}`,
      yearToDate: "От началото на годината",
      yearLine: (n, d) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · декларирайте до ${d}`,
      floor: "Годишен минимум · 30%",
      setBedsBefore: "Задайте декларирания брой легла, за да видите това. По стаите Ви излизат",
      setBedsAfter: ".",
      cleared: "Покрит",
      clearedLine: (f) => `Над минимума от ${f} — не се дължи нищо допълнително.`,
      shortLine: (f, d) => `Под минимума от ${f} · дължимо до ${d}`,
      note: [
        "Минимумът от 30% се измерва за цялата",
        "календарна година",
        ", никога за отделен месец — слаб февруари не се доплаща, само слаби дванадесет месеца. Сумата от началото на годината се променя, докато годината се запълва, затова я приемайте като прогноза до декември. Това са Вашите нощувки по Вашата ставка; нека счетоводителят Ви потвърди декларацията, преди да бъде подадена.",
      ],
    },
    list: {
      title: "Регистрации",
      subtitle: (f, t) => `${f} → ${t} · по пореден номер, както се води регистърът`,
      empty: "През този месец няма регистрирани гости. Записите се отварят автоматично при настаняване.",
      cols: { no: "№", registered: "Регистриран", guest: "Гост", citizenship: "Гражданство", document: "Документ", room: "Стая", arrived: "Пристигане", departed: "Напускане", nights: "Нощувки" },
      notCaptured: "не е въведено",
      inHouse: "в хотела",
      cancelled: "анулирана",
      missing: (n) => `${n} ${n === 1 ? "липсващо" : "липсващи"}`,
      complete: "пълна",
      exportNote: "Експортът съдържа колоните на официалния образец, в неговия ред, така че може да се сравни с него ред по ред. Изтегля се като файл на Excel — отворете го, проверете го и го качете в ЕСТИ. Бутонът CSV е за случаите, когато предпочитате такъв формат. Тук документите се показват само с последните четири знака — пълният номер е в експорта и в записа на госта.",
    },
    card: {
      title: "Регистър на гостите",
      subtitle: "Регистър на настанените туристи · задължителен по закон за всеки нощуващ гост, не само за този, който е резервирал",
      completeOf: (c, t) => `${c} от ${t} попълнени`,
      opensAtCheckIn: "Регистърът се отваря при настаняване — по един запис за всеки гост в стаята.",
      notCapturedYet: "Все още не е въведено",
      cancelled: "анулирана",
      room: (l) => ` · стая ${l}`,
      cyrillic: "кирилица",
      latin: "латиница",
      firstName: "Име",
      firstNamePlaceholder: { cyrillic: "Мария", latin: "John" },
      patronymic: "Презиме",
      patronymicHint: "бащино · често е празно",
      familyName: "Фамилия",
      familyNamePlaceholder: { cyrillic: "Иванова", latin: "Smith" },
      dateOfBirth: "Дата на раждане",
      sex: "Пол",
      female: "Жена",
      male: "Мъж",
      citizenship: "Гражданство",
      personalNumber: "Личен номер",
      personalNumberHint: "ЕГН / ЛНЧ",
      documentType: "Вид документ",
      docTypes: { id_card: "Лична карта", passport: "Паспорт", other: "Друг" },
      documentNumber: "Номер на документа",
      documentSeries: "Серия на документа",
      seriesHint: { unknown: "само извън ЕС/ЕИП", required: "задължително", notNeeded: "не е нужно" },
      issuedBy: "Издаден от",
      roomFloor: "Стая · етаж",
      touristPackage: "Част от туристически пакет",
      remove: "Премахни",
      reinstateTitle: "Възстановете тази регистрация",
      cancelTitle: "Отбележете регистрацията като анулирана — тя запазва номера си",
      reinstate: "Възстанови",
      cancel: "Анулирай",
      save: "Запази",
      keptFor: "Пази се две години. Ако гост поиска да бъде забравен, профилът му се анонимизира — записът в регистъра остава, защото законът го изисква.",
      adding: "Добавяне…",
      addGuest: "Добави гост",
      problems: {
        register_no: "Липсва пореден номер.",
        registered_at: "Липсва дата на регистриране.",
        first_name: "Името е задължително.",
        last_name: "Фамилията е задължителна.",
        nationality: "Гражданството е задължително.",
        script_cyrillic: "Името на български гражданин се пише на кирилица, както е в документа.",
        script_latin: "Името на чужд гражданин се пише на латиница, както е в паспорта.",
        sex: "Полът е задължителен.",
        date_of_birth: "Датата на раждане е задължителна.",
        document_type: "Посочете вида на документа.",
        document_number: "Номерът на документа за самоличност е задължителен.",
        document_country: "Държавата, издала документа, е задължителна.",
        unit: "Дайте стая — регистърът записва в коя стая е нощувал гостът.",
        arrival_date: "Липсва дата на пристигане.",
        document_series: "За гражданин извън ЕС/ЕИП регистърът изисква и серията на документа, не само номера.",
        personal_id: "ЕГН е задължително за български гражданин.",
        departure_invalid: "Датата на напускане не е валидна.",
        departure_before_arrival: "Напускането е преди пристигането.",
      },
    },
  },
};
