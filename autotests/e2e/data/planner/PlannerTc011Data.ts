declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc011Args {
  username: string;
}

/**
 * TC-PLN-011: Notification banners display correctly.
 * Needs an employee who triggers notification banners (e.g., exceeded hours norm,
 * overdue day-off requests). Falls back to pvaynmaster who has both on qa-1.
 */
export class PlannerTc011Data {
  readonly username: string;

  constructor(username = process.env.PLN_TC011_USER ?? "pvaynmaster") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc011Data> {
    if (mode === "static") return new PlannerTc011Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc011Args>("PlannerTc011Data");
      if (cached) return new PlannerTc011Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find employee with overdue day-off requests (good indicator of notification banners)
      const row = await db.queryOne<{ login: string }>(
        `SELECT DISTINCT e.login
         FROM ttt_backend.employee e
         JOIN vacation_backend.employee_dayoff ed ON ed.employee_id = e.id
         JOIN vacation_backend.employee_dayoff_request edr
           ON edr.employee_id = e.id AND edr.public_date = ed.public_date
         WHERE e.enabled = true
           AND e.login IS NOT NULL
           AND edr.status = 'NEW'
           AND ed.public_date < CURRENT_DATE
         ORDER BY random()
         LIMIT 1`,
      );
      const args: Tc011Args = { username: row.login };
      if (mode === "saved") saveToDisk("PlannerTc011Data", args);
      return new PlannerTc011Data(args.username);
    } catch {
      // Fall back to pvaynmaster — known to have notification banners on qa-1
      const args: Tc011Args = { username: "pvaynmaster" };
      if (mode === "saved") saveToDisk("PlannerTc011Data", args);
      return new PlannerTc011Data(args.username);
    } finally {
      await db.close();
    }
  }
}
