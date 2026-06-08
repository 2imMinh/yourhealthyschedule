# Database Design — AI Healthy Scheduler

**Document type:** Production database schema & design rationale
**Engine:** PostgreSQL · **ORM:** Prisma
**Version:** 1.0
**Companion file:** `schema.prisma` (drop-in ready)

Covers: Users · Tasks · Deadlines · Schedules · Activities · Sleep tracking · Meal tracking · Workout tracking · Historical productivity · Premium subscriptions · Analytics.

---

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o| USER_PROFILE : has
    USER ||--o{ TASK : owns
    USER ||--o{ DAILY_SCHEDULE : owns
    USER ||--o{ SLEEP_LOG : logs
    USER ||--o{ MEAL_LOG : logs
    USER ||--o{ WORKOUT_LOG : logs
    USER ||--o{ COMPLETION_LOG : records
    USER ||--o{ PRODUCTIVITY_PROFILE : has
    USER ||--o{ PREDICTION : has
    USER ||--o{ OVERLOAD_EVENT : triggers
    USER ||--o{ REMINDER : has
    USER ||--o{ DAILY_STAT : aggregates
    USER ||--o| SUBSCRIPTION : has
    USER ||--o{ PAYMENT : makes

    TASK ||--o{ SCHEDULE_BLOCK : allocated_to
    TASK ||--o{ REMINDER : triggers
    DAILY_SCHEDULE ||--o{ SCHEDULE_BLOCK : contains
    SCHEDULE_BLOCK ||--o| COMPLETION_LOG : produces

    USER {
        string id PK "Clerk id"
        string email UK
        string timezone
        enum subscriptionTier
        timestamptz deletedAt "soft delete"
    }
    USER_PROFILE {
        string userId FK_UK
        string wakeTime
        string sleepTime
        decimal minSleepHours
        json workBlocks
    }
    TASK {
        string id PK
        string userId FK
        int estimatedMinutes
        timestamptz deadline
        enum priority
        enum status
    }
    DAILY_SCHEDULE {
        string id PK
        string userId FK
        date date "unique per user"
        enum mode
        bool isOverloaded
    }
    SCHEDULE_BLOCK {
        string id PK
        string scheduleId FK
        string taskId FK "nullable"
        enum activityType
        timestamptz startTime
        timestamptz endTime
    }
    COMPLETION_LOG {
        string id PK
        string blockId FK_UK
        enum status
        enum activityType "denormalized"
        timestamptz completedAt
    }
    SLEEP_LOG {
        string id PK
        string userId FK
        date date "unique per user"
        int durationMin
        smallint qualityScore
    }
    MEAL_LOG {
        string id PK
        string userId FK
        date date
        enum mealType
        enum source
    }
    WORKOUT_LOG {
        string id PK
        string userId FK
        date date
        enum type
        enum intensity
    }
    PRODUCTIVITY_PROFILE {
        string id PK
        string userId FK
        smallint timeBucket
        decimal completionRate
    }
    PREDICTION {
        string id PK
        string userId FK
        date targetDate "unique per user"
        json predictedWindows
    }
    DAILY_STAT {
        string id PK
        string userId FK
        date date "unique per user"
        json minutesByActivity
        decimal healthAdherenceRate
    }
    SUBSCRIPTION {
        string id PK
        string userId FK_UK
        enum status
        string stripeSubscriptionId UK
    }
    PAYMENT {
        string id PK
        string userId FK
        int amountCents
        string status
    }
    REMINDER {
        string id PK
        string userId FK
        string taskId FK
        timestamptz remindAt
        timestamptz sentAt
    }
    OVERLOAD_EVENT {
        string id PK
        string userId FK
        date date
        timestamptz triggeredAt
    }
```

---

## 2. Prisma Schema

The complete, drop-in schema is in the companion file **`schema.prisma`**. Highlights of the production conventions baked in:

- **Timezone correctness:** every instant is `@db.Timestamptz`; a user's logical calendar day is `@db.Date`. This avoids the classic "off-by-one-day" bug when users travel or cross DST.
- **Precise numerics:** rates use `Decimal(5,4)` (0.0000–1.0000), sleep targets `Decimal(3,1)`, money in integer cents — never floats for money or rates.
- **Soft deletes:** `User` and `Task` carry `deletedAt` for safe deletion + GDPR workflows, with supporting indexes.
- **Cascade integrity:** all user-owned rows `onDelete: Cascade` from `User`; `ScheduleBlock.task` uses `onDelete: SetNull` so deleting a task doesn't destroy schedule history.
- **Pooling-ready datasource:** `url` (pooled / PgBouncer) + `directUrl` (migrations) — the standard production split for serverless/edge backends.

(Design decision on "Deadlines": a deadline is modeled as a first-class attribute of `Task` plus a `Reminder` entity for notifications, rather than a free-floating table — a deadline with no associated task is just a calendar event and adds no relational value.)

---

## 3. Indexes

Indexes are chosen from the *actual query patterns* the app issues, not added speculatively (every index is write-cost the scheduler pays on hot tables).

| Table | Index | Query it serves |
|-------|-------|-----------------|
| User | `@unique(email)` | login/lookup; `(deletedAt)` for active-user filters |
| Task | `(userId, status, deadline)` | **scheduler input** — open tasks by urgency; the single most important index |
| Task | `(userId, deadline)` | deadline views & reminders |
| DailySchedule | `@unique(userId, date)` + `(userId, date)` | fetch/upsert today; week range scans |
| ScheduleBlock | `(scheduleId)`, `(taskId)`, `(activityType)` | render a day; trace a task's blocks; activity grouping |
| CompletionLog | `(userId, completedAt)`, `(userId, activityType, completedAt)` | analytics time-range + per-activity rollups |
| SleepLog / MealLog / WorkoutLog | `@unique`/`(userId, date)` + `(userId, type, date)` | per-day tracking views & trend charts |
| ProductivityProfile | `@unique(userId, timeBucket, weekday)` | upsert per bucket; prediction lookups |
| Prediction | `@unique(userId, targetDate)` | one prediction per day per user |
| OverloadEvent | `(userId, triggeredAt)` | **48h-rule** window check |
| DailyStat | `@unique(userId, date)` + `(userId, date)` | dashboard weekly/monthly range scans |
| Subscription | `(status, currentPeriodEnd)` | renewal / dunning workers |
| Reminder | `(remindAt, sentAt)` | worker polls due, unsent reminders |
| Payment | `(userId, createdAt)` | billing history |

**Composite-index ordering follows the equality-then-range rule:** equality columns (`userId`, `status`) first, the range column (`deadline`, `completedAt`, `date`) last, so Postgres can seek then scan.

**Applied via raw SQL in migrations (Prisma can't express these):**
- *Partial indexes* on soft-deleted tables, e.g. `CREATE INDEX ... ON "Task"(...) WHERE "deletedAt" IS NULL;` — keeps the index small and excludes dead rows.
- *BRIN* indexes on append-only, time-ordered tables (`CompletionLog`, `DailyStat`) — tiny footprint, ideal for date-range scans on naturally clustered data.
- *GIN* indexes on `Json` columns only if you start querying inside them (e.g. `minutesByActivity`).

---

## 4. Relationships

**Cardinalities**
- **User 1—1 UserProfile / Subscription** (optional on the "one" side until created).
- **User 1—* Task, DailySchedule, SleepLog, MealLog, WorkoutLog, CompletionLog, ProductivityProfile, Prediction, OverloadEvent, Reminder, DailyStat, Payment.**
- **DailySchedule 1—* ScheduleBlock.**
- **Task 1—* ScheduleBlock** (a long task spans multiple blocks/days) and **Task 1—* Reminder.**
- **ScheduleBlock 1—0..1 CompletionLog** (a block is checked off at most once).

**Integrity rules**
- Deleting a `User` cascades to every owned row (clean erasure).
- Deleting a `Task` cascades its `Reminder`s but **nulls** `ScheduleBlock.taskId` — historical schedules and their completion logs survive for analytics.
- `@@unique([userId, date])` on `DailySchedule`, `SleepLog`, `DailyStat`, and `Prediction.(userId, targetDate)` enforces "one per day per user" at the database layer, so a race between two requests can't create duplicates.
- `activityType` is **denormalized** onto `CompletionLog` (copied from its block) so analytics group by activity without joining back to `ScheduleBlock` — a deliberate read-optimization on the hottest analytics path.

---

## 5. Optimization Suggestions

**Read path (analytics is the heaviest reader)**
- **Pre-aggregate, don't scan.** `DailyStat` is the cornerstone: a nightly worker (and incremental updates on each completion) rolls raw logs into one row per user per day. Weekly/monthly charts then scan ~7–31 small rows instead of thousands of `CompletionLog` rows. Build weekly/monthly views as **materialized views** refreshed on a schedule if you need them server-side.
- **Covering indexes** for the dashboard: add an index that includes the columns the chart needs so Postgres serves the query index-only.

**Time-series growth (the tables that explode)**
- `CompletionLog`, `SleepLog`, `MealLog`, `WorkoutLog`, and `DailyStat` grow ~linearly with active users × days. **Partition by range on `date` (monthly)** once any exceeds tens of millions of rows. Partitioning keeps indexes small, makes range queries prune to a few partitions, and turns data archival into a cheap `DETACH PARTITION`.
- Pair partitioning with **BRIN indexes** on the date column — far smaller than B-tree for append-only, time-ordered data.

**Write path & concurrency**
- Use **`upsert`** keyed on the unique day constraints for schedules/stats/sleep so re-generation is idempotent.
- Keep hot-table index count lean (the scheduler writes many `ScheduleBlock`s per generation). Drop any index not backing a real query.
- Use **transactions** when generating a schedule (delete old blocks + insert new + write stat) so a day is never half-rendered.

**Connection & scaling**
- Front Postgres with **PgBouncer** (transaction pooling) — essential for serverless/edge backends that open many short-lived connections; that's why the datasource has `url` (pooled) + `directUrl` (migrations).
- Add **read replicas** at the 100k-user tier and route analytics/dashboard reads to them, keeping the primary for writes and the scheduler.
- Set sane **statement timeouts** and use Prisma's `relationLoadStrategy`/`select` to avoid over-fetching (never `include` whole trees for list views).

**Data lifecycle & cost**
- **Archive** completion/tracking data older than your analytics horizon (e.g. 13 months) to cold storage; detach old partitions rather than `DELETE` (no bloat, no vacuum storm).
- Schedule routine **`VACUUM`/`ANALYZE`** (autovacuum tuned for high-churn tables) and monitor index bloat.
- Store large/flexible blobs (`workBlocks`, `predictedWindows`, `minutesByActivity`) as `Json`/JSONB — but only index inside them with GIN when you actually filter on their contents.

**Integrity & safety**
- Enforce business rules the DB can guarantee at the DB: unique-per-day constraints, FK cascades, `CHECK` constraints (add via raw SQL) such as `estimatedMinutes > 0`, `qualityScore BETWEEN 1 AND 5`, `endTime > startTime`.
- Keep migrations forward-only and reviewed; never let Prisma `db push` touch production.

---

*End of Database Design v1.0.*
