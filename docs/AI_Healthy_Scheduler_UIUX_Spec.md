# UI/UX Design Specification — AI Healthy Scheduler

**Role:** Senior Product Designer (Notion · Linear lineage)
**Aesthetic:** Modern SaaS · minimalist · Apple-like · clean productivity
**Component system:** shadcn/ui + Tailwind
**Version:** 1.0

> **Note on direction:** this spec targets a cool, neutral, Apple/Linear minimalism. The MVP code currently ships a *warm editorial* theme (Fraunces serif, sage/amber paper). To adopt this spec, only the design tokens in `globals.css` change — swap the warm palette for the neutral one below and the display font from Fraunces to a system/Geist stack. No component code changes.

---

## 0. Design Foundations

**Principles**
1. **Calm by default.** The product's job is to reduce anxiety about time. The UI is quiet: lots of whitespace, one accent color, no decorative noise.
2. **Content over chrome.** Like Notion, the interface recedes; the schedule and tasks are the heroes.
3. **Keyboard-first, fast.** Like Linear, every primary action has a shortcut and a command palette (⌘K). Optimistic updates, instant transitions.
4. **Honest states.** Empty, loading, error, and "this won't fit" states are designed first-class, never afterthoughts.

**Color (light)**
- Background `#FFFFFF`, subtle panel `#F7F7F6`, hover `#F0F0EE`
- Text primary `#191919`, secondary `#6B6B6B`, tertiary `#9A9A9A`
- Border `#EBEBEA` (hairline, 1px)
- Single accent — calm blue `#2F6BFF` (links, primary buttons, focus rings, "now" line)
- Semantic: success `#2E7D5B`, warning `#B9740F`, danger `#C0392B`
- Health-block tint `#EAF3EE`, work tint `#EEF1F7`, task tint `#F4EFFB` (used as faint left-border accents, never loud fills)
- Dark mode: background `#0E0E10`, panel `#161618`, border `#262628`, text `#EDEDED`, same accent.

**Typography** — system/SF stack (`-apple-system, "SF Pro Text", Geist, sans-serif`). Tight tracking on headings.
- Display 28/32 semibold · H1 22/28 · H2 17/24 semibold · Body 14/22 · Small 13/20 · Caption 12/16 muted. Numerals tabular in schedule/analytics.

**Spacing & shape** — 4px base grid; 8/12/16/24/32 rhythm. Radius 8px (cards, inputs), 6px (chips), full (avatars/toggles). Shadows nearly absent — rely on hairline borders; one soft shadow (`0 1px 2px rgba(0,0,0,.04)`) on floating surfaces only.

**Motion** — 120–180ms ease-out for hovers/toggles; 200ms for panel/sheet slides; staggered 40ms reveal on first schedule load. Respect `prefers-reduced-motion`.

**Global shadcn components** — `Button`, `Input`, `Textarea`, `Select`, `Dialog`, `Sheet`, `DropdownMenu`, `Tooltip`, `Tabs`, `Card`, `Badge`, `Switch`, `Slider`, `Calendar`, `Popover`, `Command` (⌘K palette), `Sonner` (toasts), `Skeleton`, `ScrollArea`, `Separator`, `Avatar`, `Progress`, `Alert`.

**App navigation** — collapsible left **Sidebar** (Dashboard, Calendar, Tasks, Analytics, Settings) + minimal **Topbar** (date, "Generate" CTA, ⌘K hint, avatar). Marketing/auth pages have no sidebar.

---

## 1. Landing Page

**Layout.** Single-column, centered, max-width ~1024px. Sticky transparent top nav (logo left; Pricing + Sign in right). Hero (headline + subhead + dual CTA) over a subtle radial gradient wash. Three-up feature row. A "how it works" 3-step strip. Footer.

