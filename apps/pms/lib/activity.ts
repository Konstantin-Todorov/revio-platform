import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { addDaysYmd, utcDay, todayInTz } from "./format";

export interface ActivityRow {
  id: string;
  at: Date;
  /** The person, when the entry names one. Older entries name nobody — see `getActivity`. */
  actor: string | null;
  entity: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  channelCode: string | null;
}

export interface ActivityPage {
  rows: ActivityRow[];
  /** Entries in range that were hidden as automatic — shown as a count so nothing is silently dropped. */
  hiddenAutomatic: number;
  /** True when there are older entries than the page shows. */
  more: boolean;
  from: string;
  to: string;
  actors: { id: string; name: string }[];
  /** How many entries in range name nobody. Honest about the gap rather than showing blanks. */
  unattributed: number;
}

const PAGE = 200;

/**
 * Automatic machine chatter, excluded by default.
 *
 * 12,037 of the 12,680 audit entries at the time of writing are channel syncs — 95%. They have
 * their own screen in RevioLink, where they are the subject rather than the noise, and left in here
 * they bury every human action under a wall of identical rows. Hidden, but COUNTED: a filter that
 * silently drops most of the data teaches people not to trust the screen.
 */
function isAutomatic(entity: string, source: string): boolean {
  return source === "api" || entity === "Channel sync";
}

/**
 * The property's change log — who did what, and when.
 *
 * The data has been written since June from 24 different files; nothing has ever shown it to a
 * hotel. The first question after "this looks wrong" is "who changed it", and until now the answer
 * lived only in the database.
 */
export async function getActivity(opts: {
  from?: string;
  to?: string;
  actorId?: string;
  includeAutomatic?: boolean;
}): Promise<ActivityPage> {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const to = ISO.test(opts.to ?? "") ? opts.to! : today;
  // A week, because this screen answers "what happened recently"; the range widens on demand.
  const from = ISO.test(opts.from ?? "") ? opts.from! : addDaysYmd(to, -6);

  const where = {
    propertyId: property.id,
    createdAt: { gte: utcDay(from), lt: utcDay(addDaysYmd(to, 1)) },
    ...(opts.actorId ? { userId: opts.actorId } : {}),
  };

  const [all, users] = await Promise.all([
    prisma.auditEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // One over the page, to know whether there is more without counting the whole table.
      take: PAGE + 1,
      select: {
        id: true, createdAt: true, userId: true, entity: true, field: true,
        oldValue: true, newValue: true, source: true, channelCode: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId: property.tenantId },
      select: { id: true, name: true },
    }),
  ]);

  /*
   * The automatic rows are filtered AFTER the query, not in it.
   *
   * Doing it in SQL would need `take` to mean "200 human entries", which it cannot — a page of 200
   * that is 95% sync noise comes back nearly empty. Reading a page and filtering keeps the query
   * bounded; the trade is that a very noisy window shows fewer than 200 rows, which the count of
   * hidden entries then explains.
   */
  const filtered = opts.includeAutomatic ? all : all.filter((e) => !isAutomatic(e.entity, e.source));
  const rows = filtered.slice(0, PAGE);
  const byUser = new Map(users.map((u) => [u.id, u.name]));

  return {
    rows: rows.map((e) => ({
      id: e.id,
      at: e.createdAt,
      actor: e.userId ? (byUser.get(e.userId) ?? "a removed account") : null,
      // Truncated: `entity` has had raw error payloads written into it, and this is rendered.
      entity: e.entity.slice(0, 120),
      field: e.field?.slice(0, 120) ?? null,
      oldValue: e.oldValue?.slice(0, 200) ?? null,
      newValue: e.newValue?.slice(0, 200) ?? null,
      source: e.source,
      channelCode: e.channelCode,
    })),
    hiddenAutomatic: opts.includeAutomatic ? 0 : all.length - filtered.length,
    more: filtered.length > PAGE || all.length > PAGE,
    from, to,
    actors: users.sort((a, b) => a.name.localeCompare(b.name)),
    unattributed: rows.filter((r) => r.userId === null).length,
  };
}
