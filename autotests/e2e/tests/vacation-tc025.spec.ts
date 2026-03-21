import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc025Data } from "../data/VacationTc025Data";

test("TC-VAC-025: Create vacation with very long comment (no length limit) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc025Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();
  expect(
    data.comment.length,
    "Comment should be 5000 characters",
  ).toBe(5000);

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = {
    [data.authHeaderName]: apiToken,
    "Content-Type": "application/json",
  };

  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with 5000-char comment
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      comment: data.comment,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const createResponse = await request.post(baseUrl, { headers, data: body });
    const createJson = await createResponse.json();

    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        {
          request: { ...body, comment: `[${body.comment.length} chars]` },
          response: createJson,
          status: createResponse.status(),
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-create", {
      path: createArtifact,
      contentType: "application/json",
    });

    expect(
      createResponse.ok(),
      `Create failed: ${createResponse.status()} ${JSON.stringify(createJson)}`,
    ).toBeTruthy();

    const vacationData = createJson.vacation ?? createJson;
    createdVacationId = vacationData.id;
    expect(createdVacationId, "Created vacation must have an id").toBeTruthy();
    expect(vacationData.status, "Initial status should be NEW").toBe("NEW");

    // Step 2: Verify comment length in response (check for truncation)
    const responseComment = vacationData.comment ?? "";
    const commentArtifact = testInfo.outputPath("step2-comment-check.json");
    await writeFile(
      commentArtifact,
      JSON.stringify(
        {
          sentLength: data.comment.length,
          receivedLength: responseComment.length,
          truncated: responseComment.length < data.comment.length,
          match: responseComment === data.comment,
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-comment-check", {
      path: commentArtifact,
      contentType: "application/json",
    });

    expect(
      responseComment.length,
      "Full 5000-char comment should be stored without truncation",
    ).toBe(data.comment.length);
    expect(
      responseComment,
      "Comment content should match exactly",
    ).toBe(data.comment);

    // Step 3: GET vacation and verify comment persisted in full
    const getUrl = `${baseUrl}/${createdVacationId}`;
    const getResponse = await request.get(getUrl, { headers });
    const getJson = await getResponse.json();

    const getArtifact = testInfo.outputPath("step3-get.json");
    await writeFile(
      getArtifact,
      JSON.stringify(
        {
          status: getResponse.status(),
          commentLength: (getJson.vacation ?? getJson).comment?.length ?? 0,
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-get", {
      path: getArtifact,
      contentType: "application/json",
    });

    expect(
      getResponse.ok(),
      `GET failed: ${getResponse.status()}`,
    ).toBeTruthy();

    const fetchedComment = (getJson.vacation ?? getJson).comment ?? "";
    expect(
      fetchedComment.length,
      "GET should return full 5000-char comment",
    ).toBe(data.comment.length);
  } finally {
    // Cleanup
    if (createdVacationId) {
      const deleteResponse = await request.delete(
        `${baseUrl}/${createdVacationId}`,
        { headers },
      );
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      await writeFile(
        cleanupArtifact,
        JSON.stringify(
          { id: createdVacationId, deleteStatus: deleteResponse.status() },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("cleanup-delete", {
        path: cleanupArtifact,
        contentType: "application/json",
      });
    }
  }
});
