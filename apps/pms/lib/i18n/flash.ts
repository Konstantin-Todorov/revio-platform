import type { Translations } from "@revio/ui/i18n";

/**
 * What RevioPMS's actions say when they refuse — the toast after a button. Said in the reader's
 * language from the action itself (`(await i18n()).t(flash)`), because the action is the only place
 * that knows WHY it refused.
 */
export interface FlashStrings {
  folio: {
    noPermission: string;
    chargeFields: string;
    closedCharge: string;
    paymentFields: string;
    closedPayment: string;
    cardDeclined: string;
    extraFields: string;
    stayGone: string;
    extraGone: string;
    depositAmount: string;
    depositType: string;
    closedDeposit: string;
    depositDeclined: string;
    closedApply: string;
    noHeldToApply: string;
    closedRefund: string;
    noHeldToRefund: string;
    refundFailed: string;
    splitGone: string;
    primaryStays: string;
    closedIsRecord: string;
    splitHasLines: string;
    notAResolution: string;
    folioGone: string;
    stillOpen: string;
    moveChoice: string;
    noMoveDifference: string;
    noOpenFolioForMove: string;
    lineGone: string;
    voidedCannotMove: string;
    paymentsStay: string;
    chooseOpenFolio: string;
    alreadyVoided: string;
    accommodationAuthoritative: string;
  };
  units: {
    needTypeAndNumber: string;
    typeGone: string;
    pickType: string;
    howMany: string;
    roomGone: string;
    notHkStatus: string;
    sayWhatIsWrong: string;
    pickRooms: string;
  };
  workforce: { delegatorsOnly: string; inactive: (name: string) => string; thatPerson: string };
  support: { expired: string; unknownRequest: string };
  maintenance: { notAStatus: string };
  guests: { managersMerge: string };
  trial: { ownersOnly: string; unknownProduct: string; noTrial: string; couldNotStart: string };
}

