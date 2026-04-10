declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findOptionalApproverFor, hasVacationConflict } from "./queries/vacationQueries";

interface Tc022Args {
  vacationOwner: string;
  vacationOwnerName: string;
  optionalApproverLogin: string;
  optionalApproverName: string;
  startDateIso: string;
  endDateIso: string;
  newEndDateIso: string;
}

/**
 * TC-VAC-022: Approval resets on date edit.
 * Creates vacation with optional approver, OA approves, then owner edits dates.
 * Verifies vacation_approval.status resets from APPROVED to ASKED after edit.
 */
export class VacationTc022Data {
  readonly vacationOwner: string;
  readonly vacationOwnerName: string;
  readonly vacationOwnerLastName: string;
  readonly optionalApproverLogin: string;
  readonly optionalApproverName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly newEndDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly newEndInput: string;
  readonly periodPattern: RegExp;
  readonly newPeriodPattern: RegExp;

  constructor(args: Tc022Args) {
    this.vacationOwner = args.vacationOwner;
    this.vacationOwnerName = args.vacationOwnerName;
    this.vacationOwnerLastName =
      args.vacationOwnerName.split(" ").pop() ?? args.vacationOwnerName;
    this.optionalApproverLogin = args.optionalApproverLogin;
    this.optionalApproverName = args.optionalApproverName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.newEndDateIso = args.newEndDateIso;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    this.newEndInput = toCalendarFormat(args.newEndDateIso);
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
    this.newPeriodPattern = toPeriodPattern(args.startDateIso, args.newEndDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc022Data> {
    const vacationOwner = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc022Data({
        vacationOwner,
        vacationOwnerName: "Pavel Weinmeister",
        optionalApproverLogin: process.env.VAC_TC022_OA ?? "kchapkevich",
        optionalApproverName: "Ksenia Chapkevich",
        startDateIso: "2026-10-19",
        endDateIso: "2026-10-23",
        newEndDateIso: "2026-10-30",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc022Args>("VacationTc022Data");
      if (cached) return new VacationTc022Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const oa = await findOptionalApproverFor(db, vacationOwner);

      const ownerRow = await db.queryOne<{ display_name: string }>(
        `SELECT COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS display_name
         FROM ttt_vacation.employee e
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.login = $1`,
        [vacationOwner],
      );

      const { startDate, endDate, newEndDate } = await findTwoAvailableWeeks(
        db,
        vacationOwner,
        6,
      );

      const args: Tc022Args = {
        vacationOwner,
        vacationOwnerName: ownerRow.display_name,
        optionalApproverLogin: oa.login,
        optionalApproverName: oa.display_name,
        startDateIso: startDate,
        endDateIso: endDate,
        newEndDateIso: newEndDate,
      };

      saveToDisk("VacationTc022Data", args);
      return new VacationTc022Data(args);
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

async function findTwoAvailableWeeks(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 20,
): Promise<{ startDate: string; endDate: string; newEndDate: string }> {
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
    const newEnd = new Date(start);
    newEnd.setDate(start.getDate() + 11); // second Friday

    const startIso = toIso(start);
    const endIso = toIso(end);
    const newEndIso = toIso(newEnd);

    if (!(await hasVacationConflict(db, login, startIso, newEndIso))) {
      return { startDate: startIso, endDate: endIso, newEndDate: newEndIso };
    }
  }
  throw new Error(`No two consecutive conflict-free weeks found for ${login}`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
