declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-028: Update CANCELED vacation — re-opens with new dates
 *
 * Preconditions: Existing CANCELED vacation
 * Expected: Update succeeds, status transitions CANCELED → NEW (re-opens),
 *           update validator skips day limit checks for CANCELED status,
 *           days recalculated for new dates
 *
 * VacationStatusManager.add(CANCELED, NEW, ROLE_EMPLOYEE) — same transition
 * verified by TC-049. This test validates the update-with-new-dates variant.
 * CANCELED/REJECTED vacations skip day limit validation in update path.
 * PUT body requires `id` field matching URL path parameter.
 * Vault: vacation-service-deep-dive.md § status transitions, update validator
 */
export class VacationTc028Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly updatedStartDate: string;
  readonly updatedEndDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly updatedPaymentMonth: string;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc028Data> {
    if (mode === "static") return new VacationTc028Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        updatedStartDate: string;
        updatedEndDate: string;
        paymentMonth: string;
        updatedPaymentMonth: string;
      }>("VacationTc028Data");
      if (cached)
        return new VacationTc028Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.updatedStartDate,
          cached.updatedEndDate,
          cached.paymentMonth,
          cached.updatedPaymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC028_LOGIN ?? "pvaynmaster";

      const now = new Date();
      const baseDate = new Date(now);
      baseDate.setDate(now.getDate() + 14);
      const dow = baseDate.getDay();
      const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      baseDate.setDate(baseDate.getDate() + daysToMon);

      // Start from week 40+ (~Jan 2027) to avoid exhausted 2026 vacation balance
      for (let week = 40; week < 140; week++) {
        const start1 = new Date(baseDate);
        start1.setDate(baseDate.getDate() + week * 7);
        const end1 = new Date(start1);
        end1.setDate(start1.getDate() + 4);

        const start2 = new Date(baseDate);
        start2.setDate(baseDate.getDate() + (week + 1) * 7);
        const end2 = new Date(start2);
        end2.setDate(start2.getDate() + 4);

        const s1 = toIso(start1);
        const e1 = toIso(end1);
        const s2 = toIso(start2);
        const e2 = toIso(end2);

        const conflict1 = await hasVacationConflict(db, login, s1, e1);
        const conflict2 = await hasVacationConflict(db, login, s2, e2);

        if (!conflict1 && !conflict2) {
          const pm1 = `${start1.getFullYear()}-${String(start1.getMonth() + 1).padStart(2, "0")}-01`;
          const pm2 = `${start2.getFullYear()}-${String(start2.getMonth() + 1).padStart(2, "0")}-01`;
          const instance = new VacationTc028Data(login, s1, e1, s2, e2, pm1, pm2);
          if (mode === "saved")
            saveToDisk("VacationTc028Data", {
              login, startDate: s1, endDate: e1,
              updatedStartDate: s2, updatedEndDate: e2,
              paymentMonth: pm1, updatedPaymentMonth: pm2,
            });
          return instance;
        }
      }
      throw new Error(`Could not find two consecutive conflict-free Mon-Fri windows within 100 weeks for "${login}"`);
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    startDate = "2027-11-01",
    endDate = "2027-11-05",
    updatedStartDate = "2027-11-08",
    updatedEndDate = "2027-11-12",
    paymentMonth = "2027-11-01",
    updatedPaymentMonth = "2027-11-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.updatedStartDate = updatedStartDate;
    this.updatedEndDate = updatedEndDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.updatedPaymentMonth = updatedPaymentMonth;
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
