declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-014: Create with null paymentMonth — NPE bug
 *
 * Preconditions: Active employee
 * Expected: KNOWN BUG — HTTP 500 NullPointerException at
 *   VacationAvailablePaidDaysCalculatorImpl:73 (paymentDate.getYear())
 * If fixed: HTTP 400 with validation error
 *
 * Root cause: DTO lacks @NotNull on paymentMonth field.
 * The null value passes DTO validation and reaches the calculator,
 * which calls paymentDate.getYear() on null.
 */
export class VacationTc014Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  // paymentMonth deliberately absent — this IS the test
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc014Data> {
    if (mode === "static") return new VacationTc014Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
      }>("VacationTc014Data");
      if (cached)
        return new VacationTc014Data(
          cached.login,
          cached.startDate,
          cached.endDate,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC014_LOGIN ?? "pvaynmaster";

      // Find conflict-free Mon-Fri window (avoid crossing errors masking the NPE)
      const now = new Date();
      const baseDate = new Date(now);
      baseDate.setDate(now.getDate() + 14);
      const dow = baseDate.getDay();
      const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      baseDate.setDate(baseDate.getDate() + daysToMon);

      for (let week = 0; week < 40; week++) {
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() + week * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);

        const startIso = toIso(start);
        const endIso = toIso(end);

        const conflict = await hasVacationConflict(db, login, startIso, endIso);
        if (!conflict) {
          const instance = new VacationTc014Data(login, startIso, endIso);
          if (mode === "saved")
            saveToDisk("VacationTc014Data", {
              login,
              startDate: startIso,
              endDate: endIso,
            });
          return instance;
        }
      }
      throw new Error(
        `Could not find conflict-free Mon-Fri window for "${login}"`,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    startDate = "2026-06-01",
    endDate = "2026-06-05",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.authHeaderName = "API_SECRET_TOKEN";
    this.vacationEndpoint = "/api/vacation/v1/vacations";
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
