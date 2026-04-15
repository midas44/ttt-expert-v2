declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeWithManager,
  hasSickLeaveConflict,
  hasVacationConflict,
} from "./queries/sickLeaveQueries";

interface SetupArgs {
  username: string;
  managerLogin: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * Shared data class for sick leave tests that need an employee + conflict-free dates.
 * Used by TC-SL-006, TC-SL-008, TC-SL-010, TC-SL-011.
 * The test itself creates the sick leave via UI (as setup step).
 */
export class SickLeaveSetupData {
  readonly username: string;
  readonly managerLogin: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly expectedCalendarDays: number;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.SL_SETUP_USER ?? "pvaynmaster",
    managerLogin = "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = username;
    this.managerLogin = managerLogin;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(endDateIso);
    this.expectedCalendarDays = calcCalendarDays(startDateIso, endDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
    cacheKey = "SickLeaveSetupData",
    daysAhead = 10,
    duration = 4,
  ): Promise<SickLeaveSetupData> {
    if (mode === "static") return new SickLeaveSetupData();

    if (mode === "saved") {
      const cached = loadSaved<SetupArgs>(cacheKey);
      if (cached) {
        return new SickLeaveSetupData(
          cached.username,
          cached.managerLogin,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithManager(db);
      const { startDate, endDate } = await findConflictFreeRange(
        db,
        emp.employee_login,
        daysAhead,
        duration,
      );

      const args: SetupArgs = {
        username: emp.employee_login,
        managerLogin: emp.manager_login,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      saveToDisk(cacheKey, args);
      return new SickLeaveSetupData(
        args.username,
        args.managerLogin,
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

function calcCalendarDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const s = new Date(startIso);
  const e = new Date(endIso);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

async function findConflictFreeRange(
  db: DbClient,
  login: string,
  daysAhead: number,
  duration: number,
  maxAttempts = 30,
): Promise<{ startDate: string; endDate: string }> {
  const now = new Date();

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(now);
    start.setDate(now.getDate() + daysAhead + i * 3);
    const end = new Date(start);
    end.setDate(start.getDate() + duration);

    const startIso = toIso(start);
    const endIso = toIso(end);

    const [slConflict, vacConflict] = await Promise.all([
      hasSickLeaveConflict(db, login, startIso, endIso),
      hasVacationConflict(db, login, startIso, endIso),
    ]);

    if (!slConflict && !vacConflict) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(
    `No conflict-free range found for ${login} within ${maxAttempts} attempts`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
