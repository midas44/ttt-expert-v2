declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc009Args {
  username: string;
}

/**
 * TC-T3404-009: Previous year (2025) — all edit icons hidden.
 * Needs any enabled employee (all employees have 2025 calendar entries).
 */
export class T3404Tc009Data {
  readonly username: string;
  readonly previousYear: number;

  constructor(
    username = process.env.T3404_TC009_USER ?? "eburets",
  ) {
    this.username = username;
    this.previousYear = new Date().getFullYear() - 1;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc009Data> {
    if (mode === "static") return new T3404Tc009Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc009Args>("T3404Tc009Data");
      if (cached) return new T3404Tc009Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         WHERE e.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );
      const instance = new T3404Tc009Data(row.login);
        saveToDisk("T3404Tc009Data", { username: row.login });
      return instance;
    } finally {
      await db.close();
    }
  }
}
