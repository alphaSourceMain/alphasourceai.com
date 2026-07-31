import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4183";
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
const closing = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  buildCandidateQuestionInvitationMessage,
  buildFinalClosingAnnouncementMessage,
  closingProviderEndAllowed,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  markClosingFarewellCompletionTimeout,
  markClosingFarewellDispatched,
  markClosingFarewellInterrupted,
  markProviderEndRequested,
  preserveInterviewTimerRuntime,
  recordClosingFarewellSpeechEvent,
  recordPostClosingInterruption,
  remainingTimeBucketAtDeadline,
  reserveClosingFarewell,
  resetInterviewTimerRuntimeForTests,
} = closing;

beforeEach(() => resetInterviewTimerRuntimeForTests());

function closingOnlyState() {
  const locked = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState(),
    remainingSeconds: 45,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  return evaluateInterviewTimeBoundary({
    state: locked.state,
    remainingSeconds: 30,
    candidateSpeaking: true,
    replicaSpeaking: false,
  }).state;
}

test("three distinct post-closing provider events reserve only one interrupt path", () => {
  const first = recordPostClosingInterruption(closingOnlyState(), "provider-event-1");
  const second = recordPostClosingInterruption(first.state, "provider-event-2");
  const third = recordPostClosingInterruption(second.state, "provider-event-3");

  assert.deepEqual(
    [first.shouldInterrupt, second.shouldInterrupt, third.shouldInterrupt],
    [true, false, false],
  );
  assert.deepEqual(
    [first.newViolation, second.newViolation, third.newViolation],
    [true, true, true],
  );
  assert.equal(first.state.closingFarewellPhase, "RESERVED");
  assert.equal(second.state.closingFarewellPhase, "RESERVED");
  assert.equal(third.state.closingFarewellPhase, "RESERVED");
  assert.equal(
    [first, second, third]
      .flatMap((result) => result.actions)
      .filter((action) => action === "send_closing_farewell").length,
    1,
  );
});

function farewellEvent(state, kind, overrides = {}) {
  return {
    kind,
    conversationId: "active-conversation",
    turnKey: "opaque-turn",
    providerSequence: 1,
    interrupted: false,
    applicationControl: true,
    inferenceId: state.farewellInferenceId,
    ...overrides,
  };
}

test("violation and termination evaluation in the same interval cannot reserve twice", () => {
  const violation = recordPostClosingInterruption(closingOnlyState(), "provider-event-1");
  const termination = evaluateInterviewTimeBoundary({
    state: violation.state,
    remainingSeconds: 10,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  assert.equal(violation.actions.filter((action) => action === "send_closing_farewell").length, 1);
  assert.equal(termination.actions.includes("send_closing_farewell"), false);
  assert.equal(termination.state.closingFarewellPhase, "RESERVED");
});

test("violation during dispatched farewell records evidence without replay", () => {
  const reserved = reserveClosingFarewell(closingOnlyState()).state;
  const dispatched = markClosingFarewellDispatched(reserved);
  const violation = recordPostClosingInterruption(dispatched, "provider-event-during-farewell");
  assert.equal(violation.newViolation, true);
  assert.equal(violation.actions.includes("send_closing_farewell"), false);
  assert.equal(violation.state.closingFarewellPhase, "DISPATCHED");
});

test("rerender, effect re-entry, and remount preserve the one reservation and deadline", () => {
  const runtime = initializeInterviewTimerRuntime(
    null,
    "active-conversation:3",
    1_000,
    180_000,
  );
  const reserved = reserveClosingFarewell(runtime.boundaryState).state;
  const preserved = { ...runtime, boundaryState: reserved };
  preserveInterviewTimerRuntime(preserved);
  const rerender = initializeInterviewTimerRuntime(preserved, "active-conversation:3", 9_000, 180_000);
  const remount = initializeInterviewTimerRuntime(null, "active-conversation:3", 12_000, 180_000);
  assert.strictEqual(rerender, preserved);
  assert.strictEqual(remount, preserved);
  assert.equal(remount.deadlineAt, 181_000);
  assert.equal(reserveClosingFarewell(remount.boundaryState).reserved, false);
});

test("duplicate and mismatched PAL speaking events cannot duplicate or falsely complete farewell", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const started = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started"),
    "active-conversation",
  );
  const duplicateStart = recordClosingFarewellSpeechEvent(
    started.state,
    farewellEvent(started.state, "started"),
    "active-conversation",
  );
  const wrongInference = recordClosingFarewellSpeechEvent(
    started.state,
    farewellEvent(started.state, "stopped", { inferenceId: "wrong-inference" }),
    "active-conversation",
  );
  const wrongConversation = recordClosingFarewellSpeechEvent(
    started.state,
    farewellEvent(started.state, "stopped", { conversationId: "wrong-conversation" }),
    "active-conversation",
  );
  const completed = recordClosingFarewellSpeechEvent(
    started.state,
    farewellEvent(started.state, "stopped"),
    "active-conversation",
  );
  const duplicateStop = recordClosingFarewellSpeechEvent(
    completed.state,
    farewellEvent(completed.state, "stopped"),
    "active-conversation",
  );
  assert.equal(started.transition, "speaking");
  assert.equal(duplicateStart.transition, "none");
  assert.equal(wrongInference.matched, false);
  assert.equal(wrongConversation.matched, false);
  assert.equal(completed.transition, "completed");
  assert.equal(duplicateStop.transition, "none");
});

