declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc041Args {
  username: string;
  firstDateIso: string;
  restrictedStartIso: string;
  restrictedEndIso: string;
  restrictedStartInput: string;
  restrictedEndInput: string;
}

/**
 * TC-VAC-041: First 3 months — ADMINISTRATIVE not restricted (#3014).
 * Finds a recently-hired employee (same criteria as TC-VAC-040) whose 3-month
 * restriction window is still active. Test verifies ADMINISTRATIVE vacation
 * within the restriction period is allowed (no validation error, save succeeds).
 */
export class VacationTc041Data {
  readonly username: string;
  readonly firstDateIso: string;
  readonly restrictedStartIso: string;
  readonly restrictedEndIso: string;
  readonly restrictedStartInput: string;
  readonly restrictedEndInput: string;

  constructor(args: Tc041Args) {
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
  ): Promise<VacationTc041Data> {
    if (mode === "static") {
      return new VacationTc041Data({
        username: "newemployee",
        firstDateIso: "",
        restrictedStartIso: "",
        restrictedEndIso: "",
        restrictedStartInput: "",
        restrictedEndInput: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc041Args>("VacationTc041Data");
      if (cached) return new VacationTc041Data(cached);
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

      // Find a conflict-free Mon-Wed slot within the restriction period
      const today = new Date();
      let start: Date | null = null;
      let end: Date | null = null;

      for (let w = 0; w < 12; w++) {
        const candidate = nextMonday(today);
        candidate.setDate(candidate.getDate() + w * 7);
        const candidateEnd = new Date(candidate);
        candidateEnd.setDate(candidate.getDate() + 2); // Mon-Wed

        // Must be within restriction period
        if (candidate >= restrictionEnd) break;

        const startIso = toIso(candidate);
        const endIso = toIso(candidateEnd);
        if (!(await hasVacationConflict(db, row.login, startIso, endIso))) {
          start = candidate;
          end = candidateEnd;
          break;
        }
      }

      if (!start || !end) {
        throw new Error(
          `No conflict-free dates within 3-month restriction for ${row.login} ` +
            `(first_date=${row.first_date}, restriction_end=${toIso(restrictionEnd)})`,
        );
      }

      const args: Tc041Args = {
        username: row.login,
        firstDateIso: row.first_date,
        restrictedStartIso: toIso(start),
        restrictedEndIso: toIso(end),
        restrictedStartInput: toCalendarFormat(toIso(start)),
        restrictedEndInput: toCalendarFormat(toIso(end)),
      };

      saveToDisk("VacationTc041Data", args);
      return new VacationTc041Data(args);
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
