import type { Translations } from "@revio/ui/i18n";

/**
 * Signing in to RevioLink — the pages, the forms this product owns, and what the sign-in actions say.
 * `forms` is **strings only**: the forms are client components.
 */
export interface AuthStrings {
  login: {
    meta: string;
    tagline: string;
    headline: string;
    pitch: string;
    /** Three short facts under the pitch: the number, then what it counts. */
    facts: [string, string][];
    footer: string;
    title: string;
    intro: string;
    emailPlaceholder: string;
    accessNote: string;
    demoLogins: string;
    password: string;
  };
  twoFactor: {
    meta: string;
    tagline: string;
    headline: string;
    pitch: string;
    title: string;
    intro: string;
  };
  forgot: { meta: string; title: string; intro: string };
  invite: { meta: string; deadTitle: string; title: string; intro: string };
  reset: { meta: string; deadTitle: string; title: string; intro: string };
  backToSignIn: string;
  language: string;
  forms: {
    checkEmail: string;
    checkEmailBody: string;
    email: string;
    emailPlaceholder: string;
    sending: string;
    emailMeLink: string;
    code: string;
    codeHint: string;
    checking: string;
    verify: string;
  };
  errors: {
    enterBoth: string;
    invalid: string;
    suspended: string;
    tooLong: string;
    enterCode: string;
    inactive: string;
    mismatch: string;
  };
}

export const auth: Translations<AuthStrings> = {
  en: {
    login: {
      meta: "Sign in · RevioLink",
      tagline: "Channel Manager",
      headline: "One hub. Every channel. Always in sync.",
      pitch: "Push availability, rates and restrictions to every OTA — and pull every booking back — from a single calendar.",
      facts: [["One", "source of truth for availability"], ["Every", "booking pulled back automatically"], ["Zero", "migration to add another product"]],
      footer: "© Revio · hotel distribution",
      title: "Sign in to RevioLink",
      intro: "Welcome back — manage your distribution.",
      emailPlaceholder: "you@hotel.com",
      accessNote: "RevioLink accounts are created by your hotel's owner or administrator in Settings. If you need access, ask them to invite you.",
      demoLogins: "Demo logins",
      password: "password",
    },
    twoFactor: {
      meta: "Two-factor · RevioLink",
      tagline: "Channel Manager",
      headline: "One more step.",
      pitch: "This account can change your rates and read your guests, so a password on its own is not enough to open it.",
      title: "Two-factor authentication",
      intro: "Your password was accepted.",
    },
    forgot: { meta: "Reset your password · RevioLink", title: "Reset your password", intro: "Enter the email you sign in with and we'll send you a link." },
    invite: { meta: "Set your password · RevioLink", deadTitle: "Invitation no longer valid", title: "Welcome — set your password", intro: "One login covers every Revio product your hotel uses." },
    reset: { meta: "Choose a new password · RevioLink", deadTitle: "Link no longer valid", title: "Choose a new password", intro: "Pick something you don't use anywhere else." },
    backToSignIn: "Back to sign in",
    language: "Language",
    forms: {
      checkEmail: "Check your email",
      checkEmailBody: "If that address has an account, a reset link is on its way. It works once and expires in an hour.",
      email: "Email",
      emailPlaceholder: "you@hotel.com",
      sending: "Sending…",
      emailMeLink: "Email me a link",
      code: "Authentication code",
      codeHint: "Open your authenticator app and enter the current six-digit code — it submits on the last digit. You can also use one of your recovery codes.",
      checking: "Checking…",
      verify: "Verify",
    },
    errors: {
      enterBoth: "Enter your email and password.",
      invalid: "Invalid email or password.",
      suspended: "This account is suspended — contact Revio.",
      tooLong: "That took too long — please sign in again.",
      enterCode: "Enter the six-digit code from your app, or a recovery code.",
      inactive: "This account is no longer active — contact your manager.",
      mismatch: "Those two passwords don't match.",
    },
  },
  bg: {
    login: {
      meta: "Вход · RevioLink",
      tagline: "Канален мениджър",
      headline: "Един център. Всеки канал. Винаги синхронизирано.",
      pitch: "Изпращайте наличност, цени и ограничения към всяка OTA — и изтегляйте всяка резервация обратно — от един календар.",
      facts: [["Един", "източник на истината за наличността"], ["Всяка", "резервация се изтегля автоматично"], ["Нула", "миграция при добавяне на друг продукт"]],
      footer: "© Revio · хотелска дистрибуция",
      title: "Вход в RevioLink",
      intro: "Добре дошли отново — управлявайте дистрибуцията си.",
      emailPlaceholder: "vie@hotel.bg",
      accessNote: "Профилите в RevioLink се създават от собственика или администратора на хотела в Настройки. Ако Ви трябва достъп, помолете ги да Ви поканят.",
      demoLogins: "Демо профили",
      password: "парола",
    },
    twoFactor: {
      meta: "Двуфакторна защита · RevioLink",
      tagline: "Канален мениджър",
      headline: "Още една стъпка.",
      pitch: "Този профил може да променя цените Ви и да вижда гостите Ви, затова само парола не е достатъчна, за да бъде отворен.",
      title: "Двуфакторна защита",
      intro: "Паролата е приета.",
    },
    forgot: { meta: "Нова парола · RevioLink", title: "Нова парола", intro: "Въведете имейла, с който влизате, и ще Ви изпратим връзка." },
    invite: { meta: "Изберете парола · RevioLink", deadTitle: "Поканата вече не е валидна", title: "Добре дошли — изберете парола", intro: "Един вход за всички продукти на Revio, които хотелът Ви ползва." },
    reset: { meta: "Изберете нова парола · RevioLink", deadTitle: "Връзката вече не е валидна", title: "Изберете нова парола", intro: "Изберете парола, която не ползвате никъде другаде." },
    backToSignIn: "Обратно към входа",
    language: "Език",
    forms: {
      checkEmail: "Проверете имейла си",
      checkEmailBody: "Ако за този адрес има профил, връзката за нова парола е на път. Тя работи веднъж и изтича след един час.",
      email: "Имейл",
      emailPlaceholder: "vie@hotel.bg",
      sending: "Изпращане…",
      emailMeLink: "Изпрати ми връзка",
      code: "Код за потвърждение",
      codeHint: "Отворете приложението за удостоверяване и въведете текущия шестцифрен код — изпраща се сам при последната цифра. Можете да ползвате и някой от резервните си кодове.",
      checking: "Проверка…",
      verify: "Потвърди",
    },
    errors: {
      enterBoth: "Въведете имейл и парола.",
      invalid: "Грешен имейл или парола.",
      suspended: "Този профил е спрян — свържете се с Revio.",
      tooLong: "Изминало е твърде много време — влезте отново.",
      enterCode: "Въведете шестцифрения код от приложението или резервен код.",
      inactive: "Този профил вече не е активен — свържете се с управителя си.",
      mismatch: "Двете пароли не съвпадат.",
    },
  },
};
