declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-157: Office calendar migration — working day norm change verification.
 *
 * DB-only test verifying that offices migrated from Russia to Cyprus/other calendars in 2024.
 * Office 10 (Venera) is the reference case: Russia calendar for <=2023, Cyprus for >=2024.
 * Calendar mapping is in ttt_calendar.office_calendar with since_year column.
 */
export class VacationTc157Data {
  readonly referenceOfficeId: number;
  readonly referenceOfficeName: string;
  readonly preYearBefore: number;
  readonly migrYearAfter: number;
  readonly expectedOldCalendarName: string;
  readonly expectedNewCalendarName: string;

  constructor(
    referenceOfficeId = Number(process.env.VACATION_TC157_OFFICE_ID ?? "10"),
    referenceOfficeName = "Venera",
    preYearBefore = 2023,
    migrYearAfter = 2024,
    expectedOldCalendarName = "Russia",
    expectedNewCalendarName = "Cyprus",
  ) {
    this.referenceOfficeId = referenceOfficeId;
    this.referenceOfficeName = referenceOfficeName;
    this.preYearBefore = preYearBefore;
    this.migrYearAfter = migrYearAfter;
    this.expectedOldCalendarName = expectedOldCalendarName;
    this.expectedNewCalendarName = expectedNewCalendarName;
  }
}
