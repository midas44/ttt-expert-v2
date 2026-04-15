declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc044Args {
  username: string;
  availableDays: number;
  /** Dates for a LONG vacation exceeding available days (Mon-Fri, 5 working days). */
  longStartInput: string;
  longEndInput: string;
  /** Dates for a SHORT vacation within available days (Mon-Tue, 2 working days). */
  shortStartInput: string;
  shortEndInput: string;
}

/**
 * TC-VAC-044: Dynamic validation — messages update on field change.
 * Finds an employee with limited vacation days (1-4) so we can trigger
 * "insufficient days" when selecting a 5-day period, then show it disappears
 * when shortening to 1-2 days or switching to ADMINISTRATIVE.
 */
export class VacationTc044Data {
  readonly username: string;
  readonly availableDays: number;
  readonly longStartInput: string;
  readonly longEndInput: string;
  readonly shortStartInput: string;
  readonly shortEndInput: string;

  constructor(args: Tc044Args) {
    this.username = args.username;
    this.availableDays = args.availableDays;
    this.longStartInput = args.longStartInput;
    this.longEndInput = args.longEndInput;
    this.shortStartInput = args.shortStartInput;
    this.shortEndInput = args.shortEndInput;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc044Data> {
    if (mode === "static") {
      return new VacationTc044Data({
        username: "pvaynmaster",
        availableDays: 3,
        longStartInput: "06.10.2026",
        longEndInput: "10.10.2026",
        shortStartInput: "06.10.2026",
        shortEndInput: "07.10.2026",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc044Args>("VacationTc044Data");
      if (cached) return new VacationTc044Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find employee with 1-4 available days and a manager
      const row = await db.queryOne<{
        login: string;
        available_days: string;
      }>(
        `SELECT e.login,
                ev.available_vacation_days::text AS available_days
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE ev.available_vacation_days BETWEEN 1 AND 4
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND e.enabled = true
           AND e.manager IS NOT NULL
         ORDER BY random()
         LIMIT 1`,
      );

      const login = row.login;
      const availableDays = parseInt(row.available_days, 10);

      // Find two conflict-free slots: one 5-day (exceeds balance) and one 1-2-day (within)
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;

      let longStart = "";
      let longEnd = "";
      let shortStart = "";
      let shortEnd = "";

      for (let w = 4; w < 50; w++) {
        const start = new Date(now);
        start.setDate(now.getDate() + daysToMon + w * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4); // Mon-Fri (5 working days)
        const startIso = start.toISOString().slice(0, 10);
        const endIso = end.toISOString().slice(0, 10);

        if (await hasVacationConflict(db, login, startIso, endIso)) continue;

        if (!longStart) {
          longStart = startIso;
          longEnd = endIso;
          // Short period = same Mon to Tue (2 working days, within available)
          const shortEndDate = new Date(start);
          shortEndDate.setDate(start.getDate() + 1);
          shortStart = startIso;
          shortEnd = shortEndDate.toISOString().slice(0, 10);
          break;
        }
      }

      if (!longStart) {
        throw new Error(`No conflict-free week found for ${login}`);
      }

      const args: Tc044Args = {
        username: login,
        availableDays,
        longStartInput: toCalendarFormat(longStart),
        longEndInput: toCalendarFormat(longEnd),
        shortStartInput: toCalendarFormat(shortStart),
        shortEndInput: toCalendarFormat(shortEnd),
      };
      saveToDisk("VacationTc044Data", args);
      return new VacationTc044Data(args);
    } finally {
      await db.close();
    }
  }
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