**Components (shadcn).** `Button` (primary "Start free", ghost "See plans"), `Badge` (eyebrow "Health-first planning"), `Card` ×3 (features), `Separator`, `NavigationMenu` (optional), Clerk `SignedIn/SignedOut` to swap the CTA.

**User flow.** Land → read hero → "Start free" → Clerk sign-up → onboarding (profile) → Dashboard. Returning signed-in users see "Open app" instead and skip to Dashboard.

**Wireframe.**
```
┌──────────────────────────────────────────────┐
│ ◐ Healthy Scheduler            Pricing  [Sign in]│
├──────────────────────────────────────────────┤
│              ·eyebrow badge·                    │
│      Your day, planned around your wellbeing.   │
│   subhead — protect sleep, fit work around it.  │
│        [ Start free ]   [ See plans ]           │
│                                                 │
│   ┌──────┐   ┌──────┐   ┌──────┐                │
│   │feat 1│   │feat 2│   │feat 3│                │
│   └──────┘   └──────┘   └──────┘                │
└──────────────────────────────────────────────┘
```

**Responsive.** ≥1024px: 3-col features, large hero type (clamp 40→64px). 640–1024px: 2-col features, hero ~40px. <640px: single column, full-width stacked CTAs, nav collapses to logo + "Sign in".

---

## 2. Dashboard (Today)

**Layout.** Sidebar + content. Content max-width ~720px (single readable column — the focus surface). Header row: "Today, Mon 4 Jun" + mode pill + `Generate` button. Below: a **vertical time-ordered schedule list** (not a grid) — each block a row with time, activity icon, title, and a completion checkbox. Health blocks carry a faint left tint. A slim **"now" line** marks current time. A collapsible **Insights** strip at top surfaces warnings (sleep <6h, at-risk task, migration notice).

**Components (shadcn).** `Button` (Generate), `Badge` (mode: Standard/Overload/Emergency), `Checkbox` per block, `Card` (each block row, borderless variant), `Alert` (warnings, amber/danger), `Tooltip` (why a task moved), `Skeleton` (loading), `Sonner` (check-off confirmations), `DropdownMenu` (block actions: skip/partial), `Dialog` (Generate options: date, horizon, mode).

**User flow.**
1. First visit (no schedule) → empty state card: "Plan your day" → `Generate`.
2. `Generate` opens a small `Dialog` (date defaults today, horizon 1, mode Standard) → confirm → optimistic skeleton → schedule renders with staggered reveal.
3. Tap a checkbox → block marked complete (optimistic, toast). Task blocks advance the linked task.
4. If `feasible=false` → Insights `Alert`: "3 tasks won't fit before their deadlines" with actions: *Rebalance* (standard re-gen) or *Emergency mode* (premium → upgrade prompt if free).

**Wireframe.**
```
┌── sidebar ─┬─────────────────────────────────────┐
│ Dashboard •│ Today · Mon 4 Jun      [Standard ▾] [Generate]│
│ Calendar   │ ⚠ Sleep is 5h40 tonight — below target.       │
│ Tasks      │ ───────────────────────────────────────────  │
│ Analytics  │ 07:00  ☾ Sleep ends                           │
│ Settings   │ 08:00  ☐ Breakfast                  ·health·  │
│            │ 09:00  ▦ Work block                 ·work·    │
│ ──────     │ 12:30  ☐ Lunch                      ·health·  │
│ ◐ avatar   │ ──now────────────────────────────────────     │
│            │ 14:00  ☐ Finish report (task)       ·task·    │
│            │ 18:00  ☐ Exercise                   ·health·  │
│            │ 23:00  ☐ Wind down → Sleep          ·health·  │
└────────────┴─────────────────────────────────────┘
```

**Responsive.** ≥1024px: sidebar expanded, 720px centered column. 768–1024px: sidebar collapses to icon rail. <768px: sidebar → bottom tab bar (5 icons); header stacks (date row, then full-width Generate); schedule rows full-bleed; checkboxes enlarge to 44px tap targets.

