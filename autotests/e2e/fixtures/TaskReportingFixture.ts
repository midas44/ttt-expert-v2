import { expect, type Page, type TestInfo, type Locator } from "@playwright/test";
import type { GlobalConfig } from "../config/globalConfig";
import { VerificationFixture } from "./VerificationFixture";
import { MyTasksPage } from "../pages/MainPage";

export class TaskReportingFixture {
  private readonly tasksPage: MyTasksPage;

  constructor(
    private readonly page: Page,
    private readonly globalConfig: GlobalConfig,
    private readonly verification: VerificationFixture,
  ) {
    this.tasksPage = new MyTasksPage(page);
  }

  /** Waits for the tasks page to be ready. */
  async ensureReady(): Promise<void> {
    await this.tasksPage.waitForReady();
  }

  /**
   * Adds a task from search:
   * 1. Fills search with the given term
   * 2. Clicks "Add a task"
   * 3. Waits for networkidle
   * 4. Gets the matching row
   * 5. Verifies it's visible
   */
  async addTaskFromSearch(
    searchTerm: string,
    rowMatcher: string | RegExp,
    testInfo: TestInfo,
  ): Promise<Locator> {
    await this.tasksPage.addTask(searchTerm);
    await this.page.waitForLoadState("networkidle");
    const row = await this.tasksPage.getTaskRow(rowMatcher);
    await this.verification.verifyLocatorVisible(
      row,
      testInfo,
      `task-added-${typeof rowMatcher === "string" ? rowMatcher : "pattern"}`,
    );
    return row;
  }

  /** Gets a task row, optionally searching first. */
  async getTaskRow(
    rowMatcher: string | RegExp,
    searchTerm?: string,
  ): Promise<Locator> {
    return this.tasksPage.getTaskRow(rowMatcher, searchTerm);
  }

  /**
   * Fills a report value in a specific cell:
   * 1. Gets the day cell for the row and date
   * 2. Opens the inline editor
   * 3. Clears existing content and types the new value
   * 4. Exits editing (Enter + click outside)
   * 5. Optionally verifies the cell text
   * 6. Waits for networkidle
   */
  async fillReportValue(
    row: Locator,
    dateLabel: string,
    value: string,
    testInfo: TestInfo,
    options?: { verify?: boolean },
  ): Promise<void> {
    const cell = await this.tasksPage.dayCell(row, dateLabel);
    const editor = await this.tasksPage.openInlineEditor(cell);
    await this.globalConfig.delay();

    await editor.click();
    await editor.fill("");
    await editor.pressSequentially(value, { delay: 50 });
    await this.exitInlineEditing(editor, cell);

    if (options?.verify !== false) {
      await this.verification.verifyLocatorText(
        cell,
        value,
        testInfo,
        `report-value-${dateLabel}-${value}`,
      );
    }

    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Clears a report value in a specific cell:
   * 1. Opens the inline editor
   * 2. Clears the content
   * 3. Exits editing
   * 4. Optionally verifies the cell is empty
   */
  async clearReportValue(
    row: Locator,
    dateLabel: string,
    testInfo: TestInfo,
    options?: { verify?: boolean },
  ): Promise<void> {
    const cell = await this.tasksPage.dayCell(row, dateLabel);
    const editor = await this.tasksPage.openInlineEditor(cell);
    await this.globalConfig.delay();

    await editor.fill("");
    await this.exitInlineEditing(editor, cell);

    if (options?.verify !== false) {
      await this.verification.verifyLocatorEmpty(
        cell,
        testInfo,
        `report-cleared-${dateLabel}`,
      );
    }

    await this.page.waitForLoadState("networkidle");
  }

  /** Verifies a specific cell text matches the expected value. */
  async verifyReportValue(
    rowMatcher: string | RegExp,
    dateLabel: string,
    value: string,
    testInfo: TestInfo,
    searchTerm?: string,
  ): Promise<void> {
    const row = await this.tasksPage.getTaskRow(rowMatcher, searchTerm);
    const cell = await this.tasksPage.dayCell(row, dateLabel);
    await this.verification.verifyLocatorText(
      cell,
      value,
      testInfo,
      `verify-report-${dateLabel}-${value}`,
    );
  }

  /** Verifies a specific cell is empty (or the row doesn't exist). */
  async verifyReportEmpty(
    rowMatcher: string | RegExp,
    dateLabel: string,
    testInfo: TestInfo,
    searchTerm?: string,
  ): Promise<void> {
    if (searchTerm) {
      await this.tasksPage.fillSearch(searchTerm);
    }
    const row = this.tasksPage.taskRow(rowMatcher);
    const count = await row.count();
    if (count === 0) {
      expect(count).toBe(0);
      return;
    }
    const cell = await this.tasksPage.dayCell(row.first(), dateLabel);
    await this.verification.verifyLocatorEmpty(
      cell,
      testInfo,
      `verify-empty-${dateLabel}`,
    );
  }

  /** Verifies the search field has an empty value. */
  async verifySearchEmpty(testInfo: TestInfo): Promise<void> {
    await this.verification.verifyLocatorValue(
      this.tasksPage.searchField(),
      "",
      testInfo,
      "search-field-empty",
    );
  }

  /** Clears the search field. */
  async clearSearch(): Promise<void> {
    await this.tasksPage.clearSearch();
  }

  /**
   * Exits inline editing mode:
   * 1. Presses Enter to submit
   * 2. Clicks outside the cell to deselect
   */
  private async exitInlineEditing(
    editor: Locator,
    cell: Locator,
  ): Promise<void> {
    await editor.press("Enter");

    // Click outside the cell to fully exit editing mode
    const box = await cell.boundingBox();
    if (box) {
      // Click to the right of the cell, outside its bounds
      await this.page.mouse.click(box.x + box.width + 20, box.y + box.height / 2);
    }
  }
}
