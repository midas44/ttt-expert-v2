
---
type: exploration
tags: [day-off, calendar, data-source, autotest, t3404]
created: 2026-03-26
updated: 2026-03-26
status: active
related: ["[[frontend-day-off-module]]", "[[t3404-investigation]]"]
branch: release/2.1
---

# Day Off Tab — Data Source and Date Display Logic

## Key Finding

The Day Off tab ("Выходные") displays dates from the **production calendar** (`ttt_calendar.calendar_days`), NOT directly from `ttt_vacation.employee_dayoff`.

### Date Display Rules

1. **No transfer request:** UI shows `calendar_days.calendar_date` directly
2. **With APPROVED transfer:** UI shows `employee_dayoff_request.personal_date` (the transferred date) instead of the original calendar date

### Example: Cyprus Calendar, Greek Independence Day
- `calendar_days.calendar_date` = 2026-03-25 (Wednesday)
- `employee_dayoff.original_date` = 2026-03-25 (same)
- `employee_dayoff_request.personal_date` = 2026-03-27 (Friday) — employee transferred the day-off
- **UI shows: 27.03.2026 (пт)** — the personal_date, not the calendar_date

### Query Pattern for Autotest Data Classes

To select dates that match the UI display, use `calendar_days` with `NO_ACTIVE_TRANSFER`:

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
  AND NOT EXISTS (
    SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
    WHERE edr.employee = e.id
      AND edr.original_date = cd.calendar_date
      AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
  )
```

This ensures `calendar_date` = what the UI shows, because we only select dates without transfers.

### Table Relationships

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `calendar_days` | Production calendar holidays per calendar | `calendar_date`, `duration`, `reason`, `calendar_id` |
| `office_calendar` | Maps offices to calendars (with `since_year`) | `office_id`, `calendar_id`, `since_year` |
| `employee_dayoff` | Synced per-employee day-off entries | `original_date`, `personal_date`, `duration`, `employee` |
| `employee_dayoff_request` | Transfer requests | `original_date`, `personal_date`, `last_approved_date`, `status`, `employee` |

### Important Notes

- `employee_dayoff` only has entries for employees who have had transfer activity — most employees have very few entries (e.g., 1 out of 12 holidays)
- The Day Off tab shows ALL production calendar holidays for the employee's office, not just `employee_dayoff` entries
- `employee_dayoff.original_date` typically matches `calendar_days.calendar_date`, but this is NOT guaranteed
- The `NO_ACTIVE_TRANSFER` filter is essential — without it, queried dates may not match UI
- Outlier office id=9 ("Не указано") has approve period from 2020 — exclude with `start_date >= '2025-01-01'`
