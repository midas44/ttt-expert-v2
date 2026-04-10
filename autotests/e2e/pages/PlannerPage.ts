import { expect, type Locator, type Page } from "@playwright/test";

export class PlannerPage {
  constructor(private readonly page: Page) {}

  /** Waits for the planner page to be ready by checking the Planner heading. */
  async waitForReady(): Promise<void> {
    await this.page
      .locator("h1, h2, [class*='title']")
      .filter({ hasText: "Planner" })
      .first()
      .waitFor({ state: "visible" });
  }

  /** Clicks the "Tasks" tab. */
  async clickTasksTab(): Promise<void> {
    await this.page.getByRole("button", { name: "Tasks", exact: true }).click();
  }

  /** Clicks the "Projects" tab. */
  async clickProjectsTab(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Projects", exact: true })
      .click();
  }

  /** Selects a project from the project dropdown by typing and selecting. */
  async selectProject(projectName: string): Promise<void> {
    const combobox = this.page
      .locator("[class*='planner__project-select']")
      .getByRole("combobox");
    await combobox.waitFor({ state: "visible", timeout: 15_000 });
    await combobox.click();
    await combobox.fill(projectName);
    const option = this.page.getByRole("option", {
      name: projectName,
      exact: true,
    });
    await option.waitFor({ state: "visible", timeout: 15_000 });
    await option.click();
  }

  /** Changes the role filter dropdown ("Show projects where I am a ..."). */
  async selectRoleFilter(role: string): Promise<void> {
    const label = this.page.getByText("Show projects where I am a");
    const control = label.locator("..").locator("[class*='selectbox__control']").first();
    await control.scrollIntoViewIfNeeded();
    await control.click({ force: true });
    await this.page.getByRole("option", { name: role, exact: true }).click();
  }

  /** Clicks the Project Settings icon (unnamed SVG in .planner__project-group-add). */
  async clickProjectSettingsIcon(): Promise<void> {
    await this.page
      .locator(".planner__project-group-add .uikit-button")
      .first()
      .click();
  }

  /** Returns the Actions dropdown button. */
  actionsButton(): Locator {
    return this.page.getByRole("button", { name: "Actions" });
  }

  /** Waits for the datasheet table to finish loading (loading spinner removed). */
  async waitForTableLoaded(): Promise<void> {
    await expect(
      this.page.locator("table[class*='datasheet__loading--active']"),
    ).toBeHidden({ timeout: 15_000 });
  }

  /** Returns the planner data table (datasheet, not datepicker). */
  dataTable(): Locator {
    return this.page.locator("table[class*='datasheet__table']");
  }

  /** Returns direct data rows from the planner table (excludes nested datepicker rows). */
  dataTableRows(): Locator {
    return this.page.locator(
      "table[class*='datasheet__table'] > tbody > tr",
    );
  }

  /** Waits for the Project Settings dialog to be visible. */
  async waitForSettingsDialog(): Promise<void> {
    await this.page.getByRole("dialog").waitFor({ state: "visible" });
  }

