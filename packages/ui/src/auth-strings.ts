import type { Translations } from "./i18n";

/**
 * What the shared sign-in and set-password fields say — in every product.
 *
 * **Strings only**: both components are client components and read this with
 * `translate(authStrings, useLocale())`. A product that renders no `LocaleProvider` gets English,
 * exactly as before, so switching a product to Bulgarian never needs a change here.
 */
export interface AuthFieldStrings {
  email: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  capsLock: string;
  remember: string;
  passwordSaved: string;
  signingIn: string;
  signIn: string;
  forgot: string;
  setPassword: {
    yourEmail: string;
    newPassword: string;
    /** "{n}" is the minimum length. */
    atLeast: string;
    moreOne: string;
    /** "{n} more characters." */
    moreMany: string;
    confirm: string;
    typeAgain: string;
    mismatch: string;
    match: string;
    saving: string;
    saveInvite: string;
    saveReset: string;
    nextInvite: string;
    nextReset: string;
  };
}

export const authStrings: Translations<AuthFieldStrings> = {
  en: {
    email: "Email",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    capsLock: "Caps Lock is on.",
    remember: "Keep me signed in on this device",
    passwordSaved: "Password saved. Sign in with it now.",
    signingIn: "Signing in…",
    signIn: "Sign in",
    forgot: "Forgot your password?",
    setPassword: {
      yourEmail: "Your email",
      newPassword: "New password",
      atLeast: "At least {n} characters",
      moreOne: "1 more character.",
      moreMany: "{n} more characters.",
      confirm: "Confirm password",
      typeAgain: "Type it again",
      mismatch: "These don't match yet.",
      match: "Passwords match.",
      saving: "Saving…",
      saveInvite: "Save password and continue",
      saveReset: "Change my password",
      nextInvite: "You'll sign in with this on the next screen. Let your browser save it.",
      nextReset: "You'll be asked to sign in again with the new password.",
    },
  },
  bg: {
    email: "Имейл",
    password: "Парола",
    showPassword: "Покажи паролата",
    hidePassword: "Скрий паролата",
    capsLock: "Caps Lock е включен.",
    remember: "Запомни ме на това устройство",
    passwordSaved: "Паролата е запазена. Влезте с нея сега.",
    signingIn: "Влизане…",
    signIn: "Вход",
    forgot: "Забравена парола?",
    setPassword: {
      yourEmail: "Вашият имейл",
      newPassword: "Нова парола",
      atLeast: "Поне {n} знака",
      moreOne: "Още 1 знак.",
      moreMany: "Още {n} знака.",
      confirm: "Потвърдете паролата",
      typeAgain: "Въведете я отново",
      mismatch: "Паролите още не съвпадат.",
      match: "Паролите съвпадат.",
      saving: "Запазване…",
      saveInvite: "Запази паролата и продължи",
      saveReset: "Смени паролата ми",
      nextInvite: "На следващия екран ще влезете с нея. Позволете на браузъра да я запомни.",
      nextReset: "Ще трябва да влезете отново с новата парола.",
    },
  },
};
