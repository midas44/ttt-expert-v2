declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-044: APPROVED → NEW (employee edits dates)
 *
 * Preconditions:
 * - Vacation in APPROVED status, employee edits dates
 * Expected: Status resets to NEW, optional approvals reset to ASKED,
 *           day recalculation triggered
 *
 * Needs TWO conflict-free Mon-Fri windows: original + updated dates.
 * pvaynmaster is CPO — self-approves. Update via PUT /vacations/{id}.
 * Vault: vacation-service-deep-dive.md § status transitions, § update flow
 */
export class VacationTc044Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly newStartDate: string;
  readonly newEndDate: string;
  readonly newPaymentMonth: string;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc044Data> {
    if (mode === "static") return new VacationTc044Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
        newStartDate: string;
        newEndDate: string;
        newPaymentMonth: string;
      }>("VacationTc044Data");
      if (cached)
        return new VacationTc044Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
          cached.newStartDate,
          cached.newEndDate,
          cached.newPaymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC044_LOGIN ?? "pvaynmaster";

      const now = new Date();
      const baseDate = new Date(now);
      baseDate.setDate(now.getDate() + 14);
      const dow = baseDate.getDay();
      const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      baseDate.setDate(baseDate.getDate() + daysToMon);

      // Find two non-overlapping conflict-free Mon-Fri windows
      let firstStart = "";
      let firstEnd = "";
      let firstPaymentMonth = "";
      let secondStart = "";
      let secondEnd = "";
      let secondPaymentMonth = "";

      for (let week = 0; week < 40; week++) {
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() + week * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);

        const startIso = toIso(start);
        const endIso = toIso(end);

        const conflict = await hasVacationConflict(db, login, startIso, endIso);
        if (!conflict) {
          if (!firstStart) {
            firstStart = startIso;
            firstEnd = endIso;
            firstPaymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
          } else {
            secondStart = startIso;
            secondEnd = endIso;
            secondPaymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
            break;
          }
        }
      }

      if (!firstStart || !secondStart) {
        throw new Error(`Could not find two conflict-free Mon-Fri windows for "${login}"`);
      }

      const instance = new VacationTc044Data(
        login, firstStart, firstEnd, firstPaymentMonth,
        secondStart, secondEnd, secondPaymentMonth,
      );
      if (mode === "saved")
        saveToDisk("VacationTc044Data", {
          login, startDate: firstStart, endDate: firstEnd, paymentMonth: firstPaymentMonth,
          newStartDate: secondStart, newEndDate: secondEnd, newPaymentMonth: secondPaymentMonth,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    startDate = "2026-08-24",
    endDate = "2026-08-28",
    paymentMonth = "2026-08-01",
    newStartDate = "2026-08-31",
    newEndDate = "2026-09-04",
    newPaymentMonth = "2026-08-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.newStartDate = newStartDate;
    this.newEndDate = newEndDate;
    this.newPaymentMonth = newPaymentMonth;
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
