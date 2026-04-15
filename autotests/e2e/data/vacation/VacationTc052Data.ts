declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findThreeAvailableWeekSlots } from "./queries/vacationQueries";

interface Tc052Args {
  username: string;
  vac1StartIso: string;
  vac1EndIso: string;
  vac2StartIso: string;
  vac2EndIso: string;
  vac3StartIso: string;
  vac3EndIso: string;
}

/**
 * TC-VAC-052: Sort by Vacation dates column.
 * Creates 3 vacations at different date ranges for pvaynmaster.
 * vac1 is earliest, vac3 is latest.
 */
export class VacationTc052Data {
  readonly username: string;
  readonly vac1StartIso: string;
  readonly vac1EndIso: string;
  readonly vac2StartIso: string;
  readonly vac2EndIso: string;
  readonly vac3StartIso: string;
  readonly vac3EndIso: string;
  readonly vac1Pattern: RegExp;
  readonly vac2Pattern: RegExp;
  readonly vac3Pattern: RegExp;

  constructor(args: Tc052Args) {
    this.username = args.username;
    this.vac1StartIso = args.vac1StartIso;
    this.vac1EndIso = args.vac1EndIso;
    this.vac2StartIso = args.vac2StartIso;
    this.vac2EndIso = args.vac2EndIso;
    this.vac3StartIso = args.vac3StartIso;
    this.vac3EndIso = args.vac3EndIso;
    this.vac1Pattern = toPeriodPattern(args.vac1StartIso, args.vac1EndIso);
    this.vac2Pattern = toPeriodPattern(args.vac2StartIso, args.vac2EndIso);
    this.vac3Pattern = toPeriodPattern(args.vac3StartIso, args.vac3EndIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc052Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc052Data({
        username,
        vac1StartIso: "2026-08-03",
        vac1EndIso: "2026-08-07",
        vac2StartIso: "2026-09-07",
        vac2EndIso: "2026-09-11",
        vac3StartIso: "2026-10-05",
        vac3EndIso: "2026-10-09",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc052Args>("VacationTc052Data");
      if (cached) return new VacationTc052Data(cached);
    }

    const db = new DbClient(tttConfig);
    let weeks: {
      week1Start: string;
      week1End: string;
      week2Start: string;
      week2End: string;
      week3Start: string;
      week3End: string;
    };
    try {
      weeks = await findThreeAvailableWeekSlots(db, username, 4, 60);
    } finally {
      await db.close();
    }

    const args: Tc052Args = {
      username,
      vac1StartIso: weeks.week1Start,
      vac1EndIso: weeks.week1End,
      vac2StartIso: weeks.week2Start,
      vac2EndIso: weeks.week2End,
      vac3StartIso: weeks.week3Start,
      vac3EndIso: weeks.week3End,
    };

    saveToDisk("VacationTc052Data", args);
    return new VacationTc052Data(args);
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
