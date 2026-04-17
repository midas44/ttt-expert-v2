declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc016Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-016: Reject NEW vacation.
 * SETUP: API creates a vacation for pvaynmaster.
 * Test: login as pvaynmaster → Employee Requests → Approval tab → reject.
 */
export class VacationTc016Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC016_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc016Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc016Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc016Args>("VacationTc016Data");
      if (cached) {
        return new VacationTc016Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 12, 40);

    const args: Tc016Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
    };

    saveToDisk("VacationTc016Data", args);
    return new VacationTc016Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
    );
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
