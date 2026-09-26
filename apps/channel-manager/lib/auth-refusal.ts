import { PASSWORD_MIN_LENGTH, type AuthRefusalCode } from "@revio/core";
import { authRefusalStrings } from "@revio/ui/auth-strings";
import { fill, formatNumber, translate, type Locale } from "@revio/ui/i18n";

/**
 * A refused link or password, in the reader's language — from core's stable code, never by matching
 * the English sentence. Falls back to core's own message for a code this build does not know.
 */
export function sayAuthRefusal(
  r: { code?: AuthRefusalCode; message: string; count?: number },
  locale: Locale,
): string {
  const said = r.code ? translate(authRefusalStrings, locale)[r.code] : undefined;
  if (!said) return r.message;
  const n = r.code === "password.tooShort" ? PASSWORD_MIN_LENGTH : r.count !== undefined ? formatNumber(r.count, locale) : "";
  return fill(said, { n });
}
