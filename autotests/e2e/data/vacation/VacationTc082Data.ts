declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { loadSaved, saveToDisk } from "../savedDataStore";

interface Tc082Args {
  username: string;
}

/**
 * TC-VAC-082: Russian messages in English events feed (#3344).
 * Needs an employee who has vacation events (create/approve/reject history).
 * pvaynmaster is the API token owner and always has vacation activity from tests.
 */
export class VacationTc082Data {
  readonly username: string;

  constructor(args: Tc082Args) {
    this.username = args.username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc082Data> {
    if (mode === "static") {
      return new VacationTc082Data({ username: "pvaynmaster" });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc082Args>("VacationTc082Data");
      if (cached) return new VacationTc082Data(cached);
    }

    // Dynamic: find an employee with vacation events
    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT DISTINCT e.login
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE e.enabled = true
           AND e.login = 'pvaynmaster'
         LIMIT 1`,
      );
      const args: Tc082Args = { username: row.login };
      if (mode === "saved") saveToDisk("VacationTc082Data", args);
      return new VacationTc082Data(args);
    } finally {
      await db.close();
    }
  }
}
