---
title: CS Employee Profile — Edit Page & Cards
type: ui-reference
tags: [cs, employee, profile, cards, timeline]
updated: 2026-04-15
---

# CS Employee Profile — Edit Page & Cards

## Entry points

| Path | Description |
|---|---|
| `/employee/active/list` | Main directory (419 employees on preprod). Search by name/login/contact. |
| `/profile/<login>` | Read-only profile (e.g. `/profile/slebedev`, `/profile/pvaynmaster`, `/profile/pnikonorov`) |
| `/profile/edit/<employee_id>?tab=<tab>` | Admin-edit profile. Opens in **new browser tab** when clicked via the pencil/edit icon on the list |
| `/employment/edit/<hire_id>/<tab>` | New-hire edit (candidate in the hiring workflow — see [[cs/employee-hiring]]) |

## Search behavior

- Free-text over name, login, contact info
- Returns all matching employees (client-side filter on the 419-row table)
- **Edit action**: rightmost column has a pencil (`icon-pencil`) button — clicking opens the profile edit page **in a new tab**. The row-level click only highlights (opens a contact panel in the sidebar).

## Edit page — 5 cards (tabs)

On `/profile/edit/<id>` (existing employees) and `/employment/edit/<id>` (new hires), the profile is organized into five horizontal tabs:

1. **HR card** (`?tab=hr`) — personal data, contacts, Noveo data, visibility scopes, employment data, workplace preparation
2. **Administrator card** (`?tab=administrator`) — system admin setup (accounts, equipment) — owned by IT admins
3. **Accountant card** (`?tab=account`) — **Work in Noveo timeline** + employment data (department type, vacation pay, payment system, responsible accountant, VMI)
4. **Manager card** (`?tab=manager`) — Specialization, Grade, Tech Lead, Mentor — owned by the employee's direct manager
5. **Personnel officer card** (`?tab=personnel_officer`) — paperwork (Russian: "Карточка кадровика")

Each card saves independently. For new hires, each role (HR/Admin/Accountant/Manager/Personnel) has a **"Save and submit to HR for registration"** button — when all 5 are submitted, HR gets a **Publish** button to finalize (see [[cs/employee-hiring]]).

## HR card — key sections

| Section | Fields (bold = required) |
|---|---|
| Personal data | **Last name** (Ru + Latin), **First name** (Ru + Latin), **Middle name** (or "No middle name" checkbox), **Gender**, **Main language**, Employee interface language (Ru/En), Second/Third language, Citizenship, Previous last name, **Birthday** |
| Contacts | **Personal email**, **Phone number** (masked `+___-____`), Additional phone, Telegram |
| Noveo data | **Main workplace** (**Office** → **Country** + **City**), Room/Section/Table, **Works from**, HR manager, **Position**, Grade, **Manager**, Tech Lead, "Same as salary manager" checkbox (on = reuse Manager; off = **Salary manager** required), PR manager, Mentor, Specialization |
| Visibility scopes | Access groups who can see this employee |
| Employment data | **Employment type** (Staff / Individual entrepreneur / Self-employed / Civil contract / Physical person / Special), **Department type** (Production / Administrative), **Vacation pay** (Calculated / Not calculated), **Payment system** (Remuneration depends on TTT / Salary), **Salary office**, Responsible accountant, **VMI** (Available / Not available) |
| Preparing the workplace | **OS version**, Comments to administrators |

## Accountant card — "Work in Noveo" timeline

The Accountant card has a **visual timeline** with two parallel tracks:

1. **Employment status events** (top): hiring, maternity leave, return from maternity leave, dismissal. Each node shows a date and the event type. Status changes can be annotated with a Salary office change (e.g., "01.11.2022 · Individual entrepreneur · Salary office Uran").
2. **Contract events** (middle/bottom rows): each row = one contract with a legal entity. Shows `signed DD.MM.YYYY` (green) or `terminated DD.MM.YYYY` (red), with `main` flag on the primary contract at any moment.

### Adding a timeline event

A "+" button at the end of the timeline opens a **3-step wizard**:

**Step 1 — Event type** (checkbox list, multi-select):
- Employment type
- Legal entity and contract
- **Maternity leave** (going on or returning from)

**Step 2 — Event details** (varies by selection):
- For "Maternity leave": single date field "Start date of the maternity leave" (DD.MM.YYYY), defaults to today

**Step 3 — Confirmation** (review):
- Shows "Current values" vs "New values"
- Back / **Save**

After Save, the new event appears on the timeline. The system chose to render `01.05.2026 · The employee is on maternity leave` on a new row below the first timeline row (auto-wrap).

### Editing a timeline event

Each event has a pencil icon; clicking opens an edit dialog (not fully explored — verify when needed).

### Real example (Pavel Nikonorov, session 2026-04-15)

- 11.09.2017 — Staff of the company, Salary office Saturn
- 01.11.2022 — Individual entrepreneur, Salary office Uran
- Contracts on Noveo Europ Limited: signed 21.10.2022 / signed 01.09.2023 / terminated 30.09.2023 / signed 01.09.2024 (main) / terminated 30.09.2024 / terminated 30.09.2025 (main) / signed 01.10.2025 (main) / terminated 31.10.2026 (main)
- Header shows computed tenure: "The employee has been working for 8 years 7 months 4 days"

## Status badges

Employee profiles can show a status indicator (usually top-left under the photo):

| Status | Russian | Meaning |
|---|---|---|
| New | Новый / Новое | Just created, no workflow started |
| Registration in progress | На оформлении | Candidate going through the 5-card workflow |
| Ready to publish | Готов к публикации | All 5 roles submitted, awaiting HR publish |
| (none / active) | — | Published, regular active employee |

Status progression is described in [[cs/employee-hiring]].

## Transfer of the employee

Active employees have a **"Transfer of the employee"** button in the profile header (next to "Fire an employee"). Clicking opens a modal to move the employee to a different salary office. See [[cs/employee-transfer]].

## Fire employee

"Удалить кандидата" (Delete the candidate) button for in-progress hires, **"Fire an employee"** for active employees — opens a termination flow (not explored in depth yet).

## Known UI quirks on profile pages

- Phone input is **masked** — fill with digits only (`79991234567` → auto-formats to `+7(999)123-xx-xx`)
- Birthday field uses `mx-datepicker` — set via `input.mx-input[name="date"]` + fire `input`/`change`/`blur` events
- "The start date coincides with a weekend or holiday. It is recommended to change the date." — a warning, not a blocker
- Works-from field will happily accept 01.05.2026 (a Russian public holiday) with the warning
