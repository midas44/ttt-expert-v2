# TC-VAC-157: Office calendar migration — working day norm change verification

## Description
Verifies that offices migrated from Russia to Cyprus/other production calendars in 2024. Office 10 (Venera) is the reference case: Russia calendar for <=2023, Cyprus for >=2024. The `office_calendar` table uses `since_year` column with `findYearLessOrEqual` resolution logic.

## Steps
1. Query `ttt_calendar.office_calendar` for office 10 to see all calendar mappings
2. Verify pre-migration mapping (<=2023) points to Russia calendar
3. Verify post-migration mapping (>=2024) points to Cyprus calendar
4. Compare January working day counts between Russia and Cyprus calendars (Russia has Jan 1-8 break)
5. Query all offices migrated in 2024 to verify migration scope (~12 offices)
6. Verify `since_year` resolution: year 2023 resolves to Russia, year 2025 resolves to Cyprus

## Data
- **Reference office**: 10 (Venera) — Russia → Cyprus migration
- **DB tables**: `ttt_calendar.office_calendar`, `ttt_calendar.calendar`, `ttt_calendar.calendar_day`
- **Key**: `since_year` column determines effective calendar per year
