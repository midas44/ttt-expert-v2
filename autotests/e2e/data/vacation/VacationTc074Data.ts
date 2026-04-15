declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findSubordinateAndAltManager,
  hasVacationConflict,
} from "./queries/vacationQueries";

interface Tc074Args {
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  altManagerLogin: string;
  altManagerName: string;
  startDateIso: string;
  endDateIso: string;
  periodPattern: string;
}

/**
 * TC-VAC-074: Regression — Redirected request status not reset (#2718).
 * SETUP: API creates + approves a vacation for a subordinate of pvaynmaster.
 * Test: Login as pvaynmaster, navigate to Employee Requests, redirect the
 * APPROVED vacation to an alternative manager, verify DB status.
 * Bug #2718 (OPEN): Status should reset to NEW but stays APPROVED.
 */
export class VacationTc074Data {
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly managerLogin: string;
  readonly altManagerLogin: string;
  readonly altManagerName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc074Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeName = args.employeeName;
    this.managerLogin = args.managerLogin;
    this.altManagerLogin = args.altManagerLogin;
    this.altManagerName = args.altManagerName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.periodPattern = new RegExp(args.periodPattern);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc074Data> {
    if (mode === "static") {
      return new VacationTc074Data({
        employeeLogin: "",
        employeeName: "",
        managerLogin: "pvaynmaster",
        altManagerLogin: "",
        altManagerName: "",
        startDateIso: "",
        endDateIso: "",
        periodPattern: ".",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc074Args>("VacationTc074Data");
      if (cached) return new VacationTc074Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const sub = await findSubordinateAndAltManager(db, "pvaynmaster", 5);

      // Find conflict-free week for the subordinate
      const { startDate, endDate } = await findWeek(db, sub.employee_login, 6);

      const MONTHS = [
        "",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const sd = parseInt(startDate.split("-")[2], 10);
      const ed = parseInt(endDate.split("-")[2], 10);
      const em = MONTHS[parseInt(endDate.split("-")[1], 10)];

      const args: Tc074Args = {
        employeeLogin: sub.employee_login,
        employeeName: sub.employee_name,
        managerLogin: sub.manager_login,
        altManagerLogin: sub.alt_manager_login,
        altManagerName: sub.alt_manager_name,
        startDateIso: startDate,
        endDateIso: endDate,
        periodPattern: `${sd}.*${ed}.*${em}`,
      };

      saveToDisk("VacationTc074Data", args);
      return new VacationTc074Data(args);
    } finally {
      await db.close();
    }
  }
}

async function findWeek(
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
    end.setDate(start.getDate() + 4);

    const s = toIso(start);
    const e = toIso(end);

    if (!(await hasVacationConflict(db, login, s, e))) {
      return { startDate: s, endDate: e };
    }
  }
  throw new Error(`No conflict-free week for ${login}`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
