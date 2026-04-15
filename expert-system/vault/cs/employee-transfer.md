---
title: CS Employee Transfer — Salary Office Change Workflow
type: workflow-reference
tags: [cs, transfer, salary-office, workflow]
updated: 2026-04-15
---

# CS Employee Transfer — Salary Office Change Workflow

Moving an active employee from one salary office to another (e.g. changing from Venera RF to Venera). **This is a multi-stage, multi-role workflow** with 11 checklist items across 3 tabs. Changes are timed (the "transfer date" sets when they take effect).

## Entry point

On an active employee's profile edit page (`/profile/edit/<id>`), HR card, click the **"Transfer of the employee"** button (next to "Fire an employee"). Opens a modal below the button.

## Step 1 — Transfer request modal

| Field | Type | Required | Notes |
|---|---|---|---|
| New salary office | multiselect dropdown | ✔ | Excludes the current office; lists all other offices |
| New employment type | dropdown | ✔ | Defaults to "Without changes"; can be Staff / Self-employed / IP / Civil contract / Physical person / Special |
| New responsible accountant | autocomplete | — | Auto-fills when New salary office is picked (from that office's responsible accountant) |
| Transfer from | date (Apr 2026 format, month-level resolution) | ✔ | Default = next month |
| Urgent transfer | checkbox | — | Flag for priority processing |
| Comment | long text | ✔ | Must include: terms, equipment, pending vacation agreements |

Click **Save** → creates a transfer record, URL changes to `/transfer/<transfer_id>/previous`. New button set appears.

## Step 2 — Multi-tab checklist workflow

URL: `/transfer/<id>/<tab>` where tab ∈ `previous`, `new`, `manager`.

### Previous salary office (4 items)

| # | Item | Trigger |
|---|---|---|
| 1 | Transfer date accepted | Check "Transfer date agreed upon" + set exact date (DD.MM.YYYY) |
| 2 | Calculation and final payment made | Check "Calculation and final payment have been completed" |
| 3 | All vacation pays paid, zero balance in TTT/STT | Check "All vacation pays have been paid…" |
| 4 | **Salary office and type of employment have been changed** | Click the **"Change"** button in the header → confirmation modal → "Confirm". After confirm, button text flips to **"Retrieve"** (to rollback if needed) and item 4 auto-checks. |

**Save button** at the bottom commits items 1/2/3 and any number field (there's a "For additional payment / for holdback" number field required to be filled — use `0` for a typical transfer, currency defaults to RUB). **Item 4 requires the "Change" button — it won't check from the checkbox list.**

### New salary office (6 items)

| # | Item |
|---|---|
| 1 | Consultation provided / memo sent |
| 2 | Amount of payment agreed upon |
| 3 | Zero vacation pay balance verified in TTT and STT |
| 4 | Carryover balance entered into the accounting system |
| 5 | Documents / requisites received from the employee |
| 6 | Agreement/contract signed |

Plus inline sub-form for the new contract/legal entity:
- **Legal entity** (multiselect, e.g. `ООО Новео`, `Noveo Europ Limited`, `Noveo Georgia LLC`, `Noveo d.o.o. Beograd`, `LLC Noveo Montenegro`, `Noveo France`, `Noveo USA Inc`, etc.) — ✔ required
- **Number** — free text (e.g. `TR-2026-001`)
- **Main** checkbox — mark this as the primary contract
- **Signing date** (DD.MM.YYYY) — ✔ required
- **Termination date** — optional
- **Contract file** — upload (PDF/JPG, ≤1.5 MB)
- Vacation pay radio (Calculated / Not calculated, default Calculated)
- VMI radio (Available / Not available)
- Payment system (Remuneration depends on TTT / Salary)

### Manager card (1 item)

| # | Item |
|---|---|
| 1 | Salary in TTT/STT changed (Russian: "Salary in STT changed" label) |

No extra fields. Single checkbox + Save.

## Step 3 — Complete the process

Once all 11 items are checked (Previous 4/4 + New 6/6 + Manager 1/1), the **"Complete the process"** button at the bottom right becomes enabled. Clicking completes the transfer and removes the employee from the Current transfers list (`/employee/transfer/list`) → moves to Completed (`?tab=completed`).

## Status progression

- `/employee/transfer/list` (Current) — shows all in-progress transfers with progress
- `/employee/transfer/list?tab=completed` — historical

## Real example (session 2026-04-15)

Transferred Vladimir Ulyanov from Venera RF to Venera:
- Employment type: Self-employed → Self-employed (Without changes)
- Responsible accountant: Polina Litvin → Galina Perekrest (auto-filled)
- Transfer date: 01.05.2026
- New contract: ООО Новео, #TR-2026-001, signed 01.05.2026, marked Main
- Cancel-the-transfer button available throughout — `Cancel the transfer` (left of Complete) aborts and restores the original office

Transfer IDs are sequential (Vladimir got `/transfer/436`).

## Session note on "For additional payment / for holdback" field

This number field on the Previous salary office tab is required even if zero. Leaving it blank triggers "Please enter a value" validation. Fill with `0` for standard transfers with no balance settlement.

## Related

- [[cs/salary-offices]] — what offices exist, their properties
- [[ttt-cs-sync]] — how salary-office changes propagate to TTT
