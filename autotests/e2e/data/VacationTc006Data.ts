declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findEmployeeWithVacationDays,
  hasVacationConflict,
} from "./queries/vacationQueries";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * TC-VAC-006: Edit vacation dates — NEW status.
 * Self-contained: creates a vacation first, then edits its dates.
 */
export class VacationTc006Data {
  readonly username: string;
  readonly createStartDate: string;
  readonly createEndDate: string;
  readonly createPeriodPattern: RegExp;
  readonly editStartDate: string;
  readonly editEndDate: string;
  readonly editPeriodPattern: RegExp;
  readonly expectedStatus = "New";
  readonly notificationText =
    "A new vacation request has been created";
  readonly comment: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc006Data> {
    if (mode === "static") return new VacationTc006Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithVacationDays(db, 10);
      const ranges = await VacationTc006Data.findTwoAvailableRanges(db, username);
      return new VacationTc006Data(
        username,
        ranges.first.start,
        ranges.first.end,
        ranges.second.start,
        ranges.second.end,
      );
    } finally {
      await db.close();
    }
  }

  /** Finds two non-overlapping Mon–Fri windows without vacation conflicts. */
  private static async findTwoAvailableRanges(
    db: DbClient,
    login: string,
  ): Promise<{
    first: { start: string; end: string };
    second: { start: string; end: string };
  }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);

    const found: { start: string; end: string }[] = [];

    for (let attempt = 0; attempt < 16 && found.length < 2; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = VacationTc006Data.toIso(start);
      const endIso = VacationTc006Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        found.push({
          start: VacationTc006Data.toDdMmYyyy(start),
          end: VacationTc006Data.toDdMmYyyy(end),
        });
      }
    }
    if (found.length < 2) {
      throw new Error(
        `Could not find 2 conflict-free Mon–Fri windows for "${login}" within 16 weeks`,
      );
    }
    return { first: found[0], second: found[1] };
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC006_USERNAME ?? "amelnikova",
    createStartDate = process.env.VACATION_TC006_CREATE_START ?? "07.04.2026",
    createEndDate = process.env.VACATION_TC006_CREATE_END ?? "10.04.2026",
    editStartDate = process.env.VACATION_TC006_EDIT_START ?? "14.04.2026",
    editEndDate = process.env.VACATION_TC006_EDIT_END ?? "17.04.2026",
  ) {
    this.username = username;
    this.createStartDate = createStartDate;
    this.createEndDate = createEndDate;
    this.editStartDate = editStartDate;
    this.editEndDate = editEndDate;
    this.comment = `autotest tc006 ${this.formatTimestamp()}`;
    this.createPeriodPattern = this.buildPattern(createStartDate, createEndDate);
    this.editPeriodPattern = this.buildPattern(editStartDate, editEndDate);
  }

  private formatTimestamp(date: Date = new Date()): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${dd}${mm}${yy}_${hh}${min}`;
  }

  private buildPattern(startStr: string, endStr: string): RegExp {
    const start = this.parseDate(startStr);
    const end = this.parseDate(endStr);
    const sDay = start.getUTCDate();
    const sMonth = start.getUTCMonth();
    const sYear = start.getUTCFullYear();
    const eDay = end.getUTCDate();
    const eMonth = end.getUTCMonth();
    const eYear = end.getUTCFullYear();
    const sDD = String(sDay).padStart(2, "0");
    const sMM = String(sMonth + 1).padStart(2, "0");
    const eDD = String(eDay).padStart(2, "0");
    const eMM = String(eMonth + 1).padStart(2, "0");

    const alternatives = [
      `0?${sDay}\\s*[–\\-]\\s*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}\\w*\\s+${eYear}`,
      `${sDD}\\.${sMM}\\.${sYear}.*${eDD}\\.${eMM}\\.${eYear}`,
      `${MONTH_NAMES[sMonth]}\\s+${sDay}.*${MONTH_NAMES[eMonth]}\\s+${eDay}`,
      `0?${sDay}\\s+${MONTH_ABBREVS[sMonth]}.*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}`,
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
