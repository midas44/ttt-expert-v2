declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findTwoAvailableWeekSlots } from "./queries/vacationQueries";

interface Tc050Args {
  username: string;
  regularStartIso: string;
  regularEndIso: string;
  adminStartIso: string;
  adminEndIso: string;
}

/**
 * TC-VAC-050: Column filter — Vacation type: Regular only.
 * Creates one REGULAR + one ADMINISTRATIVE vacation for pvaynmaster.
 */
export class VacationTc050Data {
  readonly username: string;
  readonly regularStartIso: string;
  readonly regularEndIso: string;
  readonly adminStartIso: string;
  readonly adminEndIso: string;
  readonly regularPeriodPattern: RegExp;
  readonly adminPeriodPattern: RegExp;

  constructor(args: Tc050Args) {
    this.username = args.username;
    this.regularStartIso = args.regularStartIso;
    this.regularEndIso = args.regularEndIso;
    this.adminStartIso = args.adminStartIso;
    this.adminEndIso = args.adminEndIso;
    this.regularPeriodPattern = toPeriodPattern(
      args.regularStartIso,
      args.regularEndIso,
    );
    this.adminPeriodPattern = toPeriodPattern(
      args.adminStartIso,
      args.adminEndIso,
    );
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc050Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc050Data({
        username,
        regularStartIso: "2026-09-14",
        regularEndIso: "2026-09-18",
        adminStartIso: "2026-10-05",
        adminEndIso: "2026-10-09",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc050Args>("VacationTc050Data");
      if (cached) return new VacationTc050Data(cached);
    }

    const db = new DbClient(tttConfig);
    let weeks: {
      week1Start: string;
      week1End: string;
      week2Start: string;
      week2End: string;
    };
    try {
      weeks = await findTwoAvailableWeekSlots(db, username, 6, 40);
    } finally {
      await db.close();
    }

    const args: Tc050Args = {
      username,
      regularStartIso: weeks.week1Start,
      regularEndIso: weeks.week1End,
      adminStartIso: weeks.week2Start,
      adminEndIso: weeks.week2End,
    };

    saveToDisk("VacationTc050Data", args);
    return new VacationTc050Data(args);
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
