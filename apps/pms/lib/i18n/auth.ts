import type { Translations } from "@revio/ui/i18n";

/**
 * Signing in to RevioPMS — the pages, the forms this product owns, and what the sign-in actions say.
 * `forms` is **strings only**: the forms are client components.
 */
export interface AuthStrings {
  login: {
    meta: string;
    tagline: string;
    headline: string;
    pitch: string;
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
      meta: "Sign in · RevioPMS",
      tagline: "Operations",
      headline: "Run the property. Every room, every day.",
      pitch: "Front desk, housekeeping and folios over the same shared inventory — check a guest in and the whole platform knows.",
      footer: "© Revio · operations",
      title: "Sign in to RevioPMS",
      intro: "Welcome back — run your front desk.",
      emailPlaceholder: "you@hotel.com",
      accessNote: "RevioPMS accounts are created by your hotel's owner or administrator in Staff & Access. If you need access, ask them to invite you.",
      demoLogins: "Demo logins",
      password: "password",
    },
    twoFactor: {
      meta: "Two-factor · RevioPMS",
      tagline: "Property Management",
      headline: "One more step.",
      pitch: "This account can change your rates and read your guests, so a password on its own is not enough to open it.",
      title: "Two-factor authentication",
      intro: "Your password was accepted.",
    },
    forgot: { meta: "Reset your password · RevioPMS", title: "Reset your password", intro: "Enter the email you sign in with and we'll send you a link." },
    invite: { meta: "Set your password · RevioPMS", deadTitle: "Invitation no longer valid", title: "Welcome — set your password", intro: "One login covers every Revio product your hotel uses." },
    reset: { meta: "Choose a new password · RevioPMS", deadTitle: "Link no longer valid", title: "Choose a new password", intro: "Pick something you don't use anywhere else." },
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
      meta: "Вход · RevioPMS",
      tagline: "Операции",
      headline: "Управлявайте обекта. Всяка стая, всеки ден.",
      pitch: "Рецепция, хаускийпинг и сметки върху една обща наличност — настанете гост и цялата платформа го знае.",
      footer: "© Revio · операции",
      title: "Вход в RevioPMS",
      intro: "Добре дошли отново — рецепцията Ви чака.",
      emailPlaceholder: "vie@hotel.bg",
      accessNote: "Профилите в RevioPMS се създават от собственика или администратора на хотела в „Персонал и достъп“. Ако Ви трябва достъп, помолете ги да Ви поканят.",
      demoLogins: "Демо профили",
      password: "парола",
    },
    twoFactor: {
      meta: "Двуфакторна защита · RevioPMS",
      tagline: "Управление на обекта",
      headline: "Още една стъпка.",
      pitch: "Този профил може да променя цените Ви и да вижда гостите Ви, затова само парола не е достатъчна, за да бъде отворен.",
      title: "Двуфакторна защита",
      intro: "Паролата е приета.",
    },
    forgot: { meta: "Нова парола · RevioPMS", title: "Нова парола", intro: "Въведете имейла, с който влизате, и ще Ви изпратим връзка." },
    invite: { meta: "Изберете парола · RevioPMS", deadTitle: "Поканата вече не е валидна", title: "Добре дошли — изберете парола", intro: "Един вход за всички продукти на Revio, които хотелът Ви ползва." },
    reset: { meta: "Изберете нова парола · RevioPMS", deadTitle: "Връзката вече не е валидна", title: "Изберете нова парола", intro: "Изберете парола, която не ползвате никъде другаде." },
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
