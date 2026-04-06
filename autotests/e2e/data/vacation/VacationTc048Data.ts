declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc048Args {
  username: string;
  rejectedVacStartIso: string;
  rejectedVacEndIso: string;
}

/**
 * TC-VAC-048: Filter by Closed tab.
 * Creates then rejects a vacation for pvaynmaster.
 * Verifies Closed tab shows the REJECTED vacation.
 * Note: Closed tab shows PAID + REJECTED, NOT CANCELED.
 */
export class VacationTc048Data {
  readonly username: string;
  readonly rejectedVacStartIso: string;
  readonly rejectedVacEndIso: string;
  readonly rejectedPeriodPattern: RegExp;

  constructor(args: Tc048Args) {
    this.username = args.username;
    this.rejectedVacStartIso = args.rejectedVacStartIso;
    this.rejectedVacEndIso = args.rejectedVacEndIso;
    this.rejectedPeriodPattern = toPeriodPattern(
      args.rejectedVacStartIso,
      args.rejectedVacEndIso,
    );
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc048Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc048Data({
        username,
        rejectedVacStartIso: "2026-11-09",
        rejectedVacEndIso: "2026-11-13",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc048Args>("VacationTc048Data");
      if (cached) return new VacationTc048Data(cached);
    }

    const week = await ApiVacationSetupFixture.findAvailableWeek(
      tttConfig, username, 10, 20,
    );

    const args: Tc048Args = {
      username,
      rejectedVacStartIso: week.startDate,
      rejectedVacEndIso: week.endDate,
    };

    saveToDisk("VacationTc048Data", args);
    return new VacationTc048Data(args);
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
