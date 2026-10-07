/**
 * How to reach Revio — one source for every product, every email and the operator console.
 *
 * Two numbers with two jobs, always shown with their job, so a hotel calls the right one:
 * customers (sales, contracts, invoices) and technical support. One display style: +359 XXX XXX XXX.
 * The marketing site keeps its own copy in `revio-websites/src/config/site.ts` — a separate
 * repository — so a change here is a change there too.
 */
export const REVIO_CONTACT = {
  email: "office@reviosoft.app",
  phones: {
    clients: { tel: "+359886090008", display: "+359 886 090 008", label: { en: "Sales & customers", bg: "Продажби и клиенти" } },
    tech: { tel: "+359894306704", display: "+359 894 306 704", label: { en: "Technical support", bg: "Техническа поддръжка" } },
  },
  social: [
    { name: "Facebook", url: "https://www.facebook.com/reviosoft" },
    { name: "Instagram", url: "https://www.instagram.com/reviosoft/" },
    { name: "Threads", url: "https://www.threads.com/@reviosoft" },
    { name: "LinkedIn", url: "https://www.linkedin.com/company/reviosoft/" },
    { name: "YouTube", url: "https://www.youtube.com/@reviohotel" },
  ],
} as const;
