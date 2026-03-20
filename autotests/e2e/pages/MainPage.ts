import type { Page, Locator } from "@playwright/test";
import { escapeRegExp } from "../utils/stringUtils";
import { resolveFirstVisible, pollForMatch } from "../utils/locatorResolver";
import { VacationCreateDialog } from "./VacationCreateDialog";
import { VacationDetailsDialog } from "./VacationDetailsDialog";

export type LanguageCode = "EN" | "RU";

export class MainPage {
  private readonly userMenuTrigger = this.page.locator(
    "div.navbar__button-arrow button.navbar__item",
  );
  private readonly logoutOption = this.page.locator(
    "ul.navbar__list-exit button.navbar__list-drop-link",
  );
  private readonly languageSwitcher = this.page.locator(".language-switcher");
  private readonly languageValue = this.languageSwitcher.locator(
    ".navbar__link",
  ).first();

  constructor(private readonly page: Page) {}

  /** Waits for the main page to be visible (user menu present). */
  async ensureVisible(): Promise<void> {
    await this.userMenuTrigger.waitFor({ state: "visible" });
  }

  /** Opens the user dropdown menu. */
  async openUserMenu(): Promise<void> {
    await this.userMenuTrigger.click();
  }

  /** Returns the logout button locator. */
  logoutButton(): Locator {
    return this.logoutOption;
  }

  /** Returns the currently displayed language code. */
  async getCurrentLanguage(): Promise<LanguageCode> {
    const text = await this.languageValue.textContent();
    return (text?.trim().toUpperCase() as LanguageCode) ?? "EN";
  }

  /** Switches the UI language via the language dropdown. */
  async setLanguage(language: LanguageCode): Promise<void> {
    await this.languageSwitcher.click();
    await this.page
      .locator(`.drop-down-menu__option:has-text("${language}")`)
      .click();
    await this.page.waitForLoadState("networkidle");
  }
}

// ---------------------------------------------------------------------------
// MyVacationsPage — full implementation, co-located with MainPage
// ---------------------------------------------------------------------------

export class MyVacationsPage {
  private readonly title = this.page.locator(
    ".page-body__title:has-text('My vacations and days off')",
  );
  private readonly tableRows = this.page.locator(
    "table.user-vacations tbody tr, table tbody tr",
  );
  private readonly createRequestButton = this.page.getByRole("button", {
    name: /create a request/i,
  });

  /** Candidate locators for notification messages (multi-strategy fallback). */
  private readonly notificationCandidates: Locator[];

  constructor(private readonly page: Page) {
    this.notificationCandidates = [
      page.getByRole("status"),
      page.getByRole("alert"),
      page.locator("[class*='notification']"),
      page.locator("[class*='message']"),
      page.locator(".alert-success"),
      page.locator(".toast-success"),
      page.locator("[data-qa='notification']"),
      page.locator("[class*='toast']"),
    ];
  }

  /** Waits for the vacations page to be ready. */
  async waitForReady(): Promise<void> {
    await this.title.waitFor({ state: "visible" });
  }

  /** Returns the title locator. */
  titleLocator(): Locator {
    return this.title;
  }

  /** Opens the vacation creation dialog and returns its page object. */
  async openCreateRequest(): Promise<VacationCreateDialog> {
    await this.createRequestButton.click();
    const dialog = new VacationCreateDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /** Returns the table row matching the given period text/pattern. */
  vacationRow(period: string | RegExp): Locator {
    if (typeof period === "string") {
      return this.tableRows.filter({
        hasText: new RegExp(escapeRegExp(period)),
      });
    }
    return this.tableRows.filter({ hasText: period });
  }

  /** Waits for a vacation row matching the period to appear. */
  async waitForVacationRow(period: string | RegExp): Promise<Locator> {
    const row = this.vacationRow(period);
    await row.first().waitFor({ state: "visible" });
    return row;
  }

  /** Waits for a vacation row matching the period to disappear. */
  async waitForVacationRowToDisappear(period: string | RegExp): Promise<void> {
    const row = this.vacationRow(period);
    await row.first().waitFor({ state: "detached" });
  }

  /** Opens the "Request details" dialog for a vacation matching the given period. */
  async openRequestDetails(
    period: string | RegExp,
  ): Promise<VacationDetailsDialog> {
    const row = this.vacationRow(period).first();
    const actionsCell = row.locator("td").last();
    // Second button opens the details/view dialog
    await actionsCell.locator("button").nth(1).click();
    const dialog = new VacationDetailsDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /**
   * Returns the text content of a specific column cell for a vacation row.
   * Resolves column index dynamically from the header text.
   */
  async columnValue(
    period: string | RegExp,
    columnLabel: string,
  ): Promise<string> {
    const cell = await this.columnCell(period, columnLabel);
    return (await cell.textContent()) ?? "";
  }

  /** Returns the locator for a specific column cell in a vacation row. */
  async columnCell(
    period: string | RegExp,
    columnLabel: string,
  ): Promise<Locator> {
    const row = this.vacationRow(period).first();
    const headerCells = this.page.locator("table thead th");
    const colIndex = await headerCells.evaluateAll(
      (headers: Element[], label: string) => {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
            return i;
          }
        }
        return -1;
      },
      columnLabel,
    );
    if (colIndex === -1) {
      throw new Error(`Column "${columnLabel}" not found in vacation table`);
    }
    return row.locator("td").nth(colIndex);
  }

