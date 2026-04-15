declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";

interface Tc056Args {
  managerLogin: string;
  targetLogin: string;
  latinLastName: string;
  russianLastName: string;
  targetDisplayName: string;
}

/**
 * TC-VAC-056: Latin name search bug (#3297).
 * Bug: search by Latin name on /vacation/vacation-days returns no results.
 * Cyrillic search works. The backend endpoint ignores the search parameter.
 */
export class VacationTc056Data {
  readonly managerLogin: string;
  readonly targetLogin: string;
  readonly latinLastName: string;
  readonly russianLastName: string;
  readonly targetDisplayName: string;

  constructor(args: Tc056Args) {
    this.managerLogin = args.managerLogin;
    this.targetLogin = args.targetLogin;
    this.latinLastName = args.latinLastName;
    this.russianLastName = args.russianLastName;
    this.targetDisplayName = args.targetDisplayName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc056Data> {
    if (mode === "static") {
      return new VacationTc056Data({
        managerLogin: "pvaynmaster",
        targetLogin: "",
        latinLastName: "",
        russianLastName: "",
        targetDisplayName: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc056Args>("VacationTc056Data");
      if (cached) return new VacationTc056Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find an employee with both Latin and Russian names
      const row = await db.queryOne<{
        login: string;
        latin_last_name: string;
        russian_last_name: string;
        display_name: string;
      }>(
        `SELECT be.login,
                be.latin_last_name,
                be.russian_last_name,
                COALESCE(be.latin_first_name || ' ' || be.latin_last_name, be.login) AS display_name
         FROM ttt_backend.employee be
         JOIN ttt_vacation.employee ve ON ve.login = be.login
         WHERE be.latin_last_name IS NOT NULL
           AND be.russian_last_name IS NOT NULL
           AND be.latin_last_name != ''
           AND be.russian_last_name != ''
           AND ve.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );

      const args: Tc056Args = {
        managerLogin: "pvaynmaster",
        targetLogin: row.login,
        latinLastName: row.latin_last_name,
        russianLastName: row.russian_last_name,
        targetDisplayName: row.display_name,
      };

      saveToDisk("VacationTc056Data", args);
      return new VacationTc056Data(args);
    } finally {
      await db.close();
    }
  }
}
