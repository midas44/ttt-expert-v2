declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-025: Create vacation with very long comment (no length limit)
 *
 * Preconditions: Active employee
 * Expected: Vacation created with 5000-char comment stored in full
 *
 * No @Size annotation on AbstractVacationRequestDTO.comment.
 * DB column: ttt_vacation.vacation.comment (VARCHAR, no explicit length constraint).
 * Potential issue: DB column may have implicit limit causing truncation or error.
 * Vault: vacation-service-deep-dive.md
 */
export class VacationTc025Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly comment: string;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc025Data> {
    if (mode === "static") return new VacationTc025Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc025Data");
      if (cached)
        return new VacationTc025Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC025_LOGIN ?? "pvaynmaster";

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
          const paymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
          const instance = new VacationTc025Data(login, startIso, endIso, paymentMonth);
          if (mode === "saved")
            saveToDisk("VacationTc025Data", { login, startDate: startIso, endDate: endIso, paymentMonth });
          return instance;
        }
      }
      throw new Error(`Could not find conflict-free Mon-Fri window for "${login}"`);
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    startDate = "2027-09-13",
    endDate = "2027-09-17",
    paymentMonth = "2027-09-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    // Generate 5000-character comment
    this.comment = "Long vacation comment for testing. ".repeat(143).slice(0, 5000);
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
