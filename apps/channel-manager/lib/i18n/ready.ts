/**
 * Whether RevioLink renders in the reader's language yet.
 *
 * Translated screen by screen, like RevioCRS before it: a Bulgarian reader must never meet a screen
 * that is half Bulgarian and half English. Until every dictionary is complete this stays `false`
 * and RevioLink renders English for everyone, whatever `User.locale` says; the dictionaries ship,
 * wired, and change nothing.
 *
 * `CM_I18N_PREVIEW=1` turns it on for one process — how the translation is looked at on a laptop
 * before it is switched on for everyone.
 */
export const CM_TRANSLATED = false;

export function translationOn(): boolean {
  return CM_TRANSLATED || process.env.CM_I18N_PREVIEW === "1";
}
