---
type: exploration
tags: [day-off, calendar, data-architecture, autotest-finding]
created: 2026-03-26
updated: 2026-03-26
status: active
related: ["[[frontend-calendar-dayoff-module]]", "[[t3404-investigation]]"]
branch: release/2.1
---

# Day Off Tab — Data Architecture (Autotest Discovery)

## Source of Truth

The Day Off tab at `/vacation/my/daysoff` displays data by **merging three sources**:

### 1. `calendar_days` (production calendar)
The base holiday list comes from `ttt_calendar.calendar_days`, resolved via:
```
employee.office_id → office_calendar.calendar_id → calendar_days
```
The `office_calendar.since_year` field selects the correct calendar version (highest `since_year <= current year`).

### 2. `employee_dayoff_request` (transfer requests)
When an employee has an APPROVED transfer request for a calendar date:
- The **original calendar date is replaced** in the UI by the `personal_date` (transfer destination)
- The "Transfer status" column shows "Approved" / "Подтвержден"
- Example: March 9 (Women's Day, Mon) → March 12 (Thu) shows as "12.03.2026" in the table

### 3. Frontend `isWeekend()` check
The `useWeekendTableHeaders.tsx` code applies `isWeekend(lastApprovedDate)` — if a holiday falls on Saturday/Sunday, `isDayOff = false` and no edit icon appears, regardless of the holiday being in an open approve period.

## Implications for Test Data Queries

**DO NOT use `employee_dayoff` table** for test data — it's a synced copy that can contain stale or duplicate entries that don't match the UI.

**Correct query pattern:**
```sql
WITH latest_cal AS (
  SELECT oc.office_id, oc.calendar_id
  FROM ttt_calendar.office_calendar oc
  WHERE oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM ttt_calendar.office_calendar oc2
      WHERE oc2.office_id = oc.office_id
        AND oc2.since_year > oc.since_year
        AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
    )
)
SELECT e.login, cd.calendar_date::text AS date
FROM ttt_vacation.employee e
JOIN latest_cal lc ON lc.office_id = e.office_id
JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
WHERE e.enabled = true
  AND cd.duration = 0
  AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)  -- exclude weekends
  AND NOT EXISTS (  -- exclude dates with active transfers
    SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
    WHERE edr.employee = e.id
      AND edr.original_date = cd.calendar_date
      AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
  )
```

## Verified Calendar Samples (qa-1, 2026-03-26)

| Office | Calendar | March holiday | DOW | Note |
|--------|----------|---------------|-----|------|
| 2, 4, 27 (Russia) | Russia (id=1) | March 9 (Mon) | 1 | Women's Day compensatory |
| 10 (Cyprus) | Cyprus | March 25 (Wed) | 3 | Greek Independence Day |
| 12 | Calendar 3 | March 25 (Wed) | 3 | Similar to Cyprus |

## Edit Icon Visibility Rules (post-#3404)

Edit icon shown when ALL of:
1. `duration === 0` (full day off, not pre-holiday)
2. `!isWeekend(date)` — weekday only
3. `date >= approvePeriodStart` (in open period)
4. No date-based restriction (removed by #3404 — was `date >= today`)
