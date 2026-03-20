import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc100Data } from "../data/VacationTc100Data";

test("vacation_tc100 - Balance unchanged after payment (days deducted at approval) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc100Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Get initial available days balance
    const balanceUrl = tttConfig.buildUrl(data.buildAvailableDaysUrl());
    const initialBalanceResp = await request.get(balanceUrl, { headers: authHeaders });

    const initialBalance = await initialBalanceResp.json();
    const initArtifact = testInfo.outputPath("step1-initial-balance.json");
    await writeFile(initArtifact, JSON.stringify(initialBalance, null, 2), "utf-8");
    await testInfo.attach("step1-initial-balance", { path: initArtifact, contentType: "application/json" });

    expect(initialBalanceResp.status(), "Initial balance fetch should return 200").toBe(200);
    const initialDays = Number(initialBalance.availablePaidDays);
    expect(initialDays, "Initial available days should be > 0").toBeGreaterThan(0);

    // Step 2: Create REGULAR vacation
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step2-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step2-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const vac = createBody.vacation;
    expect(vac).toBeTruthy();
    expect(vac.status).toBe("NEW");
    createdVacationId = vac.id;
    const regularDays = vac.regularDays;
    expect(regularDays, "Vacation should have regularDays > 0").toBeGreaterThan(0);

    // Step 3: Approve vacation
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step3-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step3-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status(), "Approve should return 200").toBe(200);
    const approvedVac = approveBody.vacation ?? approveBody;
    expect(approvedVac.status).toBe("APPROVED");

    // Step 4: Get balance BEFORE payment (after approval — days already deducted)
    const beforePayResp = await request.get(balanceUrl, { headers: authHeaders });
    const beforePayBalance = await beforePayResp.json();
    const beforePayArtifact = testInfo.outputPath("step4-balance-before-pay.json");
    await writeFile(beforePayArtifact, JSON.stringify(beforePayBalance, null, 2), "utf-8");
    await testInfo.attach("step4-balance-before-pay", { path: beforePayArtifact, contentType: "application/json" });

    expect(beforePayResp.status()).toBe(200);
    const beforePayDays = Number(beforePayBalance.availablePaidDays);

    // Step 5: Pay the vacation
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(regularDays),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step5-pay.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step5-pay", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status(), "Payment should return 200").toBe(200);
    const paidVac = payBody.vacation ?? payBody;
    expect(paidVac.status).toBe("PAID");

    // Step 6: Get balance AFTER payment
    const afterPayResp = await request.get(balanceUrl, { headers: authHeaders });
    const afterPayBalance = await afterPayResp.json();
    const afterPayArtifact = testInfo.outputPath("step6-balance-after-pay.json");
    await writeFile(afterPayArtifact, JSON.stringify({
      beforePayDays,
      afterPayDays: afterPayBalance.availablePaidDays,
      unchanged: Number(afterPayBalance.availablePaidDays) === beforePayDays,
    }, null, 2), "utf-8");
    await testInfo.attach("step6-balance-after-pay", { path: afterPayArtifact, contentType: "application/json" });

    expect(afterPayResp.status()).toBe(200);
    const afterPayDays = Number(afterPayBalance.availablePaidDays);

    // CORE ASSERTION: Balance should be IDENTICAL before and after payment
    // Days were deducted at APPROVAL time, not payment time
    expect(
      afterPayDays,
      `Balance should be unchanged after payment: before=${beforePayDays}, after=${afterPayDays}`,
    ).toBe(beforePayDays);
  } finally {
    // PAID vacations cannot be deleted — best-effort cleanup
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
