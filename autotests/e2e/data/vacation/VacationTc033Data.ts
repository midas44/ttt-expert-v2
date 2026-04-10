declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc033Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  hasNegativeBalance: boolean;
}

/**
 * TC-VAC-033: Error 500 on AV=true negative balance payment (#3363).
 * Finds an AV=true employee with negative vacation balance (or uses pvaynmaster fallback).
 * SETUP: API creates → approves vacation.
 * Test: attempts payment → expects HTTP 500 (known bug #3363).
 */
export class VacationTc033Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly hasNegativeBalance: boolean;

  constructor(
    username = process.env.VAC_TC033_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
    hasNegativeBalance = false,
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.hasNegativeBalance = hasNegativeBalance;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc033Data> {
    if (mode === "static") return new VacationTc033Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc033Args>("VacationTc033Data");
      if (cached) {
        return new VacationTc033Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
          cached.hasNegativeBalance,
        );
      }
    }

    // Try to find an AV=true employee with negative balance
    const db = new DbClient(tttConfig);
    let username = "pvaynmaster";
    let hasNegativeBalance = false;

    try {
      const row = await db
        .queryOne<{ login: string }>(
          `SELECT e.login
           FROM ttt_vacation.employee e
           JOIN ttt_vacation.office o ON e.office_id = o.id
           WHERE o.advance_vacation = true
             AND e.enabled = true
             AND e.manager IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM ttt_vacation.employee_vacation ev
               WHERE ev.employee = e.id
                 AND ev.available_vacation_days < 0
             )
           ORDER BY random()
           LIMIT 1`,
        )
        .catch(() => null);

      if (row) {
        username = row.login;
        hasNegativeBalance = true;
      }
    } finally {
      await db.close();
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 45);

    const args: Tc033Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
      hasNegativeBalance,
    };

    saveToDisk("VacationTc033Data", args);
    return new VacationTc033Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
      args.hasNegativeBalance,
    );
  }
}
