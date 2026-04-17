---
title: CS Employee Hiring — New Employee Registration Workflow
type: workflow-reference
tags: [cs, hiring, employment, registration, publish]
updated: 2026-04-15
---

# CS Employee Hiring — New Employee Registration Workflow

Adding a new employee to CS is a multi-stage, multi-role workflow that ultimately publishes them to the active directory (and by sync → TTT, see [[ttt-cs-sync]]).

## Entry

Employees → Employment → **"Add an employee"** button (`/employee/hire/list` page).

Opens `/employment/create` in a **new tab**.

## Step 1 — Candidate creation (HR card)

Initial form is one long page with sections. Required fields (★) must be filled before first save:

| Section | Required fields |
|---|---|
| Type | ★ Employee of Production/Administration (default) OR Employee of Sales |
| Personal data | ★ Last name (Ru+Latin), ★ First name (Ru+Latin), ★ Middle name (or "No middle name"), ★ Gender, ★ Main language |
| Contacts | ★ Personal email, ★ Phone number (masked `+___-____` — **fill digits only**, e.g. `79991234567`) |
| Noveo data | ★ Main workplace → ★ Office, ★ Country, ★ City. ★ Works from (DD.MM.YYYY), ★ Position, ★ Manager |
| Employment data | ★ Employment type (default Staff), ★ Department type (default Production), ★ Vacation pay (default Calculated), ★ Payment system, ★ Salary office, ★ VMI |
| Workplace preparation | ★ OS version |

Non-required but commonly filled: Birthday, Grade, Tech Lead, HR manager, Mentor, Specialization, Responsible accountant, PR manager.

### Status progression (first save → final publish)

| Status | Russian | Trigger | Accessible button set |
|---|---|---|---|
| *(none)* | — | Before Save | "Cancel" / "Save" |
| **New** | Новый | After first Save (creates employee ID, e.g. 607; URL → `/employment/edit/607/hr`) | "Save" / "Save and submit for registration" |
| **Registration in progress** | На оформлении | After "Save and submit for registration" + confirm | Cards are now editable by assigned roles; each card shows "Save" + "Save and submit to HR for registration" |
| **Ready to publish** | Готов к публикации | After **all 4 non-HR cards** (Administrator, Accountant, Manager, Personnel officer) are submitted to HR | HR card shows "Save" (disabled) + **"Опубликовать" / "Publish"** button |
| *(active employee)* | — | After "Publish" | Candidate disappears from `/employee/hire/list`, appears in `/employee/active/list` with a new permanent `/employee/card/<id>` URL |

### Validation gotchas

- **Phone** field: masked — JS-set value via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` doesn't trigger the mask; must `.fill()` through Playwright (or use `browser_type` slowly) so the mask accepts the keystrokes. Digits-only input is accepted and auto-formats.
- **Salary manager** — after first save, if "The same as the salary manager" checkbox is **unchecked**, Salary manager becomes required. Re-check the box to auto-reuse the Manager value.
- **Position dropdown** is autocomplete-driven — search by a partial term (e.g. `Developer` matches `Middle Developer`, `Senior Developer`, etc. — but `Middle` alone returns no results because "Middle" is a Grade, not a Position prefix)
- **Works from** field: warns on weekends/holidays (e.g. 01.05.2026 is Labour Day in RF) but does not block submission

## Step 2 — Multi-role card completion

Once status = "Registration in progress", each of the 5 cards is owned by the corresponding role:

| Card | Owner | Russian label | What gets filled |
|---|---|---|---|
| HR card | HR dept | Карточка HR | All base data from step 1 (already filled) |
| Administrator card | IT/Admin | Карточка администратора | System accounts, equipment assignment |
| Accountant card | Accounting | Карточка бухгалтера | Contract details, payroll setup |
| **Manager card** | Direct manager | Карточка руководителя | **Specialization, Grade, Tech Lead, Mentor** |
| Personnel officer card | Personnel | Карточка кадровика | Paperwork, documents |

Each card has a **"Save and submit to HR for registration"** button (Russian: "Сохранить и передать HR на оформление"). Click to mark that role's portion complete.

### Manager card quirk (session 2026-04-15)

When Pavel Weinmeister (pvaynmaster) logged in as the manager for Donald Trump, he saw only the Manager card's fields. Filling Specialization `Web` + Grade `Middle` and clicking "Save" enables the submit. Manager's submission contributes one of the four required non-HR approvals.

## Step 3 — HR publishes

After all 4 non-HR cards submit, HR revisits the HR card. The save button row now shows:
- "Сохранить" / "Save" (disabled)
- **"Опубликовать" / "Publish"**

Click Publish → employee is created in the main directory, removed from the hire queue.

In session 2026-04-15, Donald Trump (employee ID 607 during hire → 1928 as active) became active after Publish. Total employee count on preprod went 418 → 419.

## Real example (Donald Trump, session 2026-04-15)

- Created via slebedev (admin) with HR card fields:
  - Trump / Трамп, Donald / Дональд, Джонович, Male, Birthday 14.06.1946
  - Email: `donald.trump@test.example.com`, Phone: `+7(999)123-xx-xx`
  - Workplace: Novosibirsk (Academ), Russia
  - Position: Developer, Manager: Pavel Weinmeister
  - Works from: 01.05.2026 (holiday warning — accepted)
  - Salary office: **Saturn**, Employment type: Staff of the company
  - VMI: Not available, OS: Windows
  - English interface language
- Status `New → Registration in progress` after first HR submit
- Admin/Accountant/Personnel officer cards filled (user did these off-camera)
- Manager card filled by pvaynmaster: Specialization `Web`, Grade `Middle`
- Status advanced to `Ready to publish`
- HR clicked Publish → employee published (ID 1928 in active directory)

## Related

- [[cs/employee-profile]] — post-publish profile structure
- [[cs/salary-offices]] — picking the right salary office
- [[cs/ui-automation-notes]] — automation workarounds for this workflow
