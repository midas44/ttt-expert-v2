import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc014Data } from "../../data/t2724/T2724Tc014Data";

/**
 * TC-T2724-014: Long tag near VARCHAR(255) limit.
 * Tests boundary: 255 chars should succeed via API; 256 chars may truncate or error.
 * Pure API test — verifies DB VARCHAR(255) constraint.
 */
test("TC-T2724-014: Long tag near VARCHAR(255) limit @regress @t2724", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc014Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );

  // Step 1: Create a 255-char tag — should succeed
  const resp255 = await request.post(tagsUrl, {
    headers,
    data: { tag: data.tag255 },
  });
  expect(resp255.ok()).toBe(true);
  const created255 = await resp255.json();
  expect(created255.tag).toBe(data.tag255);
  expect(created255.tag.length).toBe(255);

  // Step 2: Create a 256-char tag — expect error or truncation
  const resp256 = await request.post(tagsUrl, {
    headers,
    data: { tag: data.tag256 },
  });
  // Backend may return 400/500 for exceeding VARCHAR(255), or truncate.
  // We record which behavior occurs.
  let tag256Id: number | null = null;
  if (resp256.ok()) {
    // If accepted, verify whether truncated to 255
    const created256 = await resp256.json();
    tag256Id = created256.id;
    // Note: if DB silently truncates, length will be 255
    expect(created256.tag.length).toBeLessThanOrEqual(255);
  } else {
    // Error response is acceptable — constraint violation
    expect(resp256.status()).toBeGreaterThanOrEqual(400);
  }

  // CLEANUP: Delete created tags
  await request.delete(
    tttConfig.buildUrl(
      `/api/ttt/v1/projects/${data.projectId}/close-tags/${created255.id}`,
    ),
    { headers },
  );
  if (tag256Id) {
    await request.delete(
      tttConfig.buildUrl(
        `/api/ttt/v1/projects/${data.projectId}/close-tags/${tag256Id}`,
      ),
      { headers },
    );
  }
});
