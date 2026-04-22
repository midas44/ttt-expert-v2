import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc004Data } from "@data/digest/DigestTc004Data";
import { triggerDigestTestEndpoint } from "@utils/clockControl";

/**
 * TC-DIGEST-004 (Variant B — test endpoint): empty happy path — bypass
 * completes cleanly; scheduler markers ABSENT; no per-recipient markers; no
 * ERROR entries.
 *
 * Same relaxation rule as TC-003: if the env already carries APPROVED
 * tomorrow vacations, "Roundcube count unchanged" is skipped but the core
 * bypass-path health assertions still hold.
 */
test("TC-DIGEST-004: Digest (test endpoint) — empty happy path completes cleanly @regress @digest @col-digest", async ({
  request,
}) => {
  // Test endpoint runs synchronously but iterates all employees — shared QA
  // env can take >180 s.
  test.setTimeout(300_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc004Data.create(tttConfig);

  const envTag = tttConfig.envTag;
  const digestSubject = `[${envTag}]ТТТ Дайджест отсутствий`;
  const baselineCount = roundcube.count({
    subject: digestSubject,
    since: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  await triggerDigestTestEndpoint(request, tttConfig);

  // Give the email dispatcher time to run the digest composition + 20s dequeue.
  await new Promise((r) => setTimeout(r, 30_000));

  await graylog.assertAbsent({
    query: '"Digests sending job started"',
    range: "5m",
    settleMs: 5_000,
  });
  await graylog.assertAbsent({
    query: '"Digests sending job finished"',
    range: "5m",
    settleMs: 2_000,
  });

  const errorHits = graylog.count({
    query: 'level:3 AND "Digests sending job"',
    range: "5m",
  });
  expect(errorHits, "no ERROR-level entries for the digest bypass run").toBe(0);

  if (data.precheckCount === 0) {
    const afterCount = roundcube.count({
      subject: digestSubject,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    expect(
      afterCount,
      "with zero APPROVED-tomorrow seed, bypass must not dispatch a digest email",
    ).toBe(baselineCount);
  }
});
