declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-013: Create overlapping vacation (start inside existing)
 *
 * Preconditions:
 * - Employee has an existing vacation (we create a "setup" vacation first)
 * - Second vacation's start date falls inside the first vacation's range
 * Expected: HTTP 400, error code: exception.validation.vacation.dates.crossing
 *
 * Note: crossing validation counts ALL statuses including DELETED (ghost conflicts).
 * We create a fresh setup vacation to guarantee a known overlap target.
 */
export class VacationTc013Data {
  readonly login: string;
  readonly setupStartDate: string;
  readonly setupEndDate: string;
  readonly overlapStartDate: string;
  readonly overlapEndDate: string;
  readonly paymentType: string;
  readonly setupPaymentMonth: string;
  readonly overlapPaymentMonth: string;
  readonly expectedErrorCode: string;
  readonly expectedHttpStatus: number;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc013Data> {
    if (mode === "static") return new VacationTc013Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        setupStartDate: string;
        setupEndDate: string;
        overlapStartDate: string;
        overlapEndDate: string;
        setupPaymentMonth: string;
        overlapPaymentMonth: string;
      }>("VacationTc013Data");
      if (cached)
        return new VacationTc013Data(
          cached.login,
          cached.setupStartDate,
          cached.setupEndDate,
          cached.overlapStartDate,
          cached.overlapEndDate,
          cached.setupPaymentMonth,
          cached.overlapPaymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC013_LOGIN ?? "pvaynmaster";

      // Need a window free of ALL conflicts: setup Mon-Fri + overlap Wed-nextFri
      const now = new Date();
      const baseDate = new Date(now);
      baseDate.setDate(now.getDate() + 14);
      const dow = baseDate.getDay();
      const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      baseDate.setDate(baseDate.getDate() + daysToMon);

      for (let week = 0; week < 40; week++) {
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() + week * 7);

        // Setup: Mon-Fri (5 calendar days)
        const setupEnd = new Date(start);
        setupEnd.setDate(start.getDate() + 4);

        // Overlap: Wed of same week to next Wed (+9 days from Mon)
        const overlapEnd = new Date(start);
        overlapEnd.setDate(start.getDate() + 9);

        // Check entire range (Mon to next Wed) is conflict-free
        const conflict = await hasVacationConflict(
          db,
          login,
          toIso(start),
          toIso(overlapEnd),
        );
        if (!conflict) {
          const setupStartIso = toIso(start);
          const setupEndIso = toIso(setupEnd);

          // Overlap starts on Wednesday (inside setup range)
          const overlapStart = new Date(start);
          overlapStart.setDate(start.getDate() + 2);
          const overlapStartIso = toIso(overlapStart);
          const overlapEndIso = toIso(overlapEnd);

          const setupPm = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
          const overlapPm = `${overlapStart.getFullYear()}-${String(overlapStart.getMonth() + 1).padStart(2, "0")}-01`;

          const instance = new VacationTc013Data(
            login,
            setupStartIso,
            setupEndIso,
            overlapStartIso,
            overlapEndIso,
            setupPm,
            overlapPm,
          );
          if (mode === "saved")
            saveToDisk("VacationTc013Data", {
              login,
              setupStartDate: setupStartIso,
              setupEndDate: setupEndIso,
              overlapStartDate: overlapStartIso,
              overlapEndDate: overlapEndIso,
              setupPaymentMonth: setupPm,
              overlapPaymentMonth: overlapPm,
            });
          return instance;
        }
      }
      throw new Error(
        `Could not find conflict-free 2-week window for "${login}" within 40 weeks`,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    setupStartDate = "2026-05-04",
    setupEndDate = "2026-05-08",
    overlapStartDate = "2026-05-06",
    overlapEndDate = "2026-05-13",
    setupPaymentMonth = "2026-05-01",
    overlapPaymentMonth = "2026-05-01",
  ) {
    this.login = login;
    this.setupStartDate = setupStartDate;
    this.setupEndDate = setupEndDate;
    this.overlapStartDate = overlapStartDate;
    this.overlapEndDate = overlapEndDate;
    this.paymentType = "REGULAR";
    this.setupPaymentMonth = setupPaymentMonth;
    this.overlapPaymentMonth = overlapPaymentMonth;
    this.expectedErrorCode = "exception.validation.vacation.dates.crossing";
    this.expectedHttpStatus = 400;
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
