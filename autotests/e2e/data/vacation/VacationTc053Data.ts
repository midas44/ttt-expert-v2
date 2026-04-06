declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findTwoAvailableWeekSlots } from "./queries/vacationQueries";

interface Tc053Args {
  username: string;
  vac1StartIso: string;
  vac1EndIso: string;
  vac2StartIso: string;
  vac2EndIso: string;
}

/**
 * TC-VAC-053: Table footer — Total row sums.
 * Creates 2 REGULAR vacations for pvaynmaster to verify footer totals.
 */
export class VacationTc053Data {
  readonly username: string;
  readonly vac1StartIso: string;
  readonly vac1EndIso: string;
  readonly vac2StartIso: string;
  readonly vac2EndIso: string;
  readonly vac1Pattern: RegExp;
  readonly vac2Pattern: RegExp;

  constructor(args: Tc053Args) {
    this.username = args.username;
    this.vac1StartIso = args.vac1StartIso;
    this.vac1EndIso = args.vac1EndIso;
    this.vac2StartIso = args.vac2StartIso;
    this.vac2EndIso = args.vac2EndIso;
    this.vac1Pattern = toPeriodPattern(args.vac1StartIso, args.vac1EndIso);
    this.vac2Pattern = toPeriodPattern(args.vac2StartIso, args.vac2EndIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc053Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc053Data({
        username,
        vac1StartIso: "2026-09-28",
        vac1EndIso: "2026-10-02",
        vac2StartIso: "2026-10-19",
        vac2EndIso: "2026-10-23",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc053Args>("VacationTc053Data");
      if (cached) return new VacationTc053Data(cached);
    }

    const db = new DbClient(tttConfig);
    let weeks: {
      week1Start: string;
      week1End: string;
      week2Start: string;
      week2End: string;
    };
    try {
      weeks = await findTwoAvailableWeekSlots(db, username, 12, 40);
    } finally {
      await db.close();
    }

    const args: Tc053Args = {
      username,
      vac1StartIso: weeks.week1Start,
      vac1EndIso: weeks.week1End,
      vac2StartIso: weeks.week2Start,
      vac2EndIso: weeks.week2End,
    };

    saveToDisk("VacationTc053Data", args);
    return new VacationTc053Data(args);
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