---

## 3. Calendar

**Layout.** Week view default. Top control bar: ‹ Today › range switch (`Tabs`: Day / Week), week label, `Generate` for range. Below: a **7-column day grid** with an hour gutter on the left (06:00–24:00 visible, scrollable to early hours). Blocks render as soft, tinted, rounded rectangles positioned by start/end; current time as a thin accent line across today's column.

**Components (shadcn).** `Tabs` (Day/Week), `Button`/`Button` group (prev/today/next), `ScrollArea` (vertical time scroll), `Popover` (block detail on click: title, time, complete/skip), `HoverCard` (quick peek), `Badge` (activity type), `Calendar` (jump-to-date in a `Popover`), `Skeleton`.

**User flow.** Open → current week renders → scroll vertically through hours → click a block → `Popover` with details + complete/skip → optionally `Generate` the next week. Click empty space is read-only in MVP (creation happens via Tasks, not direct drag — set expectation; drag-to-create is roadmap).

**Wireframe.**
```
┌─────────────────────────────────────────────────────┐
│ ‹ Today ›   [ Day | Week ]      Jun 2–8     [Generate]│
├────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│    │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun  │
│ 08 │▢meal │      │▢meal │      │      │      │      │
│ 09 │▦work │▦work │▦work │▦work │▦work │      │      │
│ 12 │▢lunch│▢lunch│      │▢lunch│      │      │      │
│ 14 │▨task │      │▨task │      │      │      │      │
│ 18 │▢exer │      │▢exer │      │▢exer │      │      │
│ 23 │☾sleep│☾sleep│☾sleep│☾sleep│☾sleep│☾sleep│☾sleep│
└────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

**Responsive.** ≥1024px: full 7-day grid. 768–1024px: 7 days but condensed column labels, smaller block text. <768px: auto-switch to **Day view** (single column, swipe left/right between days); week grid is impractical on phones.

---

## 4. Task Manager

**Layout.** Sidebar + content max-width ~720px. Header: "Tasks" + `Add task` button (also ⌘K → "New task"). A persistent **quick-add row** at top (natural-language input → AI parse → editable draft). Below: task list grouped by status (`Tabs`: All / Pending / Scheduled / Done) — each row shows checkbox, title, duration chip, deadline (relative: "in 2 days", red if overdue), priority dot. Row hover reveals edit/delete.

**Components (shadcn).** `Input` (NL quick-add), `Button` (Add / parse), `Dialog` or `Sheet` (full task form: title, description, duration `Slider`+input, deadline `Calendar`+`Popover`, priority `Select`, splittable `Switch`), `Tabs` (status filter), `Badge` (duration, priority), `Checkbox`, `DropdownMenu` (row actions), `Skeleton`, `Sonner`.

**User flow.**
1. Type "finish bio essay ~3h due Friday" in quick-add → `POST /tasks/parse` → AI returns a draft (title, 180m, Fri) → inline editable confirm → save. If AI down, fallback heuristic fills a best guess, still editable.
2. Or `Add task` → `Sheet` with full form.
3. Edit inline via row hover; complete via checkbox (optimistic); delete via row menu (soft delete, toast with Undo).
4. After adding tasks → CTA hint: "Generate today's plan" linking to Dashboard.

**Wireframe.**
```
┌── sidebar ─┬─────────────────────────────────────┐
│            │ Tasks                       [+ Add task]│
│            │ ┌─────────────────────────────────────┐│
│            │ │ ✎ "essay ~3h due Fri…"      [Parse] ││ ← NL quick-add
│            │ └─────────────────────────────────────┘│
│            │ [ All | Pending | Scheduled | Done ]   │
│            │ ☐ ● Finish report      90m · in 2d     │
│            │ ☐ ● Study chapter 4    120m · Fri      │
│            │ ☑ ○ Email professor    15m · done      │
└────────────┴─────────────────────────────────────┘
```

**Responsive.** ≥768px: hover-reveal actions, `Sheet` from right for the form. <768px: actions always visible as a trailing "⋯"; form opens as a full-screen `Dialog`/bottom `Sheet`; quick-add sticky under the header; bottom tab bar nav.

---

## 5. Analytics

**Layout.** Sidebar + content max-width ~960px. Top: range `Tabs` (Daily / Weekly / Monthly) + date range label. A row of **stat cards** (Completion rate, Avg sleep, Health adherence, Tasks done). Below: charts — an **activity-balance stacked bar** (minutes by activity per day) and a **sleep trend line** with a 6h reference line; a **completion-rate area** over the range. All Recharts, themed to the neutral palette with the single accent.

**Components (shadcn).** `Tabs` (range), `Card` ×4 (stats, each with label, big tabular number, small delta `Badge`), `Separator`, `Skeleton` (chart loaders), `Tooltip`; charts via **Recharts** (`BarChart`, `LineChart`, `AreaChart`, `ReferenceLine`).

**User flow.** Open (defaults Weekly) → stat cards + charts render → switch range tab → data refetches (`/analytics?range=`) with skeletons → hover chart for per-day tooltip. Empty state (new user, no history): friendly "Check off a few days to see patterns" with a muted sample chart.

**Wireframe.**
```
┌─────────────────────────────────────────────────────┐
│ Analytics            [ Daily | Weekly | Monthly ]     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│ │ 82% │ │6h52 │ │ 90% │ │ 14  │  ← stat cards         │
│ │compl│ │sleep│ │healt│ │tasks│                       │
│ └─────┘ └─────┘ └─────┘ └─────┘                       │
│ ┌───────────────── activity balance (stacked) ──────┐ │
│ │ ▇▇▅▅▃ ▇▇▅▅▃ ▇▇▅▅▃ ▇▇▅▅▃ …                          │ │
│ └───────────────────────────────────────────────────┘ │
│ ┌──── sleep trend ───────┐ ┌──── completion ────────┐ │
│ │  ╲╱╲__ — — 6h ref      │ │   ▁▃▅▇ area            │ │
│ └────────────────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Responsive.** ≥1024px: 4 stat cards in a row, 2-up chart grid. 640–1024px: 2×2 stat cards, charts stack full-width. <640px: stat cards in a horizontal `ScrollArea` (swipe), charts stack, legends move below, tick labels thinned.

