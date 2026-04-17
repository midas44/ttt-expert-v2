import { expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { GlobalConfig } from "@common/config/globalConfig";
import type { VerificationFixture } from "@common/fixtures/VerificationFixture";
import type { AdminTc1Data } from "@data/AdminTc1Data";
import { AdminApiPage } from "@ttt/pages/AdminApiPage";

export class AdminApiKeyFixture {
  private readonly apiPage: AdminApiPage;

  constructor(
    private readonly page: Page,
    private readonly globalConfig: GlobalConfig,
    private readonly verification: VerificationFixture,
  ) {
    this.apiPage = new AdminApiPage(page);
  }

  /** Waits for the Admin API page to be ready. */
  async ensureReady(): Promise<void> {
    await this.apiPage.waitForReady();
  }

  /** Returns the page title locator for verification screenshots. */
  async titleLocator(): Promise<import("@playwright/test").Locator> {
    return this.apiPage.titleLocator();
  }

  /** Creates an API key: opens dialog, fills name, checks All, submits, waits for row. */
  async createApiKey(name: string, testInfo: TestInfo): Promise<void> {
    const dialog = await this.apiPage.clickCreateKey();
    await dialog.fillName(name);
    await dialog.checkAll();
    await dialog.submit();
    await this.apiPage.waitForApiKeyRow(name);
    await this.globalConfig.delay();
  }

  /** Verifies the Name, Created, and Allowed API methods columns for the created key. */
  async verifyApiKeyCreated(
    data: AdminTc1Data,
    testInfo: TestInfo,
  ): Promise<void> {
    // Verify Name column
    const nameCell = await this.apiPage.columnCell(
      data.apiKeyNamePattern,
      "Name",
    );
    await this.verification.verifyLocatorText(
      nameCell,
      data.apiKeyName,
      testInfo,
      "column-name",
    );

    // Verify Created column
    const createdCell = await this.apiPage.columnCell(
      data.apiKeyNamePattern,
      "Created",
    );
    await this.verification.verifyLocatorText(
      createdCell,
      data.createdBy,
      testInfo,
      "column-created",
    );

    // Verify Allowed API methods column — check each method individually
    const methodsCell = await this.apiPage.columnCell(
      data.apiKeyNamePattern,
      "Allowed API methods",
    );
    const methodsText = await methodsCell.textContent() ?? "";
    for (const method of data.allowedMethodsAfterCreate) {
      expect(
        methodsText,
        `Expected method "${method}" in Allowed API methods`,
      ).toContain(method);
    }
    await this.verification.verifyLocatorVisible(
      methodsCell,
      testInfo,
      "column-allowed-methods",
    );
  }

  /** Reads the Value cell, attaches it as a test artifact, takes screenshot. Returns the value. */
  async captureApiKeyValue(
    data: AdminTc1Data,
    testInfo: TestInfo,
  ): Promise<string> {
    const valueCell = await this.apiPage.columnCell(
      data.apiKeyNamePattern,
      "Value",
    );
    const apiKeyValue = (await valueCell.textContent())?.trim() ?? "";
    expect(apiKeyValue, "API key value should not be empty").toBeTruthy();

    // Write API key value to disk and attach as artifact
    const filePath = testInfo.outputPath("api-key_admin-tc1.txt");
    await writeFile(filePath, apiKeyValue, "utf-8");
    await testInfo.attach("api-key_admin-tc1", {
      path: filePath,
      contentType: "text/plain",
    });

    await this.verification.verifyLocatorVisible(
      valueCell,
      testInfo,
      "api-key-value-captured",
    );

    return apiKeyValue;
  }

  /** Opens the edit dialog for the API key, unchecks All, submits. */
  async editApiKeyRemoveAll(
    namePattern: RegExp,
    testInfo: TestInfo,
  ): Promise<void> {
    const dialog = await this.apiPage.clickEditKey(namePattern);
    await dialog.uncheckAll();
    await dialog.submit();
    await this.globalConfig.delay();
  }

  /** Verifies that Allowed API methods column is blank after editing. */
  async verifyApiKeyEdited(
    data: AdminTc1Data,
    testInfo: TestInfo,
  ): Promise<void> {
    const methodsCell = await this.apiPage.columnCell(
      data.apiKeyNamePattern,
      "Allowed API methods",
    );
    await this.verification.verifyLocatorEmpty(
      methodsCell,
      testInfo,
      "column-allowed-methods-blank",
    );
  }

  /** Deletes the API key and verifies the row disappears. */
  async deleteApiKey(
    namePattern: RegExp,
    testInfo: TestInfo,
  ): Promise<void> {
    await this.apiPage.clickDeleteKey(namePattern);
    await this.globalConfig.delay();
    await this.verification.verifyLocatorVisible(
      await this.apiPage.titleLocator(),
      testInfo,
      "api-key-deleted",
    );
  }
}
