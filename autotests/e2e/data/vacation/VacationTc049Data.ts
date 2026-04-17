declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findTwoAvailableWeekSlots } from "./queries/vacationQueries";

interface Tc049Args {
  username: string;
  newVacStartIso: string;
  newVacEndIso: string;
  rejectedVacStartIso: string;
  rejectedVacEndIso: string;
}

/**
 * TC-VAC-049: Filter by All tab.
 * Creates one NEW + one REJECTED vacation for pvaynmaster.
 * Verifies All tab shows both open and closed vacations.
 * Note: CANCELED vacations are NOT shown on Any tab — use REJECTED for closed status.
 */
export class VacationTc049Data {
  readonly username: string;
  readonly newVacStartIso: string;
  readonly newVacEndIso: string;
  readonly rejectedVacStartIso: string;
  readonly rejectedVacEndIso: string;
  readonly newPeriodPattern: RegExp;
  readonly rejectedPeriodPattern: RegExp;

  constructor(args: Tc049Args) {
    this.username = args.username;
    this.newVacStartIso = args.newVacStartIso;
    this.newVacEndIso = args.newVacEndIso;
    this.rejectedVacStartIso = args.rejectedVacStartIso;
    this.rejectedVacEndIso = args.rejectedVacEndIso;
    this.newPeriodPattern = toPeriodPattern(args.newVacStartIso, args.newVacEndIso);
    this.rejectedPeriodPattern = toPeriodPattern(args.rejectedVacStartIso, args.rejectedVacEndIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc049Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc049Data({
        username,
        newVacStartIso: "2026-09-21",
        newVacEndIso: "2026-09-25",
        rejectedVacStartIso: "2026-11-16",
        rejectedVacEndIso: "2026-11-20",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc049Args>("VacationTc049Data");
      if (cached) return new VacationTc049Data(cached);
    }

    const db = new DbClient(tttConfig);
    let weeks: { week1Start: string; week1End: string; week2Start: string; week2End: string };
    try {
      weeks = await findTwoAvailableWeekSlots(db, username, 5, 40);
    } finally {
      await db.close();
    }

    const args: Tc049Args = {
      username,
      newVacStartIso: weeks.week1Start,
      newVacEndIso: weeks.week1End,
      rejectedVacStartIso: weeks.week2Start,
      rejectedVacEndIso: weeks.week2End,
    };

    saveToDisk("VacationTc049Data", args);
    return new VacationTc049Data(args);
  }
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
