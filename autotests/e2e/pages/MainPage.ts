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
  private readonly title = this.page
    .locator("[class*='page-body'] [class*='title'], h1, h2")
    .filter({
      hasText: /My vacations and days off|Мои отпуска и выходные/i,
    });
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
      page.locator(".notification__theme--visible"),
      page.locator("[class*='notification'][class*='visible']"),
      page.getByRole("status"),
      page.getByRole("alert"),
      page.locator("[class*='notification']"),
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

  /**
   * Finds a notification element containing the given text.
   * Uses a race strategy: all candidates are checked in parallel every 300ms.
   * Timeout is generous (15s) because the notification auto-hides after ~10s
   * and we must catch it while visible.
   */
  async findNotification(text: string, timeout = 15_000): Promise<Locator> {
    const textPattern = new RegExp(escapeRegExp(text), "i");
    const candidates = this.notificationCandidates.map((loc) =>
      loc.filter({ hasText: textPattern }),
    );
    return pollForMatch(candidates, { timeout, interval: 300 });
  }

  /** Returns the count of action buttons for a vacation row. */
  async getActionButtonCount(period: string | RegExp): Promise<number> {
    const row = this.vacationRow(period).first();
    const actionsCell = row.locator("td").last();
    return actionsCell.locator("button").count();
  }

  /** Opens the edit dialog by clicking the pencil icon on a vacation row. */
  async openEditDialog(period: string | RegExp): Promise<VacationCreateDialog> {
    const row = this.vacationRow(period).first();
    const actionsCell = row.locator("td").last();
    await actionsCell.locator("button").first().click();
    const dialog = new VacationCreateDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /** Clicks the "Closed" filter tab. */
  async clickClosedTab(): Promise<void> {
    await this.page.getByRole("button", { name: /^Closed$/i }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Clicks the "Open" filter tab. */
  async clickOpenTab(): Promise<void> {
    await this.page.getByRole("button", { name: /^Open$/i }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Reads the available vacation days count from the page header. */
  async getAvailableDays(): Promise<number> {
    const text = await this.page.evaluate(() => {
      // Strategy 1: "N in YYYY" pattern (multi-year balance)
      for (const span of document.querySelectorAll("span, div")) {
        const t = span.textContent?.trim() ?? "";
        if (/^\d+[\s\u00a0]+in[\s\u00a0]+\d{4}$/.test(t)) return t;
      }
      // Strategy 2: leaf element with just a number, near "Available vacation days" label.
      // Walk leaf nodes (no children) and check ancestors for the label text.
      for (const el of document.querySelectorAll("span, div")) {
        if (el.childElementCount !== 0) continue;
        const ct = el.textContent?.trim() ?? "";
        if (!/^\d{1,3}$/.test(ct)) continue;
        let parent = el.parentElement;
        for (let depth = 0; depth < 3 && parent; depth++) {
          const pt = parent.textContent ?? "";
          if (
            pt.length < 300 &&
            /available vacation days|доступно отпускных/i.test(pt)
          ) {
            return ct;
          }
          parent = parent.parentElement;
        }
      }
      return "";
    });
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Returns the available vacation days as a signed number (handles negative for AV=true). */
  async getAvailableDaysSigned(): Promise<number> {
    const text = await this.page.evaluate(() => {
      // Strategy 1: "-N in YYYY" or "N in YYYY" (handles &nbsp; and minus sign)
      for (const span of document.querySelectorAll("span, div")) {
        const t = span.textContent?.trim() ?? "";
        if (/^-?\d+[\s\u00a0]+in[\s\u00a0]+\d{4}$/.test(t)) return t;
      }
      // Strategy 2: leaf element with negative or positive number near the label
      for (const el of document.querySelectorAll("span, div")) {
        if (el.childElementCount !== 0) continue;
        const ct = el.textContent?.trim() ?? "";
        if (!/^-?\d{1,3}$/.test(ct)) continue;
        let parent = el.parentElement;
        for (let depth = 0; depth < 3 && parent; depth++) {
          const pt = parent.textContent ?? "";
          if (
            pt.length < 300 &&
            /available vacation days|доступно отпускных/i.test(pt)
          ) {
            return ct;
          }
          parent = parent.parentElement;
        }
      }
      return "";
    });
    const match = text.match(/(-?\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // --- Vacation Events Feed Dialog ---

  /** Opens the "Vacation events feed" dialog. */
  async openEventsFeed(): Promise<Locator> {
    await this.page
      .getByRole("button", { name: "Vacation events feed" })
      .click();
    const dialog = this.page.getByRole("dialog", {
      name: /Vacation events feed/i,
    });
    await dialog.waitFor({ state: "visible" });
    return dialog;
  }

  /** Returns event rows from the open events feed dialog. */
  async getEventsFeedRows(
    dialog: Locator,
  ): Promise<{ date: string; event: string }[]> {
    const rows = dialog.locator("table tbody tr");
    const count = await rows.count();
    const result: { date: string; event: string }[] = [];
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator("td");
      const date = ((await cells.nth(0).textContent()) ?? "").trim();
      const event = ((await cells.nth(1).textContent()) ?? "").trim();
      if (date && event) result.push({ date, event });
    }
    return result;
  }

  /** Closes the events feed dialog via Escape. */
  async closeEventsFeedDialog(dialog: Locator): Promise<void> {
    await this.page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
  }

  /** Clicks the "All" filter tab. */
  async clickAllTab(): Promise<void> {
    await this.page.getByRole("button", { name: /^All$/i }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Returns the count of visible vacation rows. */
  async getRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  /** Navigates to the last page of the vacation table pagination. No-op if only 1 page. */
  async goToLastPage(): Promise<void> {
    const pagination = this.page.getByRole("navigation", { name: "Pagination" });
    if (!(await pagination.isVisible().catch(() => false))) return;
    const pageButtons = pagination.getByRole("button").filter({
      hasNotText: /Previous|Next/i,
    });
    const count = await pageButtons.count();
    if (count > 1) {
      await pageButtons.last().click();
      await this.page.waitForLoadState("networkidle");
    }
  }

  /** Clicks a column header button to toggle sort. */
  async clickColumnSort(columnLabel: string): Promise<void> {
    const header = this.page.locator("table thead th").filter({ hasText: columnLabel });
    const sortButton = header.getByRole("button", { name: columnLabel });
    await sortButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Returns text values for a specific column across all visible data rows. */
  async getColumnTexts(columnLabel: string): Promise<string[]> {
    const headerCells = this.page.locator("table thead th");
    const colIndex = await headerCells.evaluateAll(
      (headers: Element[], label: string) => {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].textContent?.trim().toLowerCase().includes(label.toLowerCase())) return i;
        }
        return -1;
      },
      columnLabel,
    );
    if (colIndex === -1) throw new Error(`Column "${columnLabel}" not found`);
    // Use evaluateAll to read all rows at once — avoids timeout on hidden/filtered rows
    // Filter out "No data" rows (single merged cell) by checking cell count > colIndex
    return this.page.locator("table tbody").first().locator("tr").evaluateAll(
      (rows: Element[], idx: number) =>
        rows
          .filter((r) => (r as HTMLElement).offsetParent !== null)
          .filter((r) => r.querySelectorAll("td").length > idx)
          .map((r) => r.querySelectorAll("td")[idx]?.textContent?.trim() ?? ""),
      colIndex,
    );
  }

  /** Opens the filter dropdown for a filterable column (Vacation type, Status). */
  async openColumnFilter(columnLabel: string): Promise<void> {
    const header = this.page.locator("table thead th").filter({
      hasText: new RegExp(columnLabel, "i"),
    });
    // The filter icon is the last button (after the sort text button)
    const buttons = header.locator("button");
    const count = await buttons.count();
    await buttons.nth(count - 1).click();
  }

  /** Toggles a filter checkbox in an open filter dropdown. */
  async toggleFilterCheckbox(optionLabel: string): Promise<void> {
    await this.page.getByRole("checkbox", { name: optionLabel }).click();
  }

  /** Closes the currently open column filter dropdown by pressing Escape. */
  async closeColumnFilter(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  /** Returns the text of a footer column cell (from tfoot Total row). */
  async getFooterColumnValue(columnLabel: string): Promise<string> {
    const headerCells = this.page.locator("table thead th");
    const colIndex = await headerCells.evaluateAll(
      (headers: Element[], label: string) => {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].textContent?.trim().toLowerCase().includes(label.toLowerCase())) return i;
        }
        return -1;
      },
      columnLabel,
    );
    if (colIndex === -1) throw new Error(`Column "${columnLabel}" not found in table footer`);
    const footerCell = this.page.locator("table tfoot tr td, table tfoot tr th").nth(colIndex);
    return ((await footerCell.textContent()) ?? "").trim();
  }

  /** Returns the full "Available vacation days" text (e.g., "22" or "4 in 2026"). */
  async getAvailableDaysFullText(): Promise<string> {
    await this.page.waitForLoadState("networkidle");
    // DOM: div.vacationDaysRowContainer > span "N\u00a0in\u00a0YYYY"
    // The value span is a sibling container of the "Available vacation days:" label,
    // inside a parent with class "m-b-20". Uses &nbsp; between tokens.
    return this.page.evaluate(() => {
      // Strategy 1: find spans with "N in YYYY" pattern (handles &nbsp;)
      for (const span of document.querySelectorAll("span")) {
        const t = span.textContent?.trim() ?? "";
        if (/^\d+[\s\u00a0]+in[\s\u00a0]+\d{4}$/.test(t)) return t;
      }
      // Strategy 2: find a standalone number near the label
      const container = document.querySelector(".m-b-20, [class*='userVacationInfo']");
      if (container) {
        for (const el of container.querySelectorAll("span, div")) {
          const t = el.textContent?.trim() ?? "";
          if (/^\d+$/.test(t) && el.childElementCount === 0 && !el.closest("table")) return t;
        }
      }
      return "";
    });
  }

  /** Clicks the expand/collapse button next to available days for yearly breakdown. */
  async toggleYearlyBreakdown(): Promise<void> {
    // The yearly breakdown button has class "VacationDaysTooltip_numberOfDaysInfo"
    // (unique to the available-days tooltip, not reused in table row tooltips).
    const btn = this.page.locator('button[class*="VacationDaysTooltip_numberOfDaysInfo"]');
    await btn.click();
  }

  /** Returns yearly breakdown entries from the open popup as {year, days} pairs. */
  async getYearlyBreakdownEntries(): Promise<{ year: string; days: string }[]> {
    // DOM: div[class*="UserVacationsPage_vacationDaysTooltip"] contains
    //   div[class*="tooltipItemContainer"] children, each with:
    //     div[class*="titleOfTooltip"] = year, div[class*="contentOfTooltip"] = days
    const tooltip = this.page.locator('[class*="UserVacationsPage_vacationDaysTooltip"]').first();
    await tooltip.waitFor({ state: "visible", timeout: 5000 });
    return tooltip.evaluate((el) => {
      const entries: { year: string; days: string }[] = [];
      const items = el.querySelectorAll('div[class*="tooltipItemContainer"]');
      for (const item of items) {
        const title = item.querySelector('div[class*="titleOfTooltip"]');
        const content = item.querySelector('div[class*="contentOfTooltip"]');
        if (title && content) {
          const y = title.textContent?.trim() ?? "";
          const d = content.textContent?.trim() ?? "";
          if (/^\d{4}$/.test(y) && /^\d+$/.test(d)) {
            entries.push({ year: y, days: d });
          }
        }
      }
      return entries;
    });
  }

  /**
   * Returns yearly breakdown entries with automatic raw-text fallback.
   * First tries structured DOM extraction; if empty, parses raw text
   * for "YYYY N" / "YYYY: N" patterns.
   */
  async getYearlyBreakdownWithFallback(): Promise<
    { year: string; days: string }[]
  > {
    let entries = await this.getYearlyBreakdownEntries();
    if (entries.length > 0) return entries;

    // Fallback: read tooltip raw text and parse year/days patterns
    const rawText = await this.page
      .locator('[class*="vacationDaysTooltip"], [class*="tooltip"]')
      .first()
      .textContent()
      .catch(() => "");
    const yearPattern = /(\d{4})\D+(\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = yearPattern.exec(rawText ?? "")) !== null) {
      entries.push({ year: match[1], days: match[2] });
    }
    return entries;
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

  /**
   * Adds a task via autocomplete:
   * 1. Fills search with the term
   * 2. Waits for autocomplete suggestions to appear
   * 3. Clicks the suggestion matching suggestionFilter (or first if omitted)
   * 4. Clicks "Add a task" button
   */
  async addTask(
    searchTerm: string,
    suggestionFilter?: string | RegExp,
  ): Promise<void> {
    await this.fillSearch(searchTerm);
    const allSuggestions = this.page.locator(
      "[class*='autosuggest'] li, ul[role='listbox'] li",
    );
    await allSuggestions.first().waitFor({ state: "visible", timeout: 5000 });
    if (suggestionFilter) {
      const match = allSuggestions.filter({ hasText: suggestionFilter });
      await match.first().click();
    } else {
      await allSuggestions.first().click();
    }
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

  // ── Week Navigation ──────────────────────────────────────────

  /** Returns the displayed week date range (e.g. "23.03.2026 – 29.03.2026"). */
  async getWeekRangeText(): Promise<string> {
    const range = this.page.locator("[class*='week-navigation'] span, [class*='weekNavigation'] span").first();
    try {
      await range.waitFor({ state: "visible", timeout: 3000 });
      return (await range.textContent())?.trim() ?? "";
    } catch {
      // Fallback: look for date range pattern in any visible element near nav
      const dateRange = this.page.getByText(/\d{2}\.\d{2}\.\d{4}\s*[–—-]\s*\d{2}\.\d{2}\.\d{4}/);
      return (await dateRange.first().textContent())?.trim() ?? "";
    }
  }

  /** Clicks the previous-week arrow button (left arrow). */
  async navigateToPreviousWeek(): Promise<void> {
    const candidates = [
      this.page.locator("button[class*='prev'], button[class*='Prev']"),
      this.page.locator("[class*='week-navigation'] button:first-child, [class*='weekNavigation'] button:first-child"),
      this.page.locator("button:has(img[alt*='prev']), button:has(img[alt*='left'])"),
      this.page.locator("button:has(img)").first(),
    ];
    const btn = await resolveFirstVisible(candidates, { timeout: 5000 });
    await btn.click();
  }

  /** Clicks the next-week arrow button (right arrow). */
  async navigateToNextWeek(): Promise<void> {
    const candidates = [
      this.page.locator("button[class*='next'], button[class*='Next']"),
      this.page.locator("[class*='week-navigation'] button:last-child, [class*='weekNavigation'] button:last-child"),
      this.page.locator("button:has(img[alt*='next']), button:has(img[alt*='right'])"),
    ];
    const btn = await resolveFirstVisible(candidates, { timeout: 5000 });
    await btn.click();
  }

  /** Clicks the "Current week" button. */
  async goToCurrentWeek(): Promise<void> {
    await this.page.getByRole("button", { name: /current week/i }).click();
  }

  /** Returns all visible week tab labels (date ranges). */
  async getVisibleWeekTabs(): Promise<string[]> {
    const tabs = this.page.locator("button").filter({
      hasText: /\d{2}\.\d{2}\s*[–—-]\s*\d{2}\.\d{2}/,
    });
    const count = await tabs.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await tabs.nth(i).textContent();
      if (text) labels.push(text.trim());
    }
    return labels;
  }

  /**
   * Checks if a day cell in a task row is editable.
   * Returns true if double-clicking opens an input, false otherwise.
   */
  async isCellEditable(row: Locator, dateLabel: string): Promise<boolean> {
    const cell = await this.dayCell(row, dateLabel);
    await cell.dblclick();
    const inlineInput = cell.locator("input, textarea");
    try {
      await inlineInput.first().waitFor({ state: "visible", timeout: 2000 });
      // Close the editor by pressing Escape
      await inlineInput.first().press("Escape");
      return true;
    } catch {
      // Check floating editor
      const floatingEditor = this.page.locator(
        ".timesheet-reporting__input input, .timesheet-reporting__input textarea",
      );
      try {
        await floatingEditor.first().waitFor({ state: "visible", timeout: 1000 });
        await floatingEditor.first().press("Escape");
        return true;
      } catch {
        return false;
      }
    }
  }

  // ── Task Pin/Rename ──────────────────────────────────────────

  /** Returns task names in their current display order (top to bottom). */
  async getTaskNamesInOrder(): Promise<string[]> {
    const rows = this.taskTable.locator("tbody tr");
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const firstCell = rows.nth(i).locator("td").first();
      const text = await firstCell.textContent();
      if (text?.trim()) names.push(text.trim());
    }
    return names;
  }

  /** Hovers over a task row and clicks the pin/unpin toggle icon. */
  async toggleTaskPin(row: Locator): Promise<void> {
    const taskCell = row.locator("td").first();
    await taskCell.hover();
    await this.page.waitForTimeout(500);
    const pinBtn = await resolveFirstVisible(
      [
        taskCell.locator("[class*='task-pin']"),
        taskCell.locator("button:has(svg)"),
        taskCell.locator("button:has(img)"),
      ],
      { timeout: 3000 },
    );
    await pinBtn.click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Clicks the task name text to trigger the rename modal. */
  async clickTaskName(row: Locator): Promise<void> {
    const taskCell = row.locator("td").first();
    const nameEl = await resolveFirstVisible(
      [
        taskCell.locator("span[class*='task-name']"),
        taskCell.locator("a"),
        taskCell.locator("span").first(),
      ],
      { timeout: 3000 },
    );
    await nameEl.click();
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
