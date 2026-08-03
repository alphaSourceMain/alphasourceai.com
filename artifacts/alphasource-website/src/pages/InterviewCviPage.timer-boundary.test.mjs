import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4176";
process.env.BASE_PATH ||= "/";
process.env.NODE_ENV = "test";

const server = await createServer({
  appType: "custom",
  configFile: join(websiteRoot, "vite.config.ts"),
  logLevel: "silent",
  optimizeDeps: { include: [], noDiscovery: true },
  root: websiteRoot,
  server: { hmr: false, middlewareMode: true },
});
const timer = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  advanceInterviewClosingPhase,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  markLocalClosingComplete,
  markProviderEndConfirmed,
  preserveInterviewTimerRuntime,
  remainingSecondsAtDeadline,
  resetInterviewTimerRuntimeForTests,
  timerToneForRemaining,
} = timer;

beforeEach(() => resetInterviewTimerRuntimeForTests());

test("countdown warning colors remain visual-only at two and one minutes", () => {
  assert.equal(timerToneForRemaining(121), "normal");
  assert.equal(timerToneForRemaining(120), "warning");
  assert.equal(timerToneForRemaining(61), "warning");
  assert.equal(timerToneForRemaining(60), "urgent");
  assert.equal(timerToneForRemaining(1), "urgent");
});

test("no application closing action occurs above the exact zero deadline", () => {
  for (const remainingSeconds of [180, 120, 60, 45, 30, 20, 1, 0.001]) {
    for (const [candidateSpeaking, replicaSpeaking] of [[false, false], [true, false], [false, true], [true, true]]) {
      const result = evaluateInterviewTimeBoundary({
        state: createInterviewTimeBoundaryState(),
        remainingSeconds,
        candidateSpeaking,
        replicaSpeaking,
      });
      assert.equal(result.state.phase, "INTERVIEWING");
      assert.deepEqual(result.actions, []);
    }
  }
});

test("zero reserves the complete local closing atomically regardless of speaker state", () => {
  for (const [candidateSpeaking, replicaSpeaking] of [[false, false], [true, false], [false, true], [true, true]]) {
    const result = evaluateInterviewTimeBoundary({
      state: createInterviewTimeBoundaryState(),
      remainingSeconds: 0,
      candidateSpeaking,
      replicaSpeaking,
    });
    assert.equal(result.state.phase, "LOCAL_CLOSING");
    assert.equal(result.state.localClosingReserved, true);
    assert.equal(result.state.remotePalAudioMuted, true);
    assert.equal(result.state.candidateAudioUnpublishRequested, true);
    assert.equal(result.state.localAudioPlayRequested, true);
    assert.equal(result.state.providerEndRequested, true);
    assert.deepEqual(result.actions, [
      "reserve_local_closing",
      "mute_remote_pal_audio",
      "request_candidate_audio_unpublish",
      "play_local_closing_audio",
      "request_provider_end",
    ]);
  }
});

test("terminal evaluation and completion cannot replay or regress", () => {
  const first = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState(),
    remainingSeconds: 0,
  });
  assert.deepEqual(evaluateInterviewTimeBoundary({
    state: first.state,
    remainingSeconds: 0,
  }).actions, []);
  const complete = markLocalClosingComplete(first.state);
  assert.equal(complete.phase, "COMPLETE");
  assert.equal(complete.navigationRequested, true);
  assert.strictEqual(markLocalClosingComplete(complete), complete);
  assert.strictEqual(advanceInterviewClosingPhase(complete, "INTERVIEWING"), complete);
});

test("provider confirmation is idempotent and requires the reserved end request", () => {
  const initial = createInterviewTimeBoundaryState();
  assert.strictEqual(markProviderEndConfirmed(initial), initial);
  const closing = evaluateInterviewTimeBoundary({ state: initial, remainingSeconds: 0 }).state;
  const confirmed = markProviderEndConfirmed(closing);
  assert.equal(confirmed.providerEndConfirmed, true);
  assert.strictEqual(markProviderEndConfirmed(confirmed), confirmed);
});

test("same-conversation remount preserves the absolute clock and terminal state", () => {
  const initial = initializeInterviewTimerRuntime(null, "conversation-a:3", 1_000, 180_000);
  const closing = evaluateInterviewTimeBoundary({
    state: initial.boundaryState,
    remainingSeconds: 0,
  }).state;
  const preserved = { ...initial, boundaryState: closing };
  preserveInterviewTimerRuntime(preserved);
  assert.strictEqual(
    initializeInterviewTimerRuntime(preserved, "conversation-a:3", 50_000, 180_000),
    preserved,
  );
  assert.strictEqual(
    initializeInterviewTimerRuntime(null, "conversation-a:3", 60_000, 180_000),
    preserved,
  );
  const next = initializeInterviewTimerRuntime(null, "conversation-b:3", 70_000, 180_000);
  assert.equal(next.boundaryState.phase, "INTERVIEWING");
});

test("the monotonic deadline reaches zero exactly and never becomes negative", () => {
  const deadline = 100_000;
  assert.equal(remainingSecondsAtDeadline(deadline, 99_000), 1);
  assert.equal(remainingSecondsAtDeadline(deadline, 100_000), 0);
  assert.equal(remainingSecondsAtDeadline(deadline, 101_000), 0);
});

test("source has one zero-deadline local path and no PAL farewell dispatch", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /processTimeBoundary\(0\)/);
  assert.match(source, /playLocalClosingAudioOnce/);
  assert.match(source, /local_closing_reserved/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="assertive"/);
  assert.doesNotMatch(source, /buildFinalClosingAnnouncementMessage/);
  assert.doesNotMatch(source, /sendFinalClosingAnnouncement/);
  assert.doesNotMatch(source, /FINAL_CLOSING_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /closing_farewell_started/);
  assert.doesNotMatch(source, /closing_candidate_audio_lock_requested/);
});
