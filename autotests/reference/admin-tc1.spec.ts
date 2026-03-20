import { test } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { AdminTc1Data } from "../data/AdminTc1Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { AdminApiKeyFixture } from "../fixtures/AdminApiKeyFixture";

test("admin_tc1 - create, edit and delete API key @regress", async ({ page }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await AdminTc1Data.create(globalConfig.testDataMode, tttConfig);

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // 3. Fixtures
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const adminApiKey = new AdminApiKeyFixture(page, globalConfig, verification);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Sign in
  await login.run();

  // Step 2: Ensure English
  await mainFixture.ensureLanguage("EN");

  // Step 3: Navigate to Admin panel > API
  await navigation.navigate("Admin panel > API");

  // Step 4: Verify API page loaded
  await adminApiKey.ensureReady();
  await verification.verifyLocatorVisible(
    await adminApiKey.titleLocator(),
    testInfo,
    "api-page-loaded",
  );

  // Step 5-6: Create API key with All permissions
  await adminApiKey.createApiKey(data.apiKeyName, testInfo);

  // Step 7: Verify table columns for the new API key
  await adminApiKey.verifyApiKeyCreated(data, testInfo);

  // Step 8: Capture API key value as artifact
  await adminApiKey.captureApiKeyValue(data, testInfo);

  // Step 9-11: Edit API key — remove All permissions
  await adminApiKey.editApiKeyRemoveAll(data.apiKeyNamePattern, testInfo);

  // Step 12: Verify Allowed API methods is blank
  await adminApiKey.verifyApiKeyEdited(data, testInfo);

  // Step 13: Delete API key with confirmation
  await adminApiKey.deleteApiKey(data.apiKeyNamePattern, testInfo);

  // Step 14: Logout
  await logout.runViaDirectUrl();
  await page.close();
});
