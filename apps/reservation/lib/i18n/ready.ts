/**
 * Whether RevioCRS renders in the reader's language yet.
 *
 * RevioCRS is being translated screen by screen, and a Bulgarian reader must never meet a screen that
 * is half Bulgarian and half English — the founder's bar is "without gaps". So until every screen's
 * dictionary is complete this stays `false` and RevioCRS renders English for everyone, whatever
 * `User.locale` says; the dictionaries ship, wired, and change nothing.
 *
 * `CRS_I18N_PREVIEW=1` turns it on for one process — how the translation is looked at on a laptop
 * before it is switched on for everyone.
 */
export const CRS_TRANSLATED = false;

export function translationOn(): boolean {
  return CRS_TRANSLATED || process.env.CRS_I18N_PREVIEW === "1";
}
