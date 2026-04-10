declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findCpoEmployeeWithManager, hasVacationConflict } from "./queries/vacationQueries";

interface Tc019Args {
  username: string;
  employeeName: string;
  managerName: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-019: CPO self-approval on create.
 * CPO (ROLE_DEPARTMENT_MANAGER) creates vacation — "Approved by" shows themselves,
 * "Agreed by" shows their manager.
 */
export class VacationTc019Data {
  readonly username: string;
  readonly employeeName: string;
  readonly managerName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc019Args) {
    this.username = args.username;
    this.employeeName = args.employeeName;
    this.managerName = args.managerName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc019Data> {
    if (mode === "static") {
      return new VacationTc019Data({
        username: process.env.VAC_TC019_USER ?? "pvaynmaster",
        employeeName: "Pavel Vaynmaster",
        managerName: "Dmitry Ponomarev",
        startDateIso: "2026-09-07",
        endDateIso: "2026-09-11",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc019Args>("VacationTc019Data");
      if (cached) return new VacationTc019Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const cpo = await findCpoEmployeeWithManager(db, 10);
      const { startDate, endDate } = await findAvailableWeek(
        db,
        cpo.employee_login,
        12,
      );

      const args: Tc019Args = {
        username: cpo.employee_login,
        employeeName: cpo.employee_name,
        managerName: cpo.manager_name,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      saveToDisk("VacationTc019Data", args);
      return new VacationTc019Data(args);
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
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

async function findAvailableWeek(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 40,
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

    const startIso = toIso(start);
    const endIso = toIso(end);

    if (!(await hasVacationConflict(db, login, startIso, endIso))) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(
    `No conflict-free week found for ${login} within ${maxAttempts} weeks`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
