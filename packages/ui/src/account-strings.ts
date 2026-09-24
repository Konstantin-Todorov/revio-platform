import type { Translations } from "./i18n";

/**
 * Your own account — two-factor and "sign out everywhere", the same in every product.
 * **Strings only** (`{name}` placeholders); `TwoFactorSetup` is a client component.
 */
export interface AccountStrings {
  twoFactor: {
    reason: string;
    fileTitle: string;
    fileGenerated: string;
    fileNote: [string, string, string];
    onTitle: string;
    saveCodesBefore: string;
    onlyTime: string;
    saveCodesAfter: string;
    copyAll: string;
    download: string;
    onForYou: string;
    passwordToTurnOff: string;
    turnOff: string;
    preparing: string;
    setUp: string;
    scan: string;
    qrAlt: string;
    byHand: string;
    code: string;
    checking: string;
    confirm: string;
    /** Keyed by `TwoFactorErrorCode` from `@revio/db`, plus what the app-side actions refuse. */
    errors: Record<
      "no_pending" | "setup_mismatch" | "not_set_up" | "mismatch" | "reused" | "enter_code" | "recovery_used"
      | "signInAgain" | "enterPassword" | "wrongPassword",
      string
    >;
  };
  signOut: {
    /** "{products}" is filled with the products this hotel runs. */
    body: string;
    and: string;
    here: string;
    button: string;
  };
}

export const accountStrings: Translations<AccountStrings> = {
  en: {
    twoFactor: {
      reason: "A password on its own can be guessed, reused or stolen. Two-factor adds a code from your phone, so knowing the password is not enough.",
      fileTitle: "{product} — two-factor recovery codes",
      fileGenerated: "Generated {date}",
      fileNote: [
        "Each code works ONCE. Use one in place of the six-digit code if you lose",
        "access to your authenticator app. Keep this file somewhere other than the",
        "phone the app is on.",
      ],
      onTitle: "Two-factor authentication is on",
      saveCodesBefore: "Save these recovery codes somewhere other than the phone with your authenticator app. Each one works once, and",
      onlyTime: "this is the only time they are shown",
      saveCodesAfter: "— only their hashes are kept.",
      copyAll: "Copy all",
      download: "Download .txt",
      onForYou: "Two-factor authentication is on for your account",
      passwordToTurnOff: "Your password, to turn it off",
      turnOff: "Turn off",
      preparing: "Preparing…",
      setUp: "Set up two-factor",
      scan: "Scan this with your authenticator app, then enter the code it shows to confirm it works.",
      qrAlt: "Two-factor QR code",
      byHand: "Or enter this key by hand",
      code: "Code from your app",
      checking: "Checking…",
      confirm: "Confirm and turn on",
      errors: {
        no_pending: "Start again — there is no pending setup for this account.",
        setup_mismatch: "That code didn't match. Check your authenticator app and try the current code.",
        not_set_up: "Two-factor authentication is not set up for this account.",
        mismatch: "That code didn't match. Try the current one from your app.",
        reused: "That code has already been used. Wait for the next one.",
        enter_code: "Enter the six-digit code from your app, or a recovery code.",
        recovery_used: "That recovery code has already been used.",
        signInAgain: "Sign in again.",
        enterPassword: "Enter your password to turn two-factor off.",
        wrongPassword: "That password is not right.",
      },
    },
    signOut: {
      body: "Ends your session on every device — phones, tablets and any browser you have left signed in, across {products}. Use it if you have lost a device or think someone else has your password.",
      and: "and",
      here: "You will be signed out here too, and can sign back in straight away.",
      button: "Sign out everywhere",
    },
  },
  bg: {
    twoFactor: {
      reason: "Паролата сама по себе си може да бъде отгатната, използвана повторно или открадната. Двуфакторната защита добавя код от телефона Ви, така че не стига да се знае паролата.",
      fileTitle: "{product} — резервни кодове за двуфакторна защита",
      fileGenerated: "Създадени на {date}",
      fileNote: [
        "Всеки код работи САМО ВЕДНЪЖ. Използвайте го вместо шестцифрения код, ако",
        "загубите достъп до приложението за удостоверяване. Пазете този файл",
        "другаде, не на телефона с приложението.",
      ],
      onTitle: "Двуфакторната защита е включена",
      saveCodesBefore: "Запазете тези резервни кодове другаде, не на телефона с приложението за удостоверяване. Всеки работи веднъж и",
      onlyTime: "това е единственият път, в който се показват",
      saveCodesAfter: "— пазим само хешовете им.",
      copyAll: "Копирай всички",
      download: "Изтегли .txt",
      onForYou: "Двуфакторната защита е включена за Вашия профил",
      passwordToTurnOff: "Вашата парола, за да я изключите",
      turnOff: "Изключи",
      preparing: "Подготовка…",
      setUp: "Включи двуфакторна защита",
      scan: "Сканирайте кода с приложението за удостоверяване и въведете показания код, за да потвърдите, че работи.",
      qrAlt: "QR код за двуфакторна защита",
      byHand: "Или въведете ключа ръчно",
      code: "Код от приложението",
      checking: "Проверка…",
      confirm: "Потвърди и включи",
      errors: {
        no_pending: "Започнете отначало — за този профил няма започнато включване.",
        setup_mismatch: "Кодът не съвпада. Проверете приложението за удостоверяване и въведете текущия код.",
        not_set_up: "Двуфакторната защита не е включена за този профил.",
        mismatch: "Кодът не съвпада. Въведете текущия код от приложението.",
        reused: "Този код вече е използван. Изчакайте следващия.",
        enter_code: "Въведете шестцифрения код от приложението или резервен код.",
        recovery_used: "Този резервен код вече е използван.",
        signInAgain: "Влезте отново.",
        enterPassword: "Въведете паролата си, за да изключите двуфакторната защита.",
        wrongPassword: "Паролата не е вярна.",
      },
    },
    signOut: {
      body: "Прекратява сесията Ви на всички устройства — телефони, таблети и всеки браузър, в който сте останали влезли, в {products}. Използвайте го, ако сте загубили устройство или смятате, че някой друг знае паролата Ви.",
      and: "и",
      here: "Ще излезете и тук и можете веднага да влезете отново.",
      button: "Изход от всички устройства",
    },
  },
};
