declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findEmployeeWithMultiYearBalance,
  hasVacationConflict,
} from "./queries/vacationQueries";

/**
 * TC-VAC-058: Verify FIFO day consumption (earliest year first).
 * Finds an employee with remaining days in both past year and current year.
 */
export class VacationTc058Data {
  readonly employeeLogin: string;
  readonly yearlyEntries: { year: number; days: number }[];
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc058Data> {
    if (mode === "static") return new VacationTc058Data();

    const db = new DbClient(tttConfig);
    try {
      const result = await findEmployeeWithMultiYearBalance(db);
      const range = await VacationTc058Data.findAvailableRange(db, result.login);
      return new VacationTc058Data(
        result.login,
        result.entries,
        range.start,
        range.end,
      );
    } finally {
      await db.close();
    }
  }

  private static async findAvailableRange(
    db: DbClient,
    login: string,
  ): Promise<{ start: string; end: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);

    for (let attempt = 0; attempt < 16; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 2); // Wed — 3 days to keep it small

      const startIso = VacationTc058Data.toIso(start);
      const endIso = VacationTc058Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          start: VacationTc058Data.toDdMmYyyy(start),
          end: VacationTc058Data.toDdMmYyyy(end),
        };
      }
    }
    throw new Error(`No conflict-free window for "${login}" within 16 weeks`);
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    employeeLogin = process.env.VACATION_TC058_EMPLOYEE ?? "dmoskvina",
    yearlyEntries: { year: number; days: number }[] = [
      { year: 2025, days: 5 },
      { year: 2026, days: 28 },
    ],
    startDate = "30.03.2026",
    endDate = "01.04.2026",
  ) {
    this.employeeLogin = employeeLogin;
    this.yearlyEntries = yearlyEntries;
    this.startDate = startDate;
    this.endDate = endDate;
    this.periodPattern = this.buildPattern(startDate, endDate);
  }

  private buildPattern(startStr: string, endStr: string): RegExp {
    const [sD, sM, sY] = startStr.split(".").map(Number);
    const [eD, eM, eY] = endStr.split(".").map(Number);
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sDD = String(sD).padStart(2, "0");
    const sMM = String(sM).padStart(2, "0");
    const eDD = String(eD).padStart(2, "0");
    const eMM = String(eM).padStart(2, "0");

    const alternatives = [
      `0?${sD}\\s*[–\\-]\\s*0?${eD}\\s+${MONTHS[eM - 1]}\\w*\\s+${eY}`,
      `${sDD}\\.${sMM}\\.${sY}.*${eDD}\\.${eMM}\\.${eY}`,
      `0?${sD}\\s+${MONTHS[sM - 1]}.*0?${eD}\\s+${MONTHS[eM - 1]}`,
    ];
    return new RegExp(alternatives.join("|"));
  }
}
