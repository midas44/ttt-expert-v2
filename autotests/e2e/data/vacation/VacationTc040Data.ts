declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc040Args {
  username: string;
  firstDateIso: string;
  restrictedStartIso: string;
  restrictedEndIso: string;
  restrictedStartInput: string;
  restrictedEndInput: string;
}

/**
 * TC-VAC-040: First 3 months restriction — new employee (#3014).
 * Finds an employee hired within last 90 days whose 3-month restriction window
 * is still in the future. Test verifies REGULAR vacation within restriction is
 * rejected (HTTP 400), while ADMINISTRATIVE is not restricted.
 */
export class VacationTc040Data {
  readonly username: string;
  readonly firstDateIso: string;
  readonly restrictedStartIso: string;
  readonly restrictedEndIso: string;
  readonly restrictedStartInput: string;
  readonly restrictedEndInput: string;

  constructor(args: Tc040Args) {
    this.username = args.username;
    this.firstDateIso = args.firstDateIso;
    this.restrictedStartIso = args.restrictedStartIso;
    this.restrictedEndIso = args.restrictedEndIso;
    this.restrictedStartInput = args.restrictedStartInput;
    this.restrictedEndInput = args.restrictedEndInput;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc040Data> {
    if (mode === "static") {
      return new VacationTc040Data({
        username: "newemployee",
        firstDateIso: "",
        restrictedStartIso: "",
        restrictedEndIso: "",
        restrictedStartInput: "",
        restrictedEndInput: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc040Args>("VacationTc040Data");
      if (cached) return new VacationTc040Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find employee hired within last 90 days with a manager
      const row = await db.queryOne<{ login: string; first_date: string }>(
        `SELECT e.login, e.first_date::text AS first_date
         FROM ttt_vacation.employee e
         WHERE e.first_date > CURRENT_DATE - INTERVAL '90 days'
           AND e.enabled = true
           AND e.manager IS NOT NULL
         ORDER BY e.first_date DESC, random()
         LIMIT 1`,
      );

      const firstDate = new Date(row.first_date);
      const restrictionEnd = new Date(firstDate);
      restrictionEnd.setMonth(restrictionEnd.getMonth() + 3);

      // Find the next Monday from today
      const today = new Date();
      const start = nextMonday(today);
      const end = new Date(start);
      end.setDate(start.getDate() + 4); // Mon-Fri

      // If restriction period already passed, can't test
      if (start >= restrictionEnd) {
        throw new Error(
          `Employee ${row.login} restriction period already passed ` +
            `(first_date=${row.first_date}, restriction_end=${toIso(restrictionEnd)})`,
        );
      }

      const args: Tc040Args = {
        username: row.login,
        firstDateIso: row.first_date,
        restrictedStartIso: toIso(start),
        restrictedEndIso: toIso(end),
        restrictedStartInput: toCalendarFormat(toIso(start)),
        restrictedEndInput: toCalendarFormat(toIso(end)),
      };

      if (mode === "saved") saveToDisk("VacationTc040Data", args);
      return new VacationTc040Data(args);
    } finally {
      await db.close();
    }
  }
}

function nextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  const add = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + add);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