  /** Clicks the OK button in the Project Settings dialog. */
  async clickSettingsOk(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "OK" })
      .click();
  }

  /** Checks if the Project Settings icon is visible (PM-only control). */
  async isProjectSettingsIconVisible(): Promise<boolean> {
    const count = await this.page
      .locator(".planner__project-group-add .uikit-button")
      .count();
    if (count === 0) return false;
    return this.page
      .locator(".planner__project-group-add .uikit-button")
      .first()
      .isVisible();
  }

  /** Returns the search bar input locator. */
  searchBar(): Locator {
    return this.page.getByRole("combobox").first();
  }

  /** Returns the search bar wrapper with placeholder text. */
  searchBarWrapper(): Locator {
    return this.page.locator("[class*='planner__search']");
  }

  /** Clicks the next-day (right) button beside the date header. */
  async navigateDateForward(): Promise<void> {
    const dateHeader = this.page.locator(".planner__header-day");
    // Next-day button is the sibling button AFTER the date text
    const parent = dateHeader.locator("..");
    await parent.locator("button").last().click();
  }

  /** Clicks the prev-day (left) button beside the date header. */
  async navigateDateBackward(): Promise<void> {
    const dateHeader = this.page.locator(".planner__header-day");
    // Prev-day button is the sibling button BEFORE the date text
    const parent = dateHeader.locator("..");
    await parent.locator("button").first().click();
  }

  /** Returns the current date text displayed in the table header. */
  async getDateHeaderTexts(): Promise<string[]> {
    const headers = this.page.locator("table thead th");
    const count = await headers.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  /** Returns the date display text (e.g., "Fri\n28.03") from the planner header. */
  async getDateDisplayText(): Promise<string> {
    return (
      (await this.page.locator(".planner__header-day").textContent()) ?? ""
    );
  }

  /** Returns the locator for the "Total" row at the bottom of the table. */
  totalRow(): Locator {
    return this.page.locator("tr").filter({ hasText: /^Total/ });
  }

  /** Returns the project name shown in the project selector dropdown. */
  async getSelectedProjectName(): Promise<string> {
    const singleValue = this.page
      .locator("[class*='planner__project-select'] [class*='singleValue']");
    return (await singleValue.textContent()) ?? "";
  }

  /** Returns the project select dropdown wrapper. */
  projectSelectDropdown(): Locator {
    return this.page.locator("[class*='planner__project-select']");
  }

  /** Returns the combobox inside the project select dropdown. */
  projectSelectCombobox(): Locator {
    return this.page
      .locator("[class*='planner__project-select']")
      .getByRole("combobox");
  }

  // --- Open for editing ---

  /** Returns the "Open for editing" button (visible when readonly assignments exist). */
  openForEditingButton(): Locator {
    return this.page.getByRole("button", { name: "Open for editing" });
  }

  /**
   * Clicks "Open for editing" if the button is visible, then waits for it
   * to disappear (the API call generates assignments with DB IDs,
   * causing hasReadonlyAssignment to become false and SearchContainer to render).
   */
  async openForEditingIfNeeded(): Promise<void> {
    const btn = this.openForEditingButton();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click();
      await btn.waitFor({ state: "hidden", timeout: 15_000 });
    }
  }

  /**
   * Ensures the planner is in editing mode with retries.
   * Clicks "Open for editing" if present, verifies the search input appears
   * (indicating editing mode is active), dismisses error banners, and retries once.
   * Returns true if editing mode is active, false if it could not be activated.
   */
  async ensureEditMode(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const openBtn = this.openForEditingButton();
      if (await openBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Dismiss any existing error banner first
        await this.dismissErrorBanner();
        await openBtn.click();
        // Wait for button to hide AND search input to appear
        try {
          await this.searchInput().waitFor({ state: "visible", timeout: 15_000 });
          // Double-check: button should be hidden
          if (await openBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            continue; // Button re-appeared — retry
          }
          await this.page.waitForLoadState("networkidle");
          return true;
        } catch {
          // Search input didn't appear — API likely failed
          await this.dismissErrorBanner();
          continue;
        }
      } else {
        // No "Open for editing" button — check if search input is present
        if (await this.searchInput().isVisible({ timeout: 2_000 }).catch(() => false)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Dismisses the error banner if visible. */
  async dismissErrorBanner(): Promise<void> {
    const banner = this.page.locator("text=An error has occurred in the system");
    if (await banner.isVisible({ timeout: 1_000 }).catch(() => false)) {
      // Try clicking the dismiss button (X icon) if available
      const closeBtn = banner.locator("..").locator("button").first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }
  }

  /** Checks if a cell is editable by verifying comment buttons are not disabled. */
  async isCellEditable(taskRow: Locator): Promise<boolean> {
    const commentCell = this.getCommentCell(taskRow);
    const disabledBtns = commentCell.locator("button[disabled]");
    const disabledCount = await disabledBtns.count().catch(() => 0);
    // If comment buttons are disabled, the row is readonly
    return disabledCount === 0;
  }

  // --- Search bar methods ---

  /** Returns the main search/autosuggest input (top-level search bar, not per-row inputs). */
  searchInput(): Locator {
    return this.page.locator("input[name='TASK_NAME']");
  }

  /** Types text into the search input (autosuggest) with debounce wait. */
  async typeInSearch(text: string): Promise<void> {
    const input = this.searchInput();
    await input.click();
    await input.fill(text);
  }

  /** Returns the open suggestions container. */
  suggestionsDropdown(): Locator {
    return this.page.locator(
      "[class*='react-autosuggest__suggestions-container--open']",
    );
  }

  /** Returns individual suggestion items. */
  suggestionItems(): Locator {
    return this.page.locator("[class*='react-autosuggest__suggestion']");
  }

  /** Clears the search input by clicking the X button. */
  async clearSearch(): Promise<void> {
    await this.page
      .locator("[class*='react-autosuggest__clear']")
      .click();
  }

  // --- Add task methods ---

  /** Returns the "Add a task" button. */
  addTaskButton(): Locator {
    return this.page.getByRole("button", { name: "Add a task" });
  }

  // --- Task row & inline editing methods ---

  /** Returns a task data row containing the given task name text. */
  getTaskRow(taskName: string): Locator {
    return this.page
      .locator("table tbody tr")
      .filter({ hasText: taskName });
  }

  /**
   * Returns the effort (date) cell for a given task row.
   * Column order: №(0), Info(1), Tracker(2), Task/Ticket(3), Date(4), Remaining(5), Comment(6).
   */
  getEffortCell(taskRow: Locator): Locator {
    return taskRow.locator("td").nth(4);
  }

  /** Returns the "Remaining work" cell for a given task row (column index 5). */
  getRemainingWorkCell(taskRow: Locator): Locator {
    return taskRow.locator("td").nth(5);
  }

  /** Returns the "Comment" cell for a given task row (column index 6). */
  getCommentCell(taskRow: Locator): Locator {
    return taskRow.locator("td").nth(6);
  }

  /** Returns an input inside a table cell (appears during inline editing). */
  getCellInput(cell: Locator): Locator {
    return cell.locator("input").first();
  }

  /**
   * Clicks a cell twice to enter edit mode (focus → edit).
   * The planner uses a two-click pattern: first click sets focus,
   * second click enters edit mode after the focus/lock is confirmed.
   */
  async clickCellToEdit(cell: Locator): Promise<void> {
    await cell.click(); // First click — sets focus
    // Brief pause for focus/lock dispatch to complete
    await this.page.waitForTimeout(500);
    await cell.click(); // Second click — enters edit mode
  }

  /** Returns the Total row's effort value cell. */
  getTotalEffort(): Locator {
    return this.totalRow().locator("th, td").nth(1);
  }

  // --- Collapse/Expand methods ---

  /** Returns all expand/collapse buttons in the table. */
  expandButtons(): Locator {
    return this.page.locator("[class*='row-expand-icon']");
  }

  /** Clicks the expand/collapse button at the given index (0-based). */
  async clickExpandButton(index: number): Promise<void> {
    await this.expandButtons().nth(index).click();
  }

  /** Returns all project group header rows (rows containing an expand button). */
  projectGroupRows(): Locator {
    return this.page
      .locator("tr")
      .filter({ has: this.page.locator("[class*='row-expand-icon']") });
  }

  // --- WebSocket indicator methods ---

  /** Returns the socket manager wrapper (socket-manager--position). */
  socketManagerWrapper(): Locator {
    return this.page.locator("[class*='socket-manager--position']");
  }

  /**
   * Returns the inner socket-manager status container.
   * This is the SocketManagerWrapper div with status modifier classes
   * (--connected, --connecting, --disconnected), inside the position wrapper.
   */
  socketManagerContainer(): Locator {
    return this.page
      .locator("[class*='socket-manager--position'] > div")
      .first();
  }

  // --- Task/Ticket view toggle methods ---

  /**
   * Returns the table header cell containing the Task/Ticket toggle.
   * Contains "Task" and "Ticket" links separated by "/".
   */
  taskTicketHeaderCell(): Locator {
    return this.page
      .locator("th")
      .filter({ hasText: /Task/ })
      .filter({ hasText: /Ticket/ });
  }

  // --- Info / Tracker / Delete column methods ---

  /** Returns the Info column cell (column index 1) for a given task row. */
  getInfoCell(taskRow: Locator): Locator {
    return taskRow.locator("td").nth(1);
  }

  /** Returns the Tracker column cell (column index 2) for a given task row. */
  getTrackerCell(taskRow: Locator): Locator {
    return taskRow.locator("td").nth(2);
  }

  /**
   * Returns the delete (close) button for a task row.
   * The button is inside .planner__row-item--hover (hidden until row hover).
   * It's the first button in that container (second is history).
   */
  getDeleteButton(taskRow: Locator): Locator {
    return taskRow
      .locator("[class*='planner__row-item--hover'] button")
      .first();
  }

  /** Returns the DnD handle button ("::" text) for a task row. */
  getDndHandle(taskRow: Locator): Locator {
    return taskRow.getByRole("button", { name: "::" });
  }

  // --- Projects tab employee header methods ---

  /**
   * Returns the employee group header row containing the employee name.
   * On the Projects tab, employees are grouped in separate sections.
   */
  getEmployeeHeaderRow(employeeName: string): Locator {
    return this.page
      .locator("tr")
      .filter({ hasText: employeeName })
      .first();
  }

  /** Returns the per-employee "Open for editing" button within an employee header row. */
  getEmployeeOpenForEditingButton(headerRow: Locator): Locator {
    return headerRow.getByRole("button", { name: "Open for editing" });
  }

  /** Returns all cells with blocked color coding (red/orange background). */
  blockedCells(): Locator {
    return this.page.locator("[class*='planner__cel--color-blocked']");
  }

  /** Returns all cells with done color coding (green background). */
  doneCells(): Locator {
    return this.page.locator("[class*='planner__cel--color-done']");
  }

  /**
   * Clicks the "Ticket" link to switch to TICKET view.
   * In TASK view (default), "Ticket" is a clickable link (role=button).
   */
  async switchToTicketView(): Promise<void> {
    await this.taskTicketHeaderCell()
      .getByRole("button", { name: /Ticket/i })
      .click();
  }

  /**
   * Clicks the "Task" link to switch to TASK view.
   * In TICKET view, "Task" is a clickable link (role=button).
   */
  async switchToTaskView(): Promise<void> {
    await this.taskTicketHeaderCell()
      .getByRole("button", { name: /Task/i })
      .click();
  }

  // --- DnD-specific methods ---

  /**
   * Enters editing mode for all visible employees on the Projects tab.
   * Waits for "Open for editing" buttons, clicks them all,
   * then waits for DnD handles. Returns true if editing mode was activated.
   */
  async enterProjectsEditMode(): Promise<boolean> {
    const openBtns = this.page.getByRole("button", {
      name: "Open for editing",
    });

    // Wait for buttons to appear (table might still be loading)
    try {
      await openBtns.first().waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      // No button found — check if DnD handles already exist
      if ((await this.allDndHandles().count()) > 0) return true;
      return false;
    }

    // Click all enabled "Open for editing" buttons (max 10 iterations safety)
    let maxClicks = 10;
    while (maxClicks > 0) {
      // Find enabled (not disabled) "Open for editing" buttons
      const enabledBtns = openBtns.filter({
        hasNot: this.page.locator("[disabled]"),
      });
      const btnCount = await enabledBtns.count();
      if (btnCount === 0) break;
      try {
        await enabledBtns.first().click({ timeout: 5_000 });
      } catch {
        break; // Button became disabled or detached during click
      }
      await this.page.waitForLoadState("networkidle");
      await this.page.waitForTimeout(1_000);
      maxClicks--;
    }

    // Wait for DnD handles to appear
    try {
      await this.allDndHandles().first().waitFor({
        state: "visible",
        timeout: 15_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Returns all visible DnD handle buttons ('::' text) in the table. */
  allDndHandles(): Locator {
    return this.page.getByRole("button", { name: "::" });
  }

  /**
   * Returns data rows that contain planner__cel cells — the reliable selector
   * for actual task data rows, excluding datepicker/header/total rows.
   * Session 90 discovery: this is the ONLY way to find real planner data rows.
   */
  plannerDataRows(): Locator {
    return this.page
      .locator("tr")
      .filter({ has: this.page.locator("[class*='planner__cel']") });
  }

  /** Returns only data rows that have DnD handles (editable rows in current editing session). */
  dndEditableRows(): Locator {
    return this.page.locator("tr").filter({
      has: this.page.getByRole("button", { name: "::" }),
    });
  }

  /** Gets the task/ticket name text from a data row's 4th column (index 3). */
  async getTaskNameFromRow(taskRow: Locator): Promise<string> {
    const cell = taskRow.locator("td").nth(3);
    try {
      return (await cell.textContent({ timeout: 5_000 }))?.trim() ?? "";
    } catch {
      return "";
    }
  }

  /**
   * Returns task names from the first N DnD-editable rows.
   * Use this on the Projects tab to avoid iterating 400+ rows.
   */
  async getFirstDndRowTaskNames(limit: number = 10): Promise<string[]> {
    const rows = this.dndEditableRows();
    const total = await rows.count();
    const count = Math.min(total, limit);
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = await this.getTaskNameFromRow(rows.nth(i));
      if (name) names.push(name);
    }
    return names;
  }

  /**
   * Performs mouse-based DnD to move sourceRow to the position of targetRow.
   * Works with react-beautiful-dnd by slowly dragging the handle with proper delays.
   */
  async dragTaskWithMouse(
    sourceRow: Locator,
    targetRow: Locator,
  ): Promise<void> {
    const sourceHandle = this.getDndHandle(sourceRow);
    const targetHandle = this.getDndHandle(targetRow);

    await sourceHandle.scrollIntoViewIfNeeded();
    await targetHandle.scrollIntoViewIfNeeded();

    const sourceBbox = await sourceHandle.boundingBox();
    const targetBbox = await targetHandle.boundingBox();
    if (!sourceBbox || !targetBbox)
      throw new Error("Cannot get DnD handle bounding boxes");

    const sx = sourceBbox.x + sourceBbox.width / 2;
    const sy = sourceBbox.y + sourceBbox.height / 2;
    const tx = targetBbox.x + targetBbox.width / 2;
    const ty = targetBbox.y + targetBbox.height / 2;

    // Hover over source first, then mouse-down
    await this.page.mouse.move(sx, sy);
    await this.page.waitForTimeout(100);
    await this.page.mouse.down();
    // Wait for react-beautiful-dnd drag detection (~150ms debounce)
    await this.page.waitForTimeout(250);
    // Move past the drag distance threshold (5px)
    await this.page.mouse.move(sx, sy + 8, { steps: 5 });
    await this.page.waitForTimeout(300);
    // Slowly drag to target position
    await this.page.mouse.move(tx, ty, { steps: 30 });
    await this.page.waitForTimeout(500);
    // Drop
    await this.page.mouse.up();
    await this.page.waitForTimeout(800);
  }

  /**
   * Performs keyboard-based DnD to move a task UP by N positions.
   * Uses react-beautiful-dnd keyboard controls: Space (lift) → ArrowUp×N → Space (drop).
   * Best for small movements (1-3 positions).
   */
  async dragTaskUp(taskRow: Locator, positions: number = 1): Promise<void> {
    const handle = this.getDndHandle(taskRow);
    await handle.focus();
    await this.page.keyboard.press("Space");
    await this.page.waitForTimeout(400);
    for (let i = 0; i < positions; i++) {
      await this.page.keyboard.press("ArrowUp");
      await this.page.waitForTimeout(300);
    }
    await this.page.keyboard.press("Space");
    await this.page.waitForTimeout(600);
  }

  /**
   * Performs keyboard-based DnD to move a task DOWN by N positions.
   * Best for small movements (1-3 positions).
   */
  async dragTaskDown(taskRow: Locator, positions: number = 1): Promise<void> {
    const handle = this.getDndHandle(taskRow);
    await handle.focus();
    await this.page.keyboard.press("Space");
    await this.page.waitForTimeout(400);
    for (let i = 0; i < positions; i++) {
      await this.page.keyboard.press("ArrowDown");
      await this.page.waitForTimeout(300);
    }
    await this.page.keyboard.press("Space");
    await this.page.waitForTimeout(600);
  }
}
