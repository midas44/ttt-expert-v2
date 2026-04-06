declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc078Args {
  username: string;
  employeeName: string;
}

/**
 * TC-VAC-078: Maternity leave user can't edit vacation (#3370).
 * Needs an employee with maternity_leave=true in ttt_vacation.employee.
 * Bug: available days shows 0 when editing, blocking the action.
 */
export class VacationTc078Data {
  readonly username: string;
  readonly employeeName: string;

  constructor(args: Tc078Args) {
    this.username = args.username;
    this.employeeName = args.employeeName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc078Data> {
    if (mode === "static") {
      return new VacationTc078Data({
        username: process.env.VAC_TC078_USER ?? "afanaseva",
        employeeName: "Anna Afanaseva",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc078Args>("VacationTc078Data");
      if (cached) return new VacationTc078Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{
        login: string;
        display_name: string;
      }>(
        `SELECT ve.login,
                COALESCE(be.latin_first_name || ' ' || be.latin_last_name, ve.login) AS display_name
         FROM ttt_vacation.employee ve
         JOIN ttt_backend.employee be ON be.login = ve.login
         WHERE ve.maternity = true
           AND ve.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );

      const args: Tc078Args = {
        username: row.login,
        employeeName: row.display_name,
      };

      saveToDisk("VacationTc078Data", args);
      return new VacationTc078Data(args);
    } finally {
      await db.close();
    }
  }
}
