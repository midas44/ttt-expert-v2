declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithColleague,
  hasVacationConflict,
  countVacationNotifyAlso,
} from "./queries/vacationQueries";

interface Tc004Args {
  creatorLogin: string;
  colleagueLogin: string;
  colleagueName: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-004: Create vacation with 'Also notify' recipients.
 * Needs an employee with >=3 available vacation days, a manager,
 * and a colleague in the same office (for the notify list).
 */
export class VacationTc004Data {
  readonly username: string;
  readonly colleagueLogin: string;
  readonly colleagueName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(
    creatorLogin = process.env.VAC_TC004_USER ?? "pvaynmaster",
    colleagueLogin = "",
    colleagueName = "",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = creatorLogin;
    this.colleagueLogin = colleagueLogin;
    this.colleagueName = colleagueName;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(endDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  /** Verifies the notify-also DB record was saved after vacation creation. */
  async verifyNotifyAlso(tttConfig: TttConfig): Promise<number> {
    const db = new DbClient(tttConfig);
    try {
      return await countVacationNotifyAlso(
        db,
        this.username,
        this.startDateIso,
        this.endDateIso,
      );
    } finally {
      await db.close();
    }
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc004Data> {
    if (mode === "static") return new VacationTc004Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc004Args>("VacationTc004Data");
      if (cached) {
        return new VacationTc004Data(
          cached.creatorLogin,
          cached.colleagueLogin,
          cached.colleagueName,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithColleague(db, 3);
      const { startDate, endDate } = await findAvailableThreeDays(
        db,
        emp.creator_login,
        4,
      );

      const args: Tc004Args = {
        creatorLogin: emp.creator_login,
        colleagueLogin: emp.colleague_login,
        colleagueName: emp.colleague_name,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      saveToDisk("VacationTc004Data", args);
      return new VacationTc004Data(
        args.creatorLogin,
        args.colleagueLogin,
        args.colleagueName,
        args.startDateIso,
        args.endDateIso,
      );
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

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

/** Finds a conflict-free Mon–Wed (3 working days) starting weeksAhead from now. */
async function findAvailableThreeDays(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 20,
): Promise<{ startDate: string; endDate: string }> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 2); // Wednesday

    const startIso = toIso(start);
    const endIso = toIso(end);

    if (!(await hasVacationConflict(db, login, startIso, endIso))) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(
    `No conflict-free 3-day window found for ${login} within ${maxAttempts} weeks`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