---

## 6. Settings

**Layout.** Sidebar + content max-width ~640px (form-optimal). Sectioned, single column with `Separator`s: **Routine** (the scheduling profile — drives everything), **Activities** (toggle optional: cooking/entertainment/commute/social), **Account** (Clerk profile link), **Billing** (plan + manage). Sticky "Save" appears only when the form is dirty.

**Components (shadcn).** `Input`/`time` (wake, sleep, meal times — add/remove meal `Button`s), `Slider` (target & min sleep hours, exercise minutes), `Switch` (exercise enabled, optional activities, splittable default), a small **work-blocks editor** (repeatable rows: day-of-week `ToggleGroup` + start/end `Input`s + remove), `Button` (Save — disabled until dirty), `Alert` (validation: "minimum can't exceed target"), `Card` (Billing), `Sonner` (saved).

**User flow.** Open → form prefilled from `/profile` → edit (e.g., drag sleep target slider) → dirty state reveals sticky Save → `PUT /profile` (server re-validates the min≤target rule, surfaces `Alert` on 400) → toast "Routine saved" → subsequent generations use it.

**Wireframe.**
```
┌── sidebar ─┬─────────────────────────────────────┐
│            │ Settings                              │
│            │ ROUTINE                               │
│            │ Wake [07:00]   Sleep [23:00]          │
│            │ Target sleep ●────────○ 7.0h          │
│            │ Minimum     ●──────○   6.0h           │
│            │ Meals: [08:00] [12:30] [19:00] [+]    │
│            │ Exercise [on]  45 min ●────○          │
│            │ ───────────────────────────────────   │
│            │ WORK BLOCKS                            │
│            │ [M T W T F] 09:00–18:00      [remove] │
│            │ [+ add block]                          │
│            │ ───────────────────────────────────   │
│            │ BILLING  → Free plan   [Upgrade]       │
│            │                         [ Save ]       │
└────────────┴─────────────────────────────────────┘
```

