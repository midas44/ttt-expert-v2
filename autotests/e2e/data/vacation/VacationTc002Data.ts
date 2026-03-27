declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithManager,
  hasVacationConflict,
} from "./queries/vacationQueries";

interface Tc002Args {
  username: string;
  startDateIso: string;
}

/**
 * TC-VAC-002: Create ADMINISTRATIVE (unpaid) vacation.
 * Needs any enabled employee with a manager. No minimum days required —
 * ADMINISTRATIVE does not consume paid balance.
 */
export class VacationTc002Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC002_USER ?? "pvaynmaster",
    startDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = startDateIso; // single day
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(startDateIso);
    this.periodPattern = toPeriodPattern(startDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc002Data> {
    if (mode === "static") return new VacationTc002Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc002Args>("VacationTc002Data");
      if (cached) {
        return new VacationTc002Data(cached.username, cached.startDateIso);
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // ADMINISTRATIVE doesn't need available days, but findEmployeeWithManager
      // requires minDays; pass 0 to skip the balance filter.
      const emp = await findEmployeeWithManager(db, 0);
      const dayIso = await findAvailableMonday(db, emp.employee_login, 2);

      const args: Tc002Args = {
        username: emp.employee_login,
        startDateIso: dayIso,
      };

      if (mode === "saved") saveToDisk("VacationTc002Data", args);
      return new VacationTc002Data(args.username, args.startDateIso);
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

/** Builds a regex matching the EN period column for a single-day vacation, e.g. "13 Apr 2026". */
function toPeriodPattern(iso: string): RegExp {
  if (!iso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = parseInt(iso.split("-")[2], 10);
  const m = MONTHS[parseInt(iso.split("-")[1], 10)];
  return new RegExp(`${d}.*${m}`);
}

/** Finds a conflict-free Monday starting weeksAhead from now. */
async function findAvailableMonday(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 20,
): Promise<string> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

  for (let i = 0; i < maxAttempts; i++) {
    const monday = new Date(base);
    monday.setDate(base.getDate() + i * 7);
    const iso = toIso(monday);
    if (!(await hasVacationConflict(db, login, iso, iso))) {
      return iso;
    }
  }
  throw new Error(
    `No conflict-free Monday found for ${login} within ${maxAttempts} weeks`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
