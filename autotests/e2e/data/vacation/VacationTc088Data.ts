declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";

interface Tc088Args {
  readOnlyLogin: string;
}

/**
 * TC-VAC-088: ReadOnly user cannot create vacation.
 * Finds an employee with read_only=true and verifies the Create button
 * is hidden or disabled on the My Vacations page.
 */
export class VacationTc088Data {
  readonly readOnlyLogin: string;

  constructor(
    readOnlyLogin = process.env.VAC_TC088_USER ?? "",
  ) {
    this.readOnlyLogin = readOnlyLogin;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc088Data> {
    if (mode === "static") return new VacationTc088Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc088Args>("VacationTc088Data");
      if (cached) return new VacationTc088Data(cached.readOnlyLogin);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_vacation.employee ve ON ve.login = be.login
         WHERE be.read_only = true
           AND ve.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );

      const args: Tc088Args = { readOnlyLogin: row.login };
      saveToDisk("VacationTc088Data", args);
      return new VacationTc088Data(args.readOnlyLogin);
    } finally {
      await db.close();
    }
  }
}
