declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc089Args {
  accountantLogin: string;
  accountantName: string;
}

/**
 * TC-VAC-089: Accountant can pay but not approve.
 * Needs a ROLE_ACCOUNTANT user who is also an office accountant.
 * The test logs in as the accountant, verifies payment page access,
 * then confirms approve via API is blocked.
 */
export class VacationTc089Data {
  readonly accountantLogin: string;
  readonly accountantName: string;

  constructor(args: Tc089Args) {
    this.accountantLogin = args.accountantLogin;
    this.accountantName = args.accountantName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc089Data> {
    if (mode === "static") {
      return new VacationTc089Data({
        accountantLogin: process.env.VAC_TC089_USER ?? "afedotova",
        accountantName: "Anastasia Fedotova",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc089Args>("VacationTc089Data");
      if (cached) return new VacationTc089Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{
        login: string;
        display_name: string;
      }>(
        `SELECT be.login,
                COALESCE(be.latin_first_name || ' ' || be.latin_last_name, be.login) AS display_name
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         JOIN ttt_vacation.employee ve ON ve.login = be.login
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_ACCOUNTANT'
           AND ve.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );

      const args: Tc089Args = {
        accountantLogin: row.login,
        accountantName: row.display_name,
      };

      if (mode === "saved") saveToDisk("VacationTc089Data", args);
      return new VacationTc089Data(args);
    } finally {
      await db.close();
    }
  }
}
