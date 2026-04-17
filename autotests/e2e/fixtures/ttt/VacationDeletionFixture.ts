import type { Page } from "@playwright/test";
import type { GlobalConfig } from "@common/config/globalConfig";
import { MyVacationsPage } from "@ttt/pages/MainPage";
import type { VacationRecordData } from "./VacationCreationFixture";

export class VacationDeletionFixture {
  private readonly vacationsPage: MyVacationsPage;

  constructor(
    private readonly page: Page,
    private readonly globalConfig: GlobalConfig,
  ) {
    this.vacationsPage = new MyVacationsPage(page);
  }

  /**
   * Deletes a vacation matching the given data. Throws if no matching vacation was found.
   */
  async deleteVacation(data: VacationRecordData): Promise<void> {
    const deleted = await this.deleteVacationIfPresent(data);
    if (!deleted) {
      throw new Error(
        `No vacation found matching pattern: ${data.periodPattern}`,
      );
    }
  }

  /**
   * Deletes all vacation rows matching the given data pattern.
   * Loops while matching rows exist: opens details → deletes → waits for row to disappear.
   * Returns true if at least one was deleted.
   */
  async deleteVacationIfPresent(data: VacationRecordData): Promise<boolean> {
    let deletedAny = false;

    for (let attempt = 0; attempt < 20; attempt++) {
      const row = this.vacationsPage.vacationRow(data.periodPattern);
      const count = await row.count();
      if (count === 0) break;

      const detailsDialog = await this.vacationsPage.openRequestDetails(
        data.periodPattern,
      );
      await detailsDialog.deleteRequest();
      await this.vacationsPage.waitForVacationRowToDisappear(
        data.periodPattern,
      );
      await this.globalConfig.delay();
      deletedAny = true;
    }

    return deletedAny;
  }
}
