import { redirect } from "next/navigation";

/**
 * The old focus-mode address of an email. The editor now lives inside Settings → Guest emails, the
 * same place in all three products; links and bookmarks to this address still arrive there.
 */
export default async function OldEmailEditor({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { key } = await params;
  const { lang } = await searchParams;
  redirect(`/settings/emails/${encodeURIComponent(key)}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`);
}