  /** Finds a notification element containing the given text. */
  async findNotification(text: string): Promise<Locator> {
    const textPattern = new RegExp(escapeRegExp(text), "i");
    const candidates = this.notificationCandidates.map((loc) =>
      loc.filter({ hasText: textPattern }),
    );
    // Add a general text-based fallback
    candidates.push(
      this.page.locator(`text=${text}`),
    );
    return pollForMatch(candidates, { timeout: 7000 });
  }
}

// ---------------------------------------------------------------------------
// MyTasksPage — co-located with MainPage
// ---------------------------------------------------------------------------

export class MyTasksPage {
  private readonly title = this.page.locator(
    ".page-body__title:has-text('My tasks')",
  );
  private readonly searchInput = this.page.locator(
    "input[name='TASK_NAME'], input.react-autosuggest__input",
  );
  private readonly addTaskButton = this.page.getByRole("button", {
    name: /add a task/i,
  });
  private readonly taskTable = this.page.locator("table");

  constructor(private readonly page: Page) {}

  /** Waits for the tasks page to be ready. */
  async waitForReady(): Promise<void> {
    await this.searchInput.first().waitFor({ state: "visible" });
  }

  /** Fills the search input with the given text. */
  async fillSearch(text: string): Promise<void> {
    const input = this.searchInput.first();
    await input.fill(text);
  }

  /** Clicks the "Add a task" button. */
  async clickAddTask(): Promise<void> {
    await this.addTaskButton.click();
  }

  /** Clears the search field using the clear button (multi-strategy fallback). */
  async clearSearch(): Promise<void> {
    const candidates = [
      this.page.locator("button[aria-label='Clear']"),
      this.page.locator("button[title='Clear']"),
      this.page.locator("button[class*='clear']"),
      this.page.locator("button:has-text('Clear')"),
      this.page.locator("button:has(.icon-clear, .icon-close, [class*='clear'])"),
      this.page.locator("button").filter({ has: this.page.locator("svg, i") }).first(),
    ];
    const clearBtn = await resolveFirstVisible(candidates, { timeout: 5000 });
    await clearBtn.click();
  }

  /** Returns the search field locator. */
  searchField(): Locator {
    return this.searchInput.first();
  }

  /** Returns the row locator for a task matching the given label. */
  taskRow(label: string | RegExp): Locator {
    if (typeof label === "string") {
      return this.taskTable
        .locator("tr")
        .filter({ hasText: new RegExp(escapeRegExp(label)) });
    }
    return this.taskTable.locator("tr").filter({ hasText: label });
  }

  /** Waits for a task row matching the label to appear and returns it. */
  async waitForTask(label: string | RegExp): Promise<Locator> {
    const row = this.taskRow(label);
    await row.first().waitFor({ state: "visible" });
    return row;
  }

  /** Fills search and clicks "Add a task" to add a task. */
  async addTask(searchTerm: string): Promise<void> {
    await this.fillSearch(searchTerm);
    await this.clickAddTask();
  }

  /** Returns the task row, optionally searching first. */
  async getTaskRow(
    label: string | RegExp,
    searchTerm?: string,
  ): Promise<Locator> {
    if (searchTerm) {
      await this.fillSearch(searchTerm);
    }
    return this.taskRow(label).first();
  }

  /**
   * Returns the cell for a specific date column in a task row.
   * Matches column headers by date pattern (dd.mm, dd/mm, etc.).
   */
  async dayCell(row: Locator, dateLabel: string): Promise<Locator> {
    const dateMatcher = this.buildDateMatcher(dateLabel);

    const colIndex = await this.page
      .locator("table thead th")
      .evaluateAll(
        (headers: Element[], pattern: string) => {
          const re = new RegExp(pattern);
          for (let i = 0; i < headers.length; i++) {
            const text = headers[i].textContent?.trim() ?? "";
            if (re.test(text)) return i;
          }
          return -1;
        },
        dateMatcher.source,
      );

    if (colIndex === -1) {
      throw new Error(`Date column "${dateLabel}" not found in task table`);
    }
    return row.locator("td").nth(colIndex);
  }

  /**
   * Opens the inline editor on a cell by double-clicking.
   * Looks for an input/textarea inside the cell, then falls back to a floating editor.
   */
  async openInlineEditor(cell: Locator): Promise<Locator> {
    await cell.dblclick();

    // Try inline input/textarea first
    const inlineInput = cell.locator("input, textarea");
    try {
      await inlineInput.first().waitFor({ state: "visible", timeout: 2000 });
      return inlineInput.first();
    } catch {
      // Fall back to floating editor
    }

    const floatingEditor = this.page.locator(
      ".timesheet-reporting__input input, .timesheet-reporting__input textarea",
    );
    await floatingEditor.first().waitFor({ state: "visible", timeout: 3000 });
    return floatingEditor.first();
  }

  /**
   * Constructs a RegExp matching date column headers in various formats.
   * Input: "dd.mm" → matches dd.mm, dd/mm, etc.
   */
  private buildDateMatcher(dateLabel: string): RegExp {
    // Accept "dd.mm" format, build pattern matching common separators
    const parts = dateLabel.split(/[./]/);
    if (parts.length === 2) {
      const [day, month] = parts;
      return new RegExp(`${day}[./\\s]${month}`);
    }
    return new RegExp(escapeRegExp(dateLabel));
  }
}
