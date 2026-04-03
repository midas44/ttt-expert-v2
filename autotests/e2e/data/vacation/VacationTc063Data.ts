declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc063Args {
  adminUsername: string;
  targetEmployeeLogin: string;
  targetEmployeeLastName: string;
  targetEmployeeFirstName: string;
  currentDays: number;
  currentYear: number;
}

/**
 * TC-VAC-063: Day correction — AV=false prohibits negative.
 * Finds an accountant/admin user and an AV=false employee with positive balance.
 * Picks alphabetically earliest AV=false employee so they appear on page 1 of the table.
 */
export class VacationTc063Data {
  readonly adminUsername: string;
  readonly targetEmployeeLogin: string;
  readonly targetEmployeeLastName: string;
  readonly targetEmployeeFirstName: string;
  /** Display name as shown in the table: "LastName FirstName" */
  readonly targetEmployeeDisplayName: string;
  readonly currentDays: number;
  readonly currentYear: number;

  constructor(args: Tc063Args) {
    this.adminUsername = args.adminUsername;
    this.targetEmployeeLogin = args.targetEmployeeLogin;
    this.targetEmployeeLastName = args.targetEmployeeLastName;
    this.targetEmployeeFirstName = args.targetEmployeeFirstName;
    this.targetEmployeeDisplayName = `${args.targetEmployeeLastName} ${args.targetEmployeeFirstName}`;
    this.currentDays = args.currentDays;
    this.currentYear = args.currentYear;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc063Data> {
    const defaults: Tc063Args = {
      adminUsername: process.env.VAC_TC063_ADMIN ?? "pvaynmaster",
      targetEmployeeLogin: "testuser",
      targetEmployeeLastName: "Abderrahim",
      targetEmployeeFirstName: "Nadim",
      currentDays: 10,
      currentYear: new Date().getFullYear(),
    };
    if (mode === "static") return new VacationTc063Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc063Args>("VacationTc063Data");
      if (cached) return new VacationTc063Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const currentYear = new Date().getFullYear();

      // Find alphabetically earliest AV=false employee with positive vacation days
      // so they appear on page 1 of the correction table (sorted by last name ASC)
      const row = await db.queryOne<{
        login: string;
        first_name: string;
        last_name: string;
        days: string;
      }>(
        `SELECT ve.login,
                ve.latin_first_name AS first_name,
                ve.latin_last_name AS last_name,
                ev.available_vacation_days::text AS days
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office o ON ve.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON ve.id = ev.employee
         WHERE o.advance_vacation = false
           AND ve.enabled = true
           AND ev.year = $1
           AND ev.available_vacation_days > 0
         ORDER BY ve.latin_last_name ASC
         LIMIT 1`,
        [currentYear],
      );

      const args: Tc063Args = {
        adminUsername: "pvaynmaster",
        targetEmployeeLogin: row.login,
        targetEmployeeLastName: row.last_name,
        targetEmployeeFirstName: row.first_name,
        currentDays: Math.round(parseFloat(row.days)),
        currentYear,
      };

      if (mode === "saved") saveToDisk("VacationTc063Data", args);
      return new VacationTc063Data(args);
    } finally {
      await db.close();
    }
  }
}