export const flash: Translations<FlashStrings> = {
  en: {
    folio: {
      noPermission: "You don’t have permission to change this folio. Ask a manager or reception colleague.",
      chargeFields: "Add a description and an amount above zero before posting the charge.",
      closedCharge: "This folio is closed, so no new charge was posted. Reopen it first.",
      paymentFields: "Choose a payment method and enter an amount above zero.",
      closedPayment: "This folio is closed, so no payment was recorded. Reopen it first.",
      cardDeclined: "The card payment was declined by the gateway. Nothing was posted to the folio.",
      extraFields: "Name the recurring extra and enter a nightly price above zero.",
      stayGone: "That stay no longer exists, so the recurring extra was not added.",
      extraGone: "That recurring extra no longer exists. Reload the folio and try again.",
      depositAmount: "Enter a deposit amount above zero.",
      depositType: "Choose an active deposit type before taking the deposit.",
      closedDeposit: "This folio is closed, so no deposit was taken. Reopen it first.",
      depositDeclined: "The deposit card payment was declined. Nothing was posted to the folio.",
      closedApply: "This folio is closed, so no deposit was applied. Reopen it first.",
      noHeldToApply: "There is no held deposit available against an outstanding balance.",
      closedRefund: "This folio is closed, so no deposit was refunded. Reopen it first.",
      noHeldToRefund: "There is no held deposit available to refund.",
      refundFailed: "The card refund failed at the gateway. Nothing was posted to the folio.",
      splitGone: "That split folio no longer exists. Reload the stay and try again.",
      primaryStays: "The primary folio is the stay’s bill and cannot be removed.",
      closedIsRecord: "A closed folio is a financial record and cannot be removed.",
      splitHasLines: "Move or void every active line on this split before removing it.",
      notAResolution: "That is not one of the four ways to resolve a folio. Reload the page and try again.",
      folioGone: "That folio no longer exists on this stay. Reload the page.",
      stillOpen: "This folio is still open. Post the payment on it directly, or close it first — these four are the ways out of a folio that closed still owing money.",
      moveChoice: "Choose one of the available ways to settle the room-move difference.",
      noMoveDifference: "There is no unresolved rate difference for this room move.",
      noOpenFolioForMove: "The stay has no open folio, so the room-move amount was not posted. Reopen the folio first.",
      lineGone: "That folio line no longer exists. Reload the stay and try again.",
      voidedCannotMove: "A voided line cannot be moved to another folio.",
      paymentsStay: "Payments stay on their original folio and cannot be moved.",
      chooseOpenFolio: "Choose an open folio from this same stay before moving the line.",
      alreadyVoided: "That folio line has already been voided.",
      accommodationAuthoritative: "Accommodation is authoritative and cannot be voided from the folio.",
    },
    units: {
      needTypeAndNumber: "A room needs a room type and a number before it can be added.",
      typeGone: "That room type no longer exists — somebody removed it while this page was open.",
      pickType: "Pick a room type first.",
      howMany: "Say how many rooms to create — a number above zero.",
      roomGone: "That room no longer exists — somebody removed it while this page was open.",
      notHkStatus: "That isn’t a housekeeping status. Reload the page and try again.",
      sayWhatIsWrong: "Say what is wrong with the room, so maintenance knows what to bring.",
      pickRooms: "Tick the rooms that are on this floor.",
    },
    workforce: {
      delegatorsOnly: "Only a manager, supervisor or reception can clock somebody else in or out.",
      inactive: (n) => `${n} no longer has an active account, so they cannot be clocked in.`,
      thatPerson: "That person",
    },
    support: {
      expired: "Your session has expired. Sign in again and send it once more.",
      unknownRequest: "That request could not be identified. Reload the page.",
    },
    maintenance: { notAStatus: "That isn’t a status a task can be in. Reload the page and try again." },
    guests: { managersMerge: "Merging guest records is a manager’s job — ask one to do it." },
    trial: {
      ownersOnly: "Only the owner or an admin can decide what this account pays for. Ask one of them.",
      unknownProduct: "Unknown product.",
      noTrial: "There is no trial running here to keep. Reload the page — it may have finished already.",
      couldNotStart: "That trial could not be started.",
    },
  },
  bg: {
    folio: {
      noPermission: "Нямате права да променяте тази сметка. Помолете управител или колега от рецепцията.",
      chargeFields: "Добавете описание и сума над нула, преди да начислите.",
      closedCharge: "Сметката е затворена, затова нищо не е начислено. Първо я отворете отново.",
      paymentFields: "Изберете начин на плащане и въведете сума над нула.",
      closedPayment: "Сметката е затворена, затова плащането не е записано. Първо я отворете отново.",
      cardDeclined: "Плащането с карта е отказано от платежния доставчик. Нищо не е записано в сметката.",
      extraFields: "Дайте име на повтарящата се екстра и въведете цена на нощувка над нула.",
      stayGone: "Този престой вече не съществува, затова екстрата не е добавена.",
      extraGone: "Тази повтаряща се екстра вече не съществува. Презаредете сметката и опитайте отново.",
      depositAmount: "Въведете сума на депозита над нула.",
      depositType: "Изберете активен вид депозит, преди да го приемете.",
      closedDeposit: "Сметката е затворена, затова депозит не е приет. Първо я отворете отново.",
      depositDeclined: "Плащането на депозита с карта е отказано. Нищо не е записано в сметката.",
      closedApply: "Сметката е затворена, затова депозитът не е приспаднат. Първо я отворете отново.",
      noHeldToApply: "Няма задържан депозит, който да се приспадне от дължимото.",
      closedRefund: "Сметката е затворена, затова депозитът не е върнат. Първо я отворете отново.",
      noHeldToRefund: "Няма задържан депозит за връщане.",
      refundFailed: "Връщането по картата не успя при платежния доставчик. Нищо не е записано в сметката.",
      splitGone: "Тази допълнителна сметка вече не съществува. Презаредете престоя и опитайте отново.",
      primaryStays: "Основната сметка е сметката на престоя и не може да бъде премахната.",
      closedIsRecord: "Затворената сметка е финансов документ и не може да бъде премахната.",
      splitHasLines: "Преместете или анулирайте всеки активен ред в тази сметка, преди да я премахнете.",
      notAResolution: "Това не е един от четирите начина за уреждане на сметка. Презаредете страницата и опитайте отново.",
      folioGone: "Тази сметка вече не съществува за този престой. Презаредете страницата.",
      stillOpen: "Сметката е още отворена. Запишете плащането директно в нея или първо я затворете — тези четири начина са за сметка, затворена с неплатено салдо.",
      moveChoice: "Изберете един от наличните начини за уреждане на разликата от преместването.",
      noMoveDifference: "За това преместване няма неуредена разлика в цената.",
      noOpenFolioForMove: "Престоят няма отворена сметка, затова сумата от преместването не е записана. Първо отворете сметката отново.",
      lineGone: "Този ред вече не съществува. Презаредете престоя и опитайте отново.",
      voidedCannotMove: "Анулиран ред не може да бъде преместен в друга сметка.",
      paymentsStay: "Плащанията остават в сметката, в която са записани, и не могат да се преместват.",
      chooseOpenFolio: "Изберете отворена сметка от същия престой, преди да преместите реда.",
      alreadyVoided: "Този ред вече е анулиран.",
      accommodationAuthoritative: "Нощувките идват от резервацията и не могат да бъдат анулирани от сметката.",
    },
    units: {
      needTypeAndNumber: "Стаята има нужда от тип и номер, преди да бъде добавена.",
      typeGone: "Този тип стая вече не съществува — някой го е премахнал, докато страницата е била отворена.",
      pickType: "Първо изберете тип стая.",
      howMany: "Посочете колко стаи да се създадат — число над нула.",
      roomGone: "Тази стая вече не съществува — някой я е премахнал, докато страницата е била отворена.",
      notHkStatus: "Това не е статус на хаускийпинга. Презаредете страницата и опитайте отново.",
      sayWhatIsWrong: "Опишете какво не е наред със стаята, за да знае поддръжката какво да носи.",
      pickRooms: "Отметнете стаите, които са на този етаж.",
    },
    workforce: {
      delegatorsOnly: "Само управител, старши служител или рецепцията може да започва и приключва смяна на друг.",
      inactive: (n) => `${n} вече няма активен профил, затова не може да започне смяна.`,
      thatPerson: "Този служител",
    },
    support: {
      expired: "Сесията Ви е изтекла. Влезте отново и изпратете още веднъж.",
      unknownRequest: "Запитването не може да бъде разпознато. Презаредете страницата.",
    },
    maintenance: { notAStatus: "Това не е статус, в който може да бъде задача. Презаредете страницата и опитайте отново." },
    guests: { managersMerge: "Обединяването на записи за гости е работа на управителя — помолете го да го направи." },
    trial: {
      ownersOnly: "Само собственикът или администратор може да решава за какво плаща профилът. Помолете някого от тях.",
      unknownProduct: "Непознат продукт.",
      noTrial: "Тук няма активен пробен период, който да запазите. Презаредете страницата — може вече да е приключил.",
      couldNotStart: "Пробният период не можа да започне.",
    },
  },
};
