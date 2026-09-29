"use client";

import { useMemo } from "react";
import { useLocale } from "@revio/ui/i18n-context";
import { guestKit } from "./kit";

/** `guestKit` for a client component, in the language the page's provider carries. */
export function useGuestKit() {
  const locale = useLocale();
  return useMemo(() => guestKit(locale), [locale]);
}
