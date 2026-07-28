import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page = await readFile(path.join(here, "AdminInterviewReliabilityPage.tsx"), "utf8");
const app = await readFile(path.join(here, "../../App.tsx"), "utf8");
const layout = await readFile(path.join(here, "../../components/AdminLayout.tsx"), "utf8");

test("admin route and existing navigation include Interview Reliability", () => {
  assert.match(app, /AdminInterviewReliabilityPage/);
  assert.match(app, /path="\/admin\/interview-reliability"/);
  assert.match(layout, /label: "Interview Reliability"/);
  assert.match(layout, /href: "\/admin\/interview-reliability"/);
  assert.match(layout, /Audit Logs/);
});

test("summary strip, required filters, and all supported sorts are present", () => {
  for (const summary of [
    "total_interviews",
    "completed_normally",
    "incomplete",
    "reconnect_attempted",
    "reconnect_failed",
    "watchdog_terminated",
    "processing_incomplete_or_overdue",
  ]) {
    assert.match(page, new RegExp(summary));
  }
  for (const filter of [
    "time_range",
    "client_id",
    "role_id",
    "status",
    "attempt",
    "failure_category",
    "reconnect_outcome",
    "processing_state",
    "search",
  ]) {
    assert.match(page, new RegExp(filter));
  }
  for (const sort of ["started_at", "ended_at", "duration", "status", "failure", "processing_age"]) {
    assert.match(page, new RegExp(`value="${sort}"|changeSort\\("${sort}"\\)`));
  }
});

test("page preserves query state and implements apply, reset, pagination, loading, empty, and error states", () => {
  assert.match(page, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /Apply filters/);
  assert.match(page, /Reset/);
  assert.match(page, /Previous/);
  assert.match(page, /Next/);
  assert.match(page, /Loading interviews/);
  assert.match(page, /No interviews match the selected filters/);
  assert.match(page, /role="alert"/);
});

test("detail panel exposes bounded reliability, processing, attempt, and ordered timeline views", () => {
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /Reliability summary/);
  assert.match(page, /Processing status/);
  assert.match(page, /Attempt and recovery/);
  assert.match(page, /Diagnostic timeline/);
  assert.match(page, /detail\.timeline/);
  assert.match(page, /detail\.timeline\.map/);
  assert.doesNotMatch(page, /groupedTimeline/);
  assert.match(page, /evidence_completeness/);
  assert.match(page, /Technical details/);
  assert.match(page, /event\.key === "Escape"/);
});

test("restricted diagnostic content and browser console logging are absent", () => {
  for (const restricted of [
    "transcript_scores",
    "interview_summary",
    "unanswered_candidate_questions",
    "provider_conversation_id",
    "participant_id",
    "claim_token",
    "transcript_hash",
    "storage_reference",
    "room_url",
    "resume_content",
    "candidate_email",
    "candidate_phone",
  ]) {
    assert.equal(page.includes(restricted), false, restricted);
  }
  assert.equal(/\bconsole\.(log|warn|error|debug)\b/.test(page), false);
});

test("accessibility basics include labelled filters, keyboard close, focus rings, and explicit detail controls", () => {
  assert.match(page, /aria-label="Interview reliability filters"/);
  assert.match(page, /aria-label="Reliability summary"/);
  assert.match(page, /aria-label="Close reliability detail"/);
  assert.match(page, /aria-label=\{`Open reliability detail for/);
  assert.match(page, /focus-visible:ring-2/);
  assert.match(page, /closeRef\.current\?\.focus/);
});
