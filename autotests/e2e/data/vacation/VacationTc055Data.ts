declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";

interface Tc055Args {
  username: string;
  searchName: string;
  expectedEmployee: string;
}

/**
 * TC-VAC-055: Employees Vacation Days page — search by name.
 * Needs a DM user to access /vacation/vacation-days (VACATIONS:VIEW_EMPLOYEES permission),
 * plus a known employee name to search for.
 */
export class VacationTc055Data {
  readonly username: string;
  readonly searchName: string;
  readonly expectedEmployee: string;

  constructor(args: Tc055Args) {
    this.username = args.username;
    this.searchName = args.searchName;
    this.expectedEmployee = args.expectedEmployee;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc055Data> {
    if (mode === "static") {
      return new VacationTc055Data({
        username: process.env.VAC_TC055_USER ?? "pvaynmaster",
        searchName: "Pavel",
        expectedEmployee: "Pavel",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc055Args>("VacationTc055Data");
      if (cached) return new VacationTc055Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find a DM user who can access vacation-days page
      const dm = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
         ORDER BY random()
         LIMIT 1`,
      );

      // Find an employee with a latin last name (more unique for search filtering)
      const emp = await db.queryOne<{
        search_term: string;
        full_name: string;
      }>(
        `SELECT be.latin_last_name AS search_term,
                be.latin_first_name || ' ' || be.latin_last_name AS full_name
         FROM ttt_backend.employee be
         JOIN ttt_vacation.employee ve ON ve.login = be.login
         WHERE be.enabled = true
           AND be.latin_last_name IS NOT NULL
           AND LENGTH(be.latin_last_name) >= 5
           AND ve.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );

      const args: Tc055Args = {
        username: dm.login,
        searchName: emp.search_term,
        expectedEmployee: emp.full_name,
      };

      saveToDisk("VacationTc055Data", args);
      return new VacationTc055Data(args);
    } finally {
      await db.close();
    }
  }
}
