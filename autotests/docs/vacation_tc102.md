## TC-VAC-102: Timeline audit gaps for payment events (KNOWN ISSUE)

**Type:** DB (read-only)
**Suite:** TS-VAC-Payment
**Priority:** Medium

### Description

Verifies a known audit trail gap: VACATION_PAID timeline events have `days_used=0`, `administrative_days_used=0`, and `previous_status=NULL`. The timeline doesn't record how many days were paid or the regular/admin split, making payment audit incomplete.

### Steps

1. DB: Find an existing PAID vacation (read-only, no data modification)
2. DB: Query timeline events for that vacation
3. Find the PAID event — verify days_used=0, administrative_days_used=0, previous_status=NULL
4. Document lifecycle event completeness (CREATE → APPROVED → PAID)

### Data

- **Source:** Existing PAID vacations in qa-1 database
- **No mutations:** Purely read-only DB queries
- **Table:** ttt_vacation.timeline (append-only audit log)

### Known Issue

The VACATION_PAID timeline event is recorded but lacks critical audit data:
- `days_used` = 0 (should record actual regular days paid)
- `administrative_days_used` = 0 (should record actual admin days paid)
- `previous_status` = NULL (should be "APPROVED")

This means the timeline cannot answer: "How many days were paid for this vacation?" without joining back to the vacation table.
