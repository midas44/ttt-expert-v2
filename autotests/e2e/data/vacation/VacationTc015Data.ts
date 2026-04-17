declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc015Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-015: Approve NEW vacation — happy path.
 * SETUP: API creates a vacation for pvaynmaster (CPO, self-approver).
 * Test: login as pvaynmaster → Employee Requests → Approval tab → approve.
 */
export class VacationTc015Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC015_USER ?? "pvaynmaster",
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
  ): Promise<VacationTc015Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc015Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc015Args>("VacationTc015Data");
      if (cached) {
        return new VacationTc015Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 11, 40);

    const args: Tc015Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
    };

    saveToDisk("VacationTc015Data", args);
    return new VacationTc015Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
    );
  }
}

/** Builds a regex matching the EN period column text, e.g. "13 – 17 Apr 2026". */
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
