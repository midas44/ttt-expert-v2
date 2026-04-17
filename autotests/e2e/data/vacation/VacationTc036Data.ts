declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithLimitedDays } from "./queries/vacationQueries";

interface Tc036Args {
  username: string;
  availableDays: number;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-036: Insufficient available days — REGULAR blocked.
 * Employee with 1-5 available days tries to create a vacation exceeding their balance.
 * Expected: red error message, submit blocked.
 */
export class VacationTc036Data {
  readonly username: string;
  readonly availableDays: number;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly requestedDays: number;

  constructor(args: Tc036Args) {
    this.username = args.username;
    this.availableDays = args.availableDays;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    // Approximate working days in the range (3 weeks = ~15 days, well over 5 max)
    this.requestedDays = 15;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc036Data> {
    if (mode === "static") {
      return new VacationTc036Data({
        username: process.env.VAC_TC036_USER ?? "pvaynmaster",
        availableDays: 3,
        startDateIso: "2026-10-05",
        endDateIso: "2026-10-23",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc036Args>("VacationTc036Data");
      if (cached) return new VacationTc036Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithLimitedDays(db);

      // Build a 3-week date range starting 8 weeks from now (well exceeding available days)
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      const start = new Date(now);
      start.setDate(now.getDate() + daysToMon + 8 * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 18); // 3 weeks Mon-Fri = ~15 working days

      const args: Tc036Args = {
        username: emp.login,
        availableDays: emp.available_days,
        startDateIso: toIso(start),
        endDateIso: toIso(end),
      };

      saveToDisk("VacationTc036Data", args);
      return new VacationTc036Data(args);
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

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
