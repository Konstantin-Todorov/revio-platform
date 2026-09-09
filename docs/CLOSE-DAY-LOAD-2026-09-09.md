# Close Day load and timeout verification — 2026-09-09

## Outcome

The current 15-second interactive-transaction budget is comfortable in this local test up to a
200-room fully occupied hotel, including folios carrying 50 historical lines per room. A synthetic
500-room hotel also completed correctly, but the heaviest close took **10.9 seconds**. That leaves
too little evidence to claim comfortable 500-room production capacity: network latency, database
load and smaller Railway resources are not represented by a loopback test.

No runtime change is justified for the current pilot. Do not increase the timeout just to create a
larger-looking margin: Close Day deliberately holds one correctness transaction, so a larger budget
also permits longer locks. Before onboarding a roughly 500-room property, profile this path against
a production-like database and reduce/batch its repeated folio work. Duration telemetry should warn
at 10 seconds and alert before the 15-second boundary.

## What was proved

- PostgreSQL 16.14 on loopback; fresh database built from all 106 migrations.
- Tests connected as a dedicated `NOSUPERUSER NOBYPASSRLS` role. The suite refuses a privileged
  connection, so RLS was exercised rather than bypassed accidentally.
- 50, 200 and 500 occupied rooms, each closed across three consecutive business dates.
- Two states per size: missing folios, and existing folios with 50 historical charge lines per room.
- Exact charge counts, totals, unique idempotency refs, one audit per close and same-date retry
  refusal were asserted for every case.
- External channel delivery was mocked and excluded from the measurements because it runs after
  the database commit.
- An injected 16-second database sleep exercised the real 15-second Prisma transaction budget.
  Every write rolled back, the business date stayed unchanged, no audit or channel push survived,
  and an immediate retry completed exactly once.

## Transaction timings

The values below measure `runCloseDay` only; synthetic fixture creation is excluded. They are local
wall-clock measurements, not a production capacity guarantee.

| Occupied rooms | Existing folios | Historical lines | First close | Second close | Third close |
| ---: | :---: | ---: | ---: | ---: | ---: |
| 50 | No | 0 | 416 ms | 109 ms | 91 ms |
| 200 | No | 0 | 1,360 ms | 301 ms | 277 ms |
| 500 | No | 0 | 5,505 ms | 2,052 ms | 3,442 ms |
| 50 | Yes | 2,500 | 213 ms | 186 ms | 191 ms |
| 200 | Yes | 10,000 | 4,033 ms | 3,459 ms | 3,251 ms |
| 500 | Yes | 25,000 | 10,932 ms | 8,731 ms | 7,956 ms |

The missing-folio first close creates an accommodation line plus the due extras. The warm case
already contains the accommodation charge and stresses the open-balance scan with historical data.

## Amount and idempotency checks

After three closes, each missing-folio room had exactly five lines and **46,600 minor units**:
40,000 accommodation + 3,000 per-stay transfer + three 1,200 nightly breakfasts. Each warm folio had
those four new extra lines plus its 51 seeded lines, for **51,600 minor units**. Each room produced
exactly four unique accrual refs; a second close of the same date was rejected.

For the forced-timeout case, PostgreSQL returned control after 18.6 seconds: an interactive timeout
is observed when the sleeping statement returns, not as a database `statement_timeout`. Despite
that delay, rollback was complete. Retrying the 200-room close produced 600 lines, 400 due extras,
one audit and the exact total of 8,840,000 minor units.

## Reproduction

The opt-in cases live in `apps/pms/lib/close-day-db.test.ts`. They require all three database URLs to
point to the explicitly named loopback database `close_day_verify_utf8` and run only when
`CLOSE_DAY_LOAD=1`. Normal unit and CI runs skip the large fixtures and deliberate 16-second sleep.
