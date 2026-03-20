# TC-VAC-056: Approve with Crossing Vacation — Blocked

## Description
Tests that the vacation approval endpoint re-validates for crossing (overlapping) vacations.
When two vacations overlap in dates and one is already APPROVED, approving the second should fail.

## Steps
1. Create vacation A (Mon-Fri, 5 working days)
2. Create vacation B with overlapping dates (Wed-Tue, overlapping Wed-Fri with A)
   - If creation fails with crossing error: test validates crossing at creation time (alternative path)
3. Approve vacation B → status becomes APPROVED
4. Attempt to approve vacation A → expect HTTP 400 with `exception.validation.vacation.dates.crossing`

## Data
- **Login**: pvaynmaster (API_SECRET_TOKEN owner, DM role for self-approval)
- **Vacation A**: Mon-Fri of a far-future week (offset 230+)
- **Vacation B**: Wed of same week to Tue of next week (overlaps A on Wed-Fri)
- **Type**: REGULAR
- **Dynamic mode**: finds conflict-free 2-week window via DB
