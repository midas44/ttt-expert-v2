declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-024: Create vacation with comment
 *
 * Preconditions: Active employee
 * Expected: Vacation created with comment field populated, visible in GET response
 *
 * Comment field: no @Size annotation on AbstractVacationRequestDTO.comment
 * DB column: ttt_vacation.vacation.comment (VARCHAR, no explicit length limit)
 * Vault: vacation-service-deep-dive.md
 */
export class VacationTc024Data {
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
  ): Promise<VacationTc024Data> {
    if (mode === "static") return new VacationTc024Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc024Data");
      if (cached)
        return new VacationTc024Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC024_LOGIN ?? "pvaynmaster";

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
          const instance = new VacationTc024Data(login, startIso, endIso, paymentMonth);
          if (mode === "saved")
            saveToDisk("VacationTc024Data", { login, startDate: startIso, endDate: endIso, paymentMonth });
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
    startDate = "2027-09-06",
    endDate = "2027-09-10",
    paymentMonth = "2027-09-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.comment = "Family trip to the mountains";
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
