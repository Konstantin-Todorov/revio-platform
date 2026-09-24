import type { AuthRefusalCode } from "@revio/core";
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

/**
 * Why a link or a password was refused — keyed by core's `AuthRefusalCode`, so the set-password
 * screens say it in the reader's language (`strings[code] ?? message`). "{n}" is the password
 * minimum, or how many breaches a password appeared in. English is core's own text, held to it
 * word for word by `apps/pms/lib/i18n/product-drift.test.ts`.
 */
export const authRefusalStrings: Translations<Record<AuthRefusalCode, string>> = {
  en: {
    "invite.invalid": "This invitation link is not valid. Ask an owner at your hotel to send another.",
    "handoff.invalid": "That link is not valid any more. Open the product again from your account.",
    "reset.invalid": "This reset link is not valid or has expired. Request a new one.",
    "invite.used": "This invitation has already been used. Try signing in, or ask for a new one.",
    "handoff.used": "That link has already been used. Open the product again from your account.",
    "reset.used": "This link has already been used. Request a new one if you still need to change your password.",
    "invite.expired": "This invitation has expired. Ask an owner at your hotel to send another.",
    "handoff.expired": "That link timed out. Open the product again from your account — it takes a second.",
    "reset.expired": "This link has expired. Password reset links are valid for 1 hour — request a new one.",
    "link.alreadyUsed": "This link has already been used.",
    "link.noAccount": "This link is not attached to an account.",
    "password.tooShort": "Use at least {n} characters.",
    "password.tooLong": "That password is too long — 200 characters maximum.",
    "password.obvious": "That password is too easy to guess. Choose something else.",
    "password.repeated": "That's the same character repeated. Choose something else.",
    "password.sequence": "That's a simple sequence. Choose something less predictable.",
    "password.keyRow": "That's a row of keys. Choose something less predictable.",
    "password.email": "Don't use your email address in your password.",
    "password.breached": "This password has appeared in a known data breach. Please choose a different one.",
    "password.breachedMany": "This password has appeared in {n} known data breaches. Please choose a different one.",
  },
  bg: {
    "invite.invalid": "Тази връзка за покана не е валидна. Помолете собственик във Вашия хотел да изпрати нова.",
    "handoff.invalid": "Тази връзка вече не е валидна. Отворете продукта отново от профила си.",
    "reset.invalid": "Тази връзка за нова парола не е валидна или е изтекла. Поискайте нова.",
    "invite.used": "Тази покана вече е използвана. Опитайте да влезете или поискайте нова.",
    "handoff.used": "Тази връзка вече е използвана. Отворете продукта отново от профила си.",
    "reset.used": "Тази връзка вече е използвана. Поискайте нова, ако все още трябва да смените паролата си.",
    "invite.expired": "Тази покана е изтекла. Помолете собственик във Вашия хотел да изпрати нова.",
    "handoff.expired": "Връзката изтече. Отворете продукта отново от профила си — отнема секунда.",
    "reset.expired": "Тази връзка е изтекла. Връзките за нова парола важат 1 час — поискайте нова.",
    "link.alreadyUsed": "Тази връзка вече е използвана.",
    "link.noAccount": "Тази връзка не е свързана с профил.",
    "password.tooShort": "Използвайте поне {n} знака.",
    "password.tooLong": "Паролата е твърде дълга — най-много 200 знака.",
    "password.obvious": "Тази парола се отгатва твърде лесно. Изберете друга.",
    "password.repeated": "Това е един и същ знак, повторен. Изберете друга.",
    "password.sequence": "Това е проста поредица. Изберете нещо по-трудно за отгатване.",
    "password.keyRow": "Това е ред от клавиатурата. Изберете нещо по-трудно за отгатване.",
    "password.email": "Не използвайте имейл адреса си в паролата.",
    "password.breached": "Тази парола се е появявала в известно изтичане на данни. Моля, изберете друга.",
    "password.breachedMany": "Тази парола се е появявала в {n} известни изтичания на данни. Моля, изберете друга.",
  },
};
