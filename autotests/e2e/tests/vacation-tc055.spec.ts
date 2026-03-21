import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc055Data } from "../data/VacationTc055Data";
import { DbClient } from "../config/db/dbClient";

test("TC-VAC-055: Status transition — verify timeline event published @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc055Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = {
    [data.authHeaderName]: apiToken,
    "Content-Type": "application/json",
  };

  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (NEW status)
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const createResponse = await request.post(baseUrl, { headers, data: body });
    const createJson = await createResponse.json();

    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        { request: body, response: createJson, status: createResponse.status() },
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

    // Step 2: Verify VACATION_CREATED event in timeline
    const db = new DbClient(tttConfig);
    try {
      const createdEvents = await db.query<{
        event_type: string;
        vacation: number;
      }>(
        `SELECT event_type, vacation
         FROM ttt_vacation.timeline
         WHERE vacation = $1 AND event_type = 'VACATION_CREATED'
         ORDER BY event_time DESC LIMIT 1`,
        [createdVacationId],
      );

      const createdEventArtifact = testInfo.outputPath("step2-created-event.json");
      await writeFile(
        createdEventArtifact,
        JSON.stringify({ events: createdEvents }, null, 2),
        "utf-8",
      );
      await testInfo.attach("step2-created-event", {
        path: createdEventArtifact,
        contentType: "application/json",
      });

      expect(
        createdEvents.length,
        "VACATION_CREATED event should exist in timeline",
      ).toBeGreaterThanOrEqual(1);
      expect(createdEvents[0].event_type).toBe("VACATION_CREATED");

      // Step 3: Approve the vacation (NEW → APPROVED)
      const approveUrl = tttConfig.buildUrl(
        `/api/vacation/v1/vacations/approve/${createdVacationId}`,
      );
      const approveResponse = await request.put(approveUrl, { headers });
      const approveJson = await approveResponse.json();

      const approveArtifact = testInfo.outputPath("step3-approve.json");
      await writeFile(
        approveArtifact,
        JSON.stringify(
          { response: approveJson, status: approveResponse.status() },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("step3-approve", {
        path: approveArtifact,
        contentType: "application/json",
      });

      expect(
        approveResponse.ok(),
        `Approve failed: ${approveResponse.status()} ${JSON.stringify(approveJson)}`,
      ).toBeTruthy();

      const approvedVacation = approveJson.vacation ?? approveJson;
      expect(approvedVacation.status, "Status should be APPROVED").toBe("APPROVED");

      // Step 4: Verify VACATION_APPROVED event in timeline
      const approvedEvents = await db.query<{
        event_type: string;
        vacation: number;
        event_time: string;
      }>(
        `SELECT event_type, vacation, event_time::text
         FROM ttt_vacation.timeline
         WHERE vacation = $1 AND event_type = 'VACATION_APPROVED'
         ORDER BY event_time DESC LIMIT 1`,
        [createdVacationId],
      );

      const approvedEventArtifact = testInfo.outputPath("step4-approved-event.json");
      await writeFile(
        approvedEventArtifact,
        JSON.stringify({ events: approvedEvents }, null, 2),
        "utf-8",
      );
      await testInfo.attach("step4-approved-event", {
        path: approvedEventArtifact,
        contentType: "application/json",
      });

      expect(
        approvedEvents.length,
        "VACATION_APPROVED event should exist in timeline",
      ).toBeGreaterThanOrEqual(1);
      expect(approvedEvents[0].event_type).toBe("VACATION_APPROVED");

      // Step 5: Verify full event trail (created + approved)
      const allEvents = await db.query<{
        event_type: string;
        event_time: string;
      }>(
        `SELECT event_type, event_time::text
         FROM ttt_vacation.timeline
         WHERE vacation = $1
         ORDER BY event_time ASC`,
        [createdVacationId],
      );

      const allEventsArtifact = testInfo.outputPath("step5-all-events.json");
      await writeFile(
        allEventsArtifact,
        JSON.stringify({ events: allEvents }, null, 2),
        "utf-8",
      );
      await testInfo.attach("step5-all-events", {
        path: allEventsArtifact,
        contentType: "application/json",
      });

      expect(
        allEvents.length,
        "Should have at least 2 timeline events (CREATED + APPROVED)",
      ).toBeGreaterThanOrEqual(2);

      const eventTypes = allEvents.map((e) => e.event_type);
      expect(eventTypes, "Should include VACATION_CREATED").toContain("VACATION_CREATED");
      expect(eventTypes, "Should include VACATION_APPROVED").toContain("VACATION_APPROVED");
    } finally {
      await db.close();
    }
  } finally {
    // Cleanup: cancel first (APPROVED → CANCELED), then delete
    if (createdVacationId) {
      const cancelUrl = tttConfig.buildUrl(
        `/api/vacation/v1/vacations/cancel/${createdVacationId}`,
      );
      await request.put(cancelUrl, { headers });

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
