import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc012Data } from "../../data/t2724/T2724Tc012Data";

/**
 * TC-T2724-012: Cross-project tag access — rejected.
 * Creates a tag on project A (as PM of A via API token), then tries
 * to delete/edit it from project B's endpoint. Both should return 400.
 * Pure API test — no browser UI needed.
 */
test("TC-T2724-012: Cross-project tag access rejected @regress @t2724", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc012Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };

  // SETUP: Create a tag on project A via API
  const tagAUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectAId}/close-tags`,
  );
  const createResp = await request.post(tagAUrl, {
    headers,
    data: { tag: data.tagValue },
  });
  expect(createResp.ok()).toBe(true);
  const createdTag = await createResp.json();
  const tagId = createdTag.id;

  // Step 1: Try DELETE from project B's endpoint — should fail
  const deleteUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectBId}/close-tags/${tagId}`,
  );
  const deleteResp = await request.delete(deleteUrl, { headers });
  expect(deleteResp.status()).toBe(400);

  // Step 2: Try PATCH from project B's endpoint — should fail
  const patchUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectBId}/close-tags/${tagId}`,
  );
  const patchResp = await request.patch(patchUrl, {
    headers,
    data: { tag: "hacked" },
  });
  expect(patchResp.status()).toBe(400);

  // Step 3: Verify the original tag is still intact on project A
  const listResp = await request.get(tagAUrl, { headers });
  expect(listResp.ok()).toBe(true);
  const tags = await listResp.json();
  const original = tags.find((t: { id: number }) => t.id === tagId);
  expect(original).toBeTruthy();
  expect(original.tag).toBe(data.tagValue);

  // CLEANUP: Delete the tag via project A's endpoint
  const cleanupUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectAId}/close-tags/${tagId}`,
  );
  await request.delete(cleanupUrl, { headers });
});