**Responsive.** ≥768px: labels left, controls right (two-column rows). <768px: stacked label-over-control; sliders full-width; work-block rows wrap; Save becomes a full-width sticky footer button; bottom tab nav.

---

## 7. Premium Page

**Layout.** Two contexts share one design: the public **/pricing** page (centered, two-plan comparison) and the in-app **upgrade** surface (a `Dialog` triggered by hitting a premium gate, e.g., Emergency mode). Centered max-width ~880px. Header (value line). Two `Card`s side by side: **Free** and **Premium** — feature checklist, price, CTA. A short FAQ/reassurance line below ("cancel anytime, billed monthly").

**Components (shadcn).** `Card` ×2 (plans), `Badge` ("Current plan" / "Recommended"), `Button` (Free: disabled/"Current"; Premium: "Upgrade" → `POST /stripe/checkout` → redirect), `Separator`, checklist rows with check icons, `Dialog` (in-app gated context, e.g. "Emergency mode is premium"), `Sonner`. Billing management uses Stripe's hosted portal via `billingPortal()`.

**User flow.**
1. From /pricing: "Upgrade" → checkout session → Stripe Checkout → return `/settings?checkout=success` → webhook flips tier → premium unlocked.
2. From a gate: free user taps "Emergency mode" on Dashboard → `Dialog` explains the feature + 48h ration → "Upgrade" → same checkout flow.
3. Premium user: Billing shows "Manage subscription" → Stripe portal (update card, cancel).

**Wireframe.**
```
┌─────────────────────────────────────────────────────┐
│            Simple, honest pricing                     │
│  ┌───────────────┐        ┌───────────────┐          │
│  │ FREE          │        │ PREMIUM  ★rec  │          │
│  │ $0            │        │ $X / mo        │          │
│  │ ✓ Healthy plan│        │ ✓ Everything   │          │
│  │ ✓ Tasks       │        │ ✓ Emergency    │          │
│  │ ✓ Analytics   │        │ ✓ Work-block   │          │
│  │               │        │ ✓ Substitutions│          │
│  │ [Current]     │        │ [ Upgrade ]    │          │
│  └───────────────┘        └───────────────┘          │
│        cancel anytime · billed monthly                │
└─────────────────────────────────────────────────────┘
```

**Responsive.** ≥768px: plans side-by-side. <768px: plans stack (Premium first, as the recommended option), CTAs full-width, the in-app gate `Dialog` becomes a bottom `Sheet`.

---

## Cross-cutting UX details

- **Command palette (⌘K):** global `Command` — New task, Generate today, Go to {page}, Toggle theme. The Linear-style accelerator that makes it feel fast.
- **Empty states** designed per page (no schedule, no tasks, no analytics history) — each with one clear primary action, never a blank screen.
- **Loading:** `Skeleton` placeholders matching final layout; optimistic check-offs and task edits with rollback on error.
- **Errors:** typed (`PREMIUM_REQUIRED` → upgrade `Dialog`; `RATIONED` → "available again in Xh"; validation → inline `Alert`). Toasts via `Sonner` for transient confirmations.
- **Accessibility:** WCAG AA contrast, visible accent focus rings, full keyboard nav, 44px touch targets on mobile, `prefers-reduced-motion` honored, charts never rely on color alone (patterns + labels).
- **Theme:** light default, system-aware dark mode; the single accent is the only saturated color in either theme.

---

*End of UI/UX Specification v1.0.*
