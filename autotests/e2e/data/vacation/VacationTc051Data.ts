declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findTwoAvailableWeekSlots } from "./queries/vacationQueries";

interface Tc051Args {
  username: string;
  newVacStartIso: string;
  newVacEndIso: string;
  approvedVacStartIso: string;
  approvedVacEndIso: string;
}

/**
 * TC-VAC-051: Column filter — Status: Approved only.
 * Creates one NEW + one APPROVED vacation for pvaynmaster.
 */
export class VacationTc051Data {
  readonly username: string;
  readonly newVacStartIso: string;
  readonly newVacEndIso: string;
  readonly approvedVacStartIso: string;
  readonly approvedVacEndIso: string;
  readonly newPeriodPattern: RegExp;
  readonly approvedPeriodPattern: RegExp;

  constructor(args: Tc051Args) {
    this.username = args.username;
    this.newVacStartIso = args.newVacStartIso;
    this.newVacEndIso = args.newVacEndIso;
    this.approvedVacStartIso = args.approvedVacStartIso;
    this.approvedVacEndIso = args.approvedVacEndIso;
    this.newPeriodPattern = toPeriodPattern(
      args.newVacStartIso,
      args.newVacEndIso,
    );
    this.approvedPeriodPattern = toPeriodPattern(
      args.approvedVacStartIso,
      args.approvedVacEndIso,
    );
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc051Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc051Data({
        username,
        newVacStartIso: "2026-09-21",
        newVacEndIso: "2026-09-25",
        approvedVacStartIso: "2026-10-12",
        approvedVacEndIso: "2026-10-16",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc051Args>("VacationTc051Data");
      if (cached) return new VacationTc051Data(cached);
    }

    const db = new DbClient(tttConfig);
    let weeks: {
      week1Start: string;
      week1End: string;
      week2Start: string;
      week2End: string;
    };
    try {
      weeks = await findTwoAvailableWeekSlots(db, username, 8, 40);
    } finally {
      await db.close();
    }

    const args: Tc051Args = {
      username,
      newVacStartIso: weeks.week1Start,
      newVacEndIso: weeks.week1End,
      approvedVacStartIso: weeks.week2Start,
      approvedVacEndIso: weeks.week2End,
    };

    saveToDisk("VacationTc051Data", args);
    return new VacationTc051Data(args);
  }
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
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
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}
