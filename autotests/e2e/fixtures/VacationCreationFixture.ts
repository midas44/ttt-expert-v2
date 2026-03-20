import { expect, type Page } from "@playwright/test";
import type { GlobalConfig } from "../config/globalConfig";
import { MyVacationsPage } from "../pages/MainPage";

export interface VacationRecordData {
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;
  readonly periodLabel?: string;
}

export class VacationCreationFixture {
  private readonly vacationsPage: MyVacationsPage;

  constructor(
    private readonly page: Page,
    private readonly globalConfig: GlobalConfig,
  ) {
    this.vacationsPage = new MyVacationsPage(page);
  }

  /** Waits for the vacations page to be ready. */
  async ensureOnPage(): Promise<void> {
    await this.vacationsPage.waitForReady();
  }

  /**
   * Creates a vacation request:
   * 1. Opens the create dialog
   * 2. Fills the date period
   * 3. Submits the form
   * 4. Waits for the vacation row to appear
   * 5. Asserts exactly one matching row exists
   */
  async createVacation(data: VacationRecordData): Promise<void> {
    const dialog = await this.vacationsPage.openCreateRequest();
    await dialog.fillVacationPeriod(data.startInput, data.endInput);
    await dialog.submit();

    const row = await this.vacationsPage.waitForVacationRow(
      data.periodPattern,
    );
    await expect(row).toHaveCount(1);
    await this.globalConfig.delay();
  }
}