test("provider end waits while farewell speaks and proceeds after completion in final window", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const speaking = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started"),
    "active-conversation",
  ).state;
  assert.equal(closingProviderEndAllowed(speaking, 8), false);
  const completed = recordClosingFarewellSpeechEvent(
    speaking,
    farewellEvent(speaking, "stopped"),
    "active-conversation",
  ).state;
  assert.equal(closingProviderEndAllowed(completed, 11), false);
  assert.equal(closingProviderEndAllowed(completed, 10), true);
  assert.equal(closingProviderEndAllowed(speaking, 0, { hardDeadline: true }), true);
});

test("remaining-time diagnostics derive from the current absolute deadline", () => {
  const staleRenderedRemaining = 25;
  assert.equal(staleRenderedRemaining > 10, true);
  assert.equal(remainingTimeBucketAtDeadline(100_000, 91_000), "0_10");
  assert.equal(remainingTimeBucketAtDeadline(100_000, 75_000), "11_30");
});

test("provider and candidate interruption terminate farewell without replay", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const providerInterrupted = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "stopped", { interrupted: true }),
    "active-conversation",
  );
  const candidateInterrupted = markClosingFarewellInterrupted(dispatched);
  assert.equal(providerInterrupted.transition, "interrupted");
  assert.equal(providerInterrupted.state.closingFarewellPhase, "INTERRUPTED");
  assert.equal(candidateInterrupted.interrupted, true);
  assert.equal(reserveClosingFarewell(providerInterrupted.state).reserved, false);
  assert.equal(reserveClosingFarewell(candidateInterrupted.state).reserved, false);
});

test("missing speaking stop times out once, never replays, and waits for hard deadline", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const first = markClosingFarewellCompletionTimeout(dispatched);
  const duplicate = markClosingFarewellCompletionTimeout(first.state);
  assert.equal(first.timedOut, true);
  assert.equal(duplicate.timedOut, false);
  assert.equal(first.state.closingFarewellPhase, "TIMED_OUT");
  assert.equal(reserveClosingFarewell(first.state).reserved, false);
  assert.equal(closingProviderEndAllowed(first.state, 5), false);
  assert.equal(closingProviderEndAllowed(first.state, 0, { hardDeadline: true }), true);
});

test("multiple provider-end attempts collapse after the first request", () => {
  const completed = {
    ...closingOnlyState(),
    closingFarewellSent: true,
    closingFarewellPhase: "COMPLETED",
  };
  const first = markProviderEndRequested(completed);
  const duplicate = markProviderEndRequested(first.state);
  assert.equal(first.requested, true);
  assert.equal(duplicate.requested, false);
  assert.equal(closingProviderEndAllowed(first.state, 0, { hardDeadline: true }), false);
});

test("invitation and farewell messages carry stable distinct application inference identities", () => {
  const invitation = buildCandidateQuestionInvitationMessage(
    "synthetic-conversation",
    "alphascreen-closing-invitation-stable",
  );
  const farewell = buildFinalClosingAnnouncementMessage(
    "synthetic-conversation",
    "alphascreen-closing-farewell-stable",
  );

  assert.equal(
    invitation.properties.inference_id,
    "alphascreen-closing-invitation-stable",
  );
  assert.equal(
    farewell.properties.inference_id,
    "alphascreen-closing-farewell-stable",
  );
  assert.notEqual(invitation.properties.inference_id, farewell.properties.inference_id);
});

test("closing source has no fixed post-farewell shutdown timer", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(source, /CLOSING_UTTERANCE_END_DELAY_MS/);
  assert.doesNotMatch(
    source,
    /closing_farewell_started[\s\S]{0,1800}setTimeout[\s\S]{0,800}requestClosingProviderEnd/,
  );
});

test("post-closing violation handler cannot directly dispatch a farewell", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(
    source,
    /post_closing_question_violation[\s\S]{0,1000}\["send_closing_farewell",\s*"ensure_provider_shutdown"\]/,
  );
});
