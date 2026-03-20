import type { Page, Locator } from "@playwright/test";
import { escapeRegExp } from "../utils/stringUtils";
import { resolveFirstVisible } from "../utils/locatorResolver";
import { ApiKeyCreateDialog } from "./ApiKeyCreateDialog";
import { ApiKeyEditDialog } from "./ApiKeyEditDialog";

export class AdminApiPage {
  private readonly tableRows = this.page.locator("table tbody tr");

  constructor(private readonly page: Page) {}

  /** Waits for the API page to be ready (title and table visible). */
  async waitForReady(): Promise<void> {
    const title = await this.resolveTitle();
    await title.waitFor({ state: "visible" });
    await this.page.locator("table").first().waitFor({ state: "visible" });
  }

  /** Returns the title locator for verification screenshots. */
  async titleLocator(): Promise<Locator> {
    return this.resolveTitle();
  }

  /** Clicks "Create a key" and returns the create dialog page object. */
  async clickCreateKey(): Promise<ApiKeyCreateDialog> {
    const button = this.page.getByRole("button", { name: /Create a key/i });
    await button.click();
    const dialog = new ApiKeyCreateDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /** Returns the table row matching the given API key name. */
  apiKeyRow(name: string | RegExp): Locator {
    if (typeof name === "string") {
      return this.tableRows.filter({
        hasText: new RegExp(escapeRegExp(name)),
      });
    }
    return this.tableRows.filter({ hasText: name });
  }

  /** Waits for an API key row matching the name to appear. */
  async waitForApiKeyRow(name: string | RegExp): Promise<Locator> {
    const row = this.apiKeyRow(name);
    await row.first().waitFor({ state: "visible" });
    return row;
  }

  /** Waits for an API key row matching the name to disappear. */
  async waitForApiKeyRowToDisappear(name: string | RegExp): Promise<void> {
    const row = this.apiKeyRow(name);
    await row.first().waitFor({ state: "detached" });
  }

  /** Returns the locator for a specific column cell in an API key row. */
  async columnCell(
    name: string | RegExp,
    columnLabel: string,
  ): Promise<Locator> {
    const row = this.apiKeyRow(name).first();
    const headerCells = this.page.locator("table thead th");
    const colIndex = await headerCells.evaluateAll(
      (headers: Element[], label: string) => {
        for (let i = 0; i < headers.length; i++) {
          if (
            headers[i].textContent
              ?.trim()
              .toLowerCase()
              .includes(label.toLowerCase())
          ) {
            return i;
          }
        }
        return -1;
      },
      columnLabel,
    );
    if (colIndex === -1) {
      throw new Error(`Column "${columnLabel}" not found in API key table`);
    }
    return row.locator("td").nth(colIndex);
  }

  /** Clicks the edit (pencil) icon button for the given API key row. */
  async clickEditKey(name: string | RegExp): Promise<ApiKeyEditDialog> {
    const row = this.apiKeyRow(name).first();
    const actionsCell = row.locator("td").last();
    // First button in actions is the edit (pencil) icon
    await actionsCell.locator("button").first().click();
    const dialog = new ApiKeyEditDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /** Clicks the delete (trash) icon button, confirms, and waits for the row to disappear. */
  async clickDeleteKey(name: string | RegExp): Promise<void> {
    const row = this.apiKeyRow(name).first();
    const actionsCell = row.locator("td").last();
    // Second button in actions is the delete (trash) icon
    await actionsCell.locator("button").nth(1).click();

    // Handle "Deleting key" confirmation dialog
    const confirmDialog = this.page.getByRole("dialog", {
      name: /Deleting key/i,
    });
    await confirmDialog.waitFor({ state: "visible" });
    await confirmDialog.getByRole("button", { name: /^Delete$/i }).click();
    await confirmDialog.waitFor({ state: "detached" });

    await this.waitForApiKeyRowToDisappear(name);
  }

  /** Resolves the page title using multi-strategy candidates. */
  private async resolveTitle(): Promise<Locator> {
    const candidates = [
      this.page.locator(".page-body__title:has-text('API')"),
      this.page.locator("h1:has-text('API'), h2:has-text('API')"),
      this.page.locator("[class*='title']").filter({ hasText: "API" }),
    ];
    return resolveFirstVisible(candidates);
  }
}
