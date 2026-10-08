import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./SyntheticInterviewTests.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../../pages/admin/AdminInterviewReliabilityPage.tsx", import.meta.url), "utf8");

test("QA admin testing control is additive to Interview Reliability, with no candidate-page hook", () => {
  assert.match(page, /<SyntheticInterviewTests backendBase=\{backendBase\} getToken=\{getToken\} \/>/);
  assert.match(source, /window\.location\.hostname === "alphasourceai-com\.onrender\.com"/);
  assert.match(source, /if \(!qaHost \|\| !payload\?\.enabled\) return null/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.match(source, /credentials: "omit"/);
  assert.doesNotMatch(source, /candidateSubmit|verifyOtp|reset-interview|role_id|client_id/);
});

test("explicit vendor-use confirmation, idempotency, stop and result evidence are present", () => {
  assert.match(source, /window\.confirm/);
  assert.match(source, /pendingKey\.current \|\|= crypto\.randomUUID\(\)/);
  assert.match(source, /!payload\.can_start/);
  assert.match(source, /\/runs\/\$\{id\}\/cancel/);
  assert.match(source, /latest\.checks\.map/);
  assert.match(source, /<audio controls/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /Results expire when the QA server restarts/);
  assert.match(source, /Not tested: submission, OTP, scoring, reports, real devices or reconnect/);
  assert.match(source, /aria-label="Synthetic interview scenario"/);
  assert.match(source, /aria-live="polite"/);
});
