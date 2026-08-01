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
  markCandidateQuestionInvitationDispatchFailed,
  markClosingFarewellCompletionTimeout,
  markClosingFarewellDispatched,
  markClosingFarewellInterrupted,
  markProviderEndRequested,
  normalizePalSpeakingEvent,
  preserveInterviewTimerRuntime,
  recordClosingFarewellSpeechEvent,
  recordPostClosingInterruption,
  remainingSecondsAtDeadline,
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

test("three distinct wind-down violations do not reserve farewell or interrupt before 20 seconds", () => {
  const first = recordPostClosingInterruption(closingOnlyState(), "provider-event-1");
  const second = recordPostClosingInterruption(first.state, "provider-event-2");
  const third = recordPostClosingInterruption(second.state, "provider-event-3");

  assert.deepEqual(
    [first.shouldInterrupt, second.shouldInterrupt, third.shouldInterrupt],
    [false, false, false],
  );
  assert.deepEqual(
    [first.newViolation, second.newViolation, third.newViolation],
    [true, true, true],
  );
  assert.equal(first.state.closingFarewellPhase, "IDLE");
  assert.equal(second.state.closingFarewellPhase, "IDLE");
  assert.equal(third.state.closingFarewellPhase, "IDLE");
  assert.equal(
    [first, second, third]
      .flatMap((result) => result.actions)
      .filter((action) => action === "send_closing_farewell").length,
    0,
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

test("violation at 29 seconds cannot reserve farewell and the final window reserves once", () => {
  const violation = recordPostClosingInterruption(closingOnlyState(), "provider-event-1");
  const beforeFinalWindow = evaluateInterviewTimeBoundary({
    state: violation.state,
    remainingSeconds: 16,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const finalWindow = evaluateInterviewTimeBoundary({
    state: beforeFinalWindow.state,
    remainingSeconds: 15,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  assert.equal(violation.actions.includes("send_closing_farewell"), false);
  assert.equal(beforeFinalWindow.actions.includes("send_closing_farewell"), false);
  assert.equal(beforeFinalWindow.state.closingFarewellPhase, "IDLE");
  assert.equal(finalWindow.actions.filter((action) => action === "send_closing_farewell").length, 1);
  assert.equal(finalWindow.state.closingFarewellPhase, "RESERVED");
});

test("candidate or unauthorized PAL speech is interrupted at most once at the 20-second boundary", () => {
  const windDown = closingOnlyState();
  const beforeBoundary = evaluateInterviewTimeBoundary({
    state: windDown,
    remainingSeconds: 21,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const atBoundary = evaluateInterviewTimeBoundary({
    state: beforeBoundary.state,
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const duplicate = evaluateInterviewTimeBoundary({
    state: atBoundary.state,
    remainingSeconds: 19,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });

  assert.equal(beforeBoundary.actions.includes("interrupt_replica"), false);
  assert.equal(atBoundary.actions.filter((action) => action === "interrupt_replica").length, 1);
  assert.equal(
    atBoundary.actions.filter((action) => action === "send_candidate_question_invitation").length,
    1,
  );
  assert.equal(duplicate.actions.includes("interrupt_replica"), false);
  assert.equal(duplicate.actions.includes("send_candidate_question_invitation"), false);
  assert.equal(atBoundary.actions.includes("send_closing_farewell"), false);
});

test("a failed invitation dispatch is marked skipped and cannot retry", () => {
  const intended = evaluateInterviewTimeBoundary({
    state: closingOnlyState(),
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const failed = markCandidateQuestionInvitationDispatchFailed(intended.state, false);
  const repeated = evaluateInterviewTimeBoundary({
    state: failed,
    remainingSeconds: 19,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  assert.equal(failed.candidateQuestionInvitationSent, false);
  assert.equal(failed.candidateQuestionInvitationSkipped, true);
  assert.equal(repeated.actions.includes("send_candidate_question_invitation"), false);
});

test("exact 30/20/15 boundaries enter distinct monotonic stages", () => {
  const initial = createInterviewTimeBoundaryState();
  const locked = evaluateInterviewTimeBoundary({
    state: initial,
    remainingSeconds: 45,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const windDown = evaluateInterviewTimeBoundary({
    state: locked.state,
    remainingSeconds: 30,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const forced = evaluateInterviewTimeBoundary({
    state: windDown.state,
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const finalWindow = evaluateInterviewTimeBoundary({
    state: forced.state,
    remainingSeconds: 15,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });

  assert.equal(locked.state.phase, "QUESTION_LOCKED");
  assert.equal(windDown.state.phase, "WIND_DOWN_ONLY");
  assert.equal(forced.state.phase, "FORCED_WIND_DOWN");
  assert.equal(finalWindow.state.phase, "FINAL_FAREWELL_ELIGIBLE");
  assert.equal(finalWindow.state.closingFarewellPhase, "RESERVED");
});

test("unauthorized PAL speech at 20 seconds uses the same one-interrupt gate", () => {
  const windDown = closingOnlyState();
  const forced = evaluateInterviewTimeBoundary({
    state: windDown,
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: true,
    replicaSpeechIsApplicationControlled: false,
  });
  const repeated = evaluateInterviewTimeBoundary({
    state: forced.state,
    remainingSeconds: 19,
    candidateSpeaking: false,
    replicaSpeaking: true,
    replicaSpeechIsApplicationControlled: false,
  });
  assert.equal(forced.actions.filter((action) => action === "interrupt_replica").length, 1);
  assert.equal(repeated.actions.includes("interrupt_replica"), false);
  assert.equal(forced.actions.includes("send_closing_farewell"), false);
});

test("application-owned invitation still speaking at 20 seconds is not interrupted or replaced", () => {
  const windDown = {
    ...closingOnlyState(),
    candidateQuestionInvitationSent: true,
  };
  const forced = evaluateInterviewTimeBoundary({
    state: windDown,
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: true,
    replicaSpeechIsApplicationControlled: true,
  });
  assert.equal(forced.actions.includes("interrupt_replica"), false);
  assert.equal(forced.actions.includes("send_closing_farewell"), false);
});

test("violations at 16 seconds remain diagnostic-only until central 15-second evaluation", () => {
  const atSixteen = evaluateInterviewTimeBoundary({
    state: closingOnlyState(),
    remainingSeconds: 16,
    candidateSpeaking: false,
    replicaSpeaking: true,
  });
  const violation = recordPostClosingInterruption(atSixteen.state, "violation-at-16");
  assert.equal(violation.actions.includes("send_closing_farewell"), false);
  assert.equal(violation.state.closingFarewellPhase, "IDLE");
});

test("15-second reservation boundary is exact and duplicate evaluation is idempotent", () => {
  const windDown = closingOnlyState();
  const above = evaluateInterviewTimeBoundary({
    state: windDown,
    remainingSeconds: 15.001,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const exact = evaluateInterviewTimeBoundary({
    state: above.state,
    remainingSeconds: 15,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const dispatched = markClosingFarewellDispatched(exact.state);
  const below = evaluateInterviewTimeBoundary({
    state: dispatched,
    remainingSeconds: 14.999,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  assert.equal(above.actions.includes("send_closing_farewell"), false);
  assert.equal(exact.actions.filter((action) => action === "send_closing_farewell").length, 1);
  assert.equal(below.actions.includes("send_closing_farewell"), false);
});

test("20-second forced-wind-down boundary is exact on both sides", () => {
  const windDown = closingOnlyState();
  const above = evaluateInterviewTimeBoundary({
    state: windDown,
    remainingSeconds: 20.001,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const exact = evaluateInterviewTimeBoundary({
    state: above.state,
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  const below = evaluateInterviewTimeBoundary({
    state: exact.state,
    remainingSeconds: 19.999,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  assert.equal(above.actions.includes("interrupt_replica"), false);
  assert.equal(exact.actions.filter((action) => action === "interrupt_replica").length, 1);
  assert.equal(exact.actions.includes("send_closing_farewell"), false);
  assert.equal(below.actions.includes("interrupt_replica"), false);
  assert.equal(below.actions.includes("send_closing_farewell"), false);
});

test("application invitation crossing 15 seconds defers farewell Echo until its stop", () => {
  const invitationActive = {
    ...closingOnlyState(),
    candidateQuestionInvitationSent: true,
  };
  const atFifteen = evaluateInterviewTimeBoundary({
    state: invitationActive,
    remainingSeconds: 15,
    candidateSpeaking: false,
    replicaSpeaking: true,
    replicaSpeechIsApplicationControlled: true,
  });
  const afterStop = evaluateInterviewTimeBoundary({
    state: atFifteen.state,
    remainingSeconds: 14.5,
    candidateSpeaking: false,
    replicaSpeaking: false,
    replicaSpeechIsApplicationControlled: false,
  });
  assert.equal(atFifteen.state.closingFarewellPhase, "RESERVED");
  assert.equal(atFifteen.actions.includes("send_closing_farewell"), false);
  assert.equal(afterStop.actions.filter((action) => action === "send_closing_farewell").length, 1);
});

test("farewell completion and hard deadline racing still request provider end once", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const speaking = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started"),
    "active-conversation",
  ).state;
  const completed = recordClosingFarewellSpeechEvent(
    speaking,
    farewellEvent(speaking, "stopped"),
    "active-conversation",
  ).state;
  const normal = markProviderEndRequested(completed);
  const hardDeadline = markProviderEndRequested(normal.state);
  assert.equal(normal.requested, true);
  assert.equal(hardDeadline.requested, false);
});

test("provider speaking aliases without inference correlate only to the active dispatched farewell turn", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const start = normalizePalSpeakingEvent({
    event_type: "conversation.replica.started_speaking",
    properties: { role: "replica", conversation_id: "active-conversation", sequence: 71 },
  }, "active-conversation");
  const stop = normalizePalSpeakingEvent({
    event_type: "conversation.replica.stopped_speaking",
    properties: { role: "replica", conversation_id: "active-conversation", sequence: 71 },
  }, "active-conversation");
  assert.ok(start);
  assert.ok(stop);
  const speaking = recordClosingFarewellSpeechEvent(
    dispatched,
    start,
    "active-conversation",
    dispatched.farewellInferenceId,
  );
  const completed = recordClosingFarewellSpeechEvent(
    speaking.state,
    stop,
    "active-conversation",
    speaking.state.farewellInferenceId,
  );
  assert.equal(speaking.transition, "speaking");
  assert.equal(completed.transition, "completed");
});

test("reconnect, rerender, and remount preserve wind-down state and the absolute clock", () => {
  const runtime = initializeInterviewTimerRuntime(null, "active-conversation:staged", 1_000, 180_000);
  const windDown = evaluateInterviewTimeBoundary({
    state: evaluateInterviewTimeBoundary({
      state: runtime.boundaryState,
      remainingSeconds: 45,
      candidateSpeaking: false,
      replicaSpeaking: false,
    }).state,
    remainingSeconds: 30,
    candidateSpeaking: true,
    replicaSpeaking: false,
  }).state;
  const preserved = { ...runtime, boundaryState: windDown };
  preserveInterviewTimerRuntime(preserved);
  const reconnect = initializeInterviewTimerRuntime(preserved, "active-conversation:staged", 12_000, 180_000);
  const remount = initializeInterviewTimerRuntime(null, "active-conversation:staged", 22_000, 180_000);
  assert.strictEqual(reconnect, preserved);
  assert.strictEqual(remount, preserved);
  assert.equal(remount.boundaryState.phase, "WIND_DOWN_ONLY");
  assert.equal(remount.deadlineAt, 181_000);
});

test("authoritative clock is deterministic immediately around every closing boundary", () => {
  const deadline = 100_000;
  assert.equal(remainingSecondsAtDeadline(deadline, 55_000), 45);
  assert.equal(remainingSecondsAtDeadline(deadline, 70_000), 30);
  assert.equal(remainingSecondsAtDeadline(deadline, 80_000), 20);
  assert.equal(remainingSecondsAtDeadline(deadline, 85_000), 15);
  assert.equal(remainingSecondsAtDeadline(deadline, 90_000), 10);
  assert.equal(remainingSecondsAtDeadline(deadline, 100_000), 0);
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
  const wrongTurn = recordClosingFarewellSpeechEvent(
    started.state,
    farewellEvent(started.state, "stopped", { turnKey: "different-turn" }),
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
  assert.equal(wrongTurn.matched, false);
  assert.equal(completed.transition, "completed");
  assert.equal(duplicateStop.transition, "none");
});

test("a matching stop without observed farewell start cannot complete", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const stopped = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "stopped"),
    "active-conversation",
  );
  assert.equal(stopped.transition, "none");
  assert.equal(stopped.state.closingFarewellPhase, "DISPATCHED");
});

test("provider end waits while farewell speaks and proceeds immediately after completion", () => {
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
  assert.equal(closingProviderEndAllowed(completed, 14), true);
  assert.equal(closingProviderEndAllowed(completed, 11), true);
  assert.equal(closingProviderEndAllowed(speaking, 0, { hardDeadline: true }), true);
});

test("provider end is forbidden throughout wind-down without completion or hard deadline", () => {
  const windDown = closingOnlyState();
  assert.equal(closingProviderEndAllowed(windDown, 29), false);
  assert.equal(closingProviderEndAllowed(windDown, 20), false);
  assert.equal(closingProviderEndAllowed(windDown, 16), false);
});

test("remaining-time diagnostics derive from the current absolute deadline", () => {
  const staleRenderedRemaining = 25;
  assert.equal(staleRenderedRemaining > 10, true);
  assert.equal(remainingTimeBucketAtDeadline(100_000, 91_000), "0_10");
  assert.equal(remainingTimeBucketAtDeadline(100_000, 75_000), "11_30");
});

test("provider and candidate interruption terminate farewell without replay", () => {
  const dispatched = markClosingFarewellDispatched(reserveClosingFarewell(closingOnlyState()).state);
  const speaking = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started"),
    "active-conversation",
  ).state;
  const providerInterrupted = recordClosingFarewellSpeechEvent(
    speaking,
    farewellEvent(speaking, "stopped", { interrupted: true }),
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
  assert.equal(
    farewell.properties.text,
    "Thank you for your time. This concludes the interview.",
  );
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
