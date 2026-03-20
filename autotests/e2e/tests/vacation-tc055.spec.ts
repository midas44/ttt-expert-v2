import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc055Data } from "../data/VacationTc055Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc055 - Status transition: verify timeline events on create and approve @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc055Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac).toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;

    // Step 2: Verify VACATION_CREATED event in timeline
    const db = new DbClient(tttConfig);
    try {
      const createEvents = await db.query(
        `SELECT t.id, t.event_type, t.event_time, t.previous_status,
                t.days_used, t.start_date, t.end_date, t.comment, t.approver
         FROM ttt_vacation.timeline t
         WHERE t.vacation = $1 AND t.event_type = 'VACATION_CREATED'
         ORDER BY t.event_time DESC`,
        [createdVacationId],
      );

      const createEventArtifact = testInfo.outputPath("step2-create-event.json");
      await writeFile(createEventArtifact, JSON.stringify(createEvents, null, 2), "utf-8");
      await testInfo.attach("step2-create-event", { path: createEventArtifact, contentType: "application/json" });

      expect(createEvents.length, "VACATION_CREATED event should exist").toBeGreaterThanOrEqual(1);
      const createEvent = createEvents[0];
      expect(createEvent.event_type).toBe("VACATION_CREATED");
      // Created events have null previous_status (no prior state)
      expect(createEvent.previous_status).toBeNull();
    } finally {
      await db.close();
    }

    // Step 3: Approve the vacation
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step3-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step3-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status()).toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status).toBe("APPROVED");

    // Step 4: Verify VACATION_APPROVED event in timeline
    const db2 = new DbClient(tttConfig);
    try {
      const approveEvents = await db2.query(
        `SELECT t.id, t.event_type, t.event_time, t.previous_status,
                t.days_used, t.start_date, t.end_date, t.approver
         FROM ttt_vacation.timeline t
         WHERE t.vacation = $1 AND t.event_type = 'VACATION_APPROVED'
         ORDER BY t.event_time DESC`,
        [createdVacationId],
      );

      const approveEventArtifact = testInfo.outputPath("step4-approve-event.json");
      await writeFile(approveEventArtifact, JSON.stringify(approveEvents, null, 2), "utf-8");
      await testInfo.attach("step4-approve-event", { path: approveEventArtifact, contentType: "application/json" });

      expect(approveEvents.length, "VACATION_APPROVED event should exist").toBeGreaterThanOrEqual(1);
      const approveEvent = approveEvents[0];
      expect(approveEvent.event_type).toBe("VACATION_APPROVED");

      // Step 5: Verify all timeline events for this vacation
      const allEvents = await db2.query(
        `SELECT t.event_type, t.event_time, t.previous_status
         FROM ttt_vacation.timeline t
         WHERE t.vacation = $1
         ORDER BY t.event_time ASC`,
        [createdVacationId],
      );

      const allEventsArtifact = testInfo.outputPath("step5-all-timeline-events.json");
      await writeFile(allEventsArtifact, JSON.stringify({
        vacationId: createdVacationId,
        totalEvents: allEvents.length,
        events: allEvents,
        expectedSequence: ["VACATION_CREATED", "VACATION_APPROVED"],
      }, null, 2), "utf-8");
      await testInfo.attach("step5-all-timeline-events", { path: allEventsArtifact, contentType: "application/json" });

      // Verify event sequence: CREATED should come before APPROVED
      const eventTypes = allEvents.map((e: Record<string, unknown>) => e.event_type);
      expect(eventTypes, "Timeline should contain both CREATED and APPROVED events").toEqual(
        expect.arrayContaining(["VACATION_CREATED", "VACATION_APPROVED"]),
      );

      const createIdx = eventTypes.indexOf("VACATION_CREATED");
      const approveIdx = eventTypes.indexOf("VACATION_APPROVED");
      expect(createIdx, "VACATION_CREATED should come before VACATION_APPROVED").toBeLessThan(approveIdx);
    } finally {
      await db2.close();
    }
  } finally {
    // Cleanup: cancel then delete
    if (createdVacationId) {
      await request.put(`${baseUrl}/cancel/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: delArtifact, contentType: "application/json" });
    }
  }
});
