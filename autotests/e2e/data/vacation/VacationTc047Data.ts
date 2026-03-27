declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findTwoAvailableWeekSlots } from "./queries/vacationQueries";

interface Tc047Args {
  username: string;
  newVacStartIso: string;
  newVacEndIso: string;
  canceledVacStartIso: string;
  canceledVacEndIso: string;
}

/**
 * TC-VAC-047: Filter by Open tab (default view).
 * Creates one NEW + one CANCELED vacation for pvaynmaster.
 * Verifies Open tab shows NEW but not CANCELED.
 */
export class VacationTc047Data {
  readonly username: string;
  readonly newVacStartIso: string;
  readonly newVacEndIso: string;
  readonly canceledVacStartIso: string;
  readonly canceledVacEndIso: string;
  readonly newPeriodPattern: RegExp;
  readonly canceledPeriodPattern: RegExp;

  constructor(args: Tc047Args) {
    this.username = args.username;
    this.newVacStartIso = args.newVacStartIso;
    this.newVacEndIso = args.newVacEndIso;
    this.canceledVacStartIso = args.canceledVacStartIso;
    this.canceledVacEndIso = args.canceledVacEndIso;
    this.newPeriodPattern = toPeriodPattern(args.newVacStartIso, args.newVacEndIso);
    this.canceledPeriodPattern = toPeriodPattern(args.canceledVacStartIso, args.canceledVacEndIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc047Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc047Data({
        username,
        newVacStartIso: "2026-09-07",
        newVacEndIso: "2026-09-11",
        canceledVacStartIso: "2026-11-02",
        canceledVacEndIso: "2026-11-06",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc047Args>("VacationTc047Data");
      if (cached) return new VacationTc047Data(cached);
    }

    const db = new DbClient(tttConfig);
    let weeks: { week1Start: string; week1End: string; week2Start: string; week2End: string };
    try {
      weeks = await findTwoAvailableWeekSlots(db, username, 4, 40);
    } finally {
      await db.close();
    }

    const args: Tc047Args = {
      username,
      newVacStartIso: weeks.week1Start,
      newVacEndIso: weeks.week1End,
      canceledVacStartIso: weeks.week2Start,
      canceledVacEndIso: weeks.week2End,
    };

    if (mode === "saved") saveToDisk("VacationTc047Data", args);
    return new VacationTc047Data(args);
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
