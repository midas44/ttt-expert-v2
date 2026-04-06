declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc087Args {
  tokenOwner: string;
  managerBLogin: string;
  startDateIso: string;
  endDateIso: string;
  tokenOwnerName: string;
}

/**
 * TC-VAC-087: Non-approver cannot approve vacation.
 * Creates a vacation for pvaynmaster (CPO, self-approves).
 * Finds Manager B — a different manager who has subordinates.
 * UI: Login as Manager B, verify pvaynmaster's vacation is NOT in their approval queue.
 * API: Try to approve an existing vacation (not assigned to pvaynmaster) via rawPut → expect 400.
 */
export class VacationTc087Data {
  readonly tokenOwner: string;
  readonly managerBLogin: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly tokenOwnerName: string;
  readonly periodPattern: RegExp;
  /** ID of an existing NEW vacation where approver != pvaynmaster, for API 400 check. 0 if none found. */
  readonly foreignVacationId: number;

  constructor(
    tokenOwner = process.env.VAC_TC087_OWNER ?? "pvaynmaster",
    managerBLogin = "",
    startDateIso = "",
    endDateIso = "",
    tokenOwnerName = "Vayn Master",
    foreignVacationId = 0,
  ) {
    this.tokenOwner = tokenOwner;
    this.managerBLogin = managerBLogin;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.tokenOwnerName = tokenOwnerName;
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
    this.foreignVacationId = foreignVacationId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc087Data> {
    const tokenOwner = "pvaynmaster";

    if (mode === "static") return new VacationTc087Data(tokenOwner);

    if (mode === "saved") {
      const cached = loadSaved<Tc087Args>("VacationTc087Data");
      if (cached) {
        return new VacationTc087Data(
          cached.tokenOwner,
          cached.managerBLogin,
          cached.startDateIso,
          cached.endDateIso,
          cached.tokenOwnerName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // Find a conflict-free week for pvaynmaster
      const { startDate, endDate } = await findAvailableWeek(db, tokenOwner, 10);

      // Get pvaynmaster's display name
      const nameRow = await db.queryOne<{ name: string }>(
        `SELECT COALESCE(latin_first_name || ' ' || latin_last_name, login) AS name
         FROM ttt_backend.employee WHERE login = $1`,
        [tokenOwner],
      );

      // Find Manager B: enabled employee who has subordinates, is NOT pvaynmaster
      const managerB = await db.queryOne<{ login: string }>(
        `SELECT m.login
         FROM ttt_vacation.employee m
         WHERE m.enabled = true
           AND m.login != $1
           AND EXISTS (
             SELECT 1 FROM ttt_vacation.employee e
             WHERE e.manager = m.id AND e.enabled = true
           )
         ORDER BY random()
         LIMIT 1`,
        [tokenOwner],
      );

      // Try to find a NEW vacation where approver != pvaynmaster (for API 400 check)
      let foreignVacId = 0;
      try {
        const foreignRow = await db.queryOne<{ id: string }>(
          `SELECT v.id::text AS id
           FROM ttt_vacation.vacation v
           JOIN ttt_vacation.employee a ON v.approver = a.id
           WHERE v.status = 'NEW'
             AND a.login != $1
           ORDER BY v.id DESC
           LIMIT 1`,
          [tokenOwner],
        );
        foreignVacId = Number(foreignRow.id);
      } catch {
        // No suitable vacation found — API check will be skipped
      }

      const args: Tc087Args = {
        tokenOwner,
        managerBLogin: managerB.login,
        startDateIso: startDate,
        endDateIso: endDate,
        tokenOwnerName: nameRow.name,
      };

      saveToDisk("VacationTc087Data", args);
      return new VacationTc087Data(
        args.tokenOwner,
        args.managerBLogin,
        args.startDateIso,
        args.endDateIso,
        args.tokenOwnerName,
        foreignVacId,
      );
    } finally {
      await db.close();
    }
  }
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

async function findAvailableWeek(
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

    const startIso = toIso(start);
    const endIso = toIso(end);

    if (!(await hasVacationConflict(db, login, startIso, endIso))) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(`No conflict-free week found for ${login} within ${maxAttempts} weeks`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
