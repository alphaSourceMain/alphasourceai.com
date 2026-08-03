import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");

process.env.PORT ||= "4184";
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
const runtime = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
const source = await readFile(join(testDirectory, "InterviewCviPage.tsx"), "utf8");
after(async () => server.close());

const {
  advanceSharedFinalClosingRuntime,
  candidateTurnSuppressedDuringFinalClosing,
  claimSharedFinalClosingRuntime,
  confirmCandidateAudioPublicationDisabled,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  finalClosingAudioRestoreAllowed,
  finalClosingRequiresAudioOff,
  finalClosingSharedStorageKey,
  markCandidateAudioLockResolved,
  readSharedFinalClosingRuntime,
  resetInterviewTimerRuntimeForTests,
  sharedProviderEndAttemptAllowed,
} = runtime;

beforeEach(() => resetInterviewTimerRuntimeForTests());

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function convergingDailyCall({
  initialState = "sendable",
  localAudioEnabled = true,
  setterThrows = [],
} = {}) {
  let audioState = initialState;
  let enabled = localAudioEnabled;
  let requests = 0;
  const listeners = new Set();
  const localParticipant = () => ({
    local: true,
    tracks: { audio: { state: audioState } },
  });
  return {
    get requests() { return requests; },
    get listenerCount() { return listeners.size; },
    localAudio() { return enabled; },
    participants() { return { local: localParticipant() }; },
    setLocalAudio(next) {
      requests += 1;
      if (setterThrows.includes(requests)) throw new Error("synthetic Daily setter failure");
      enabled = Boolean(next) ? true : enabled;
      return this;
    },
    on(event, handler) {
      if (event === "participant-updated") listeners.add(handler);
    },
    off(event, handler) {
      if (event === "participant-updated") listeners.delete(handler);
    },
    updateAudioState(nextState, { local = true, emit = true } = {}) {
      if (local) {
        audioState = nextState;
        enabled = nextState !== "off" && nextState !== "blocked";
      }
      if (emit) {
        for (const listener of [...listeners]) {
          listener({
            action: "participant-updated",
            participant: local
              ? localParticipant()
              : { local: false, tracks: { audio: { state: nextState } } },
          });
        }
      }
    },
    setLocalAudioEnabled(next) { enabled = Boolean(next); },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function manualClock() {
  let now = 0;
  let sequence = 0;
  const tasks = new Map();
  const setTimer = (callback, delayMs) => {
    const id = ++sequence;
    tasks.set(id, { id, at: now + delayMs, callback });
    return id;
  };
  const clearTimer = (id) => tasks.delete(id);
  const advanceTo = async (target) => {
    while (true) {
      const next = [...tasks.values()]
        .filter((task) => task.at <= target)
        .sort((left, right) => left.at - right.at || left.id - right.id)[0];
      if (!next) break;
      tasks.delete(next.id);
      now = next.at;
      next.callback();
      await Promise.resolve();
    }
    now = target;
    await Promise.resolve();
  };
  return {
    now: () => now,
    setTimer,
    clearTimer,
    advanceTo,
    get pending() { return tasks.size; },
  };
}

test("asynchronous Daily convergence replaces same-stack failure", async () => {
  const call = convergingDailyCall();
  assert.equal(typeof confirmCandidateAudioPublicationDisabled, "function");

  const pending = confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 80,
    pollIntervalMs: 5,
    retryAfterMs: 40,
  });
  await wait(10);
  call.updateAudioState("off");
  const result = await pending;
  assert.equal(result.category, "confirmed_disabled");
  assert.equal(result.confirmationSource, "participant_updated");
  assert.equal(result.publicationEnabled, false);
  assert.equal(call.listenerCount, 0);
});

test("listener-before-request and participant snapshot close both event races", async () => {
  const beforeListener = convergingDailyCall({ initialState: "off", localAudioEnabled: false });
  const existing = await confirmCandidateAudioPublicationDisabled(beforeListener, {
    timeoutMs: 50,
    pollIntervalMs: 5,
    retryAfterMs: 25,
  });
  assert.equal(existing.category, "confirmed_disabled");
  assert.equal(existing.confirmationSource, "participant_snapshot");

  const afterRequest = convergingDailyCall();
  const pending = confirmCandidateAudioPublicationDisabled(afterRequest, {
    timeoutMs: 80,
    pollIntervalMs: 5,
    retryAfterMs: 40,
  });
  afterRequest.updateAudioState("off");
  assert.equal((await pending).confirmationSource, "participant_updated");
});

test("irrelevant updates do not confirm and polling is a bounded fallback", async () => {
  const call = convergingDailyCall();
  const pending = confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 80,
    pollIntervalMs: 5,
    retryAfterMs: 40,
  });
  call.updateAudioState("off", { local: false });
  await wait(10);
  call.updateAudioState("off", { emit: false });
  const result = await pending;
  assert.equal(result.category, "confirmed_disabled");
  assert.equal(result.confirmationSource, "participant_snapshot_poll");
  assert.equal(call.listenerCount, 0);
});

test("timeout and cancellation remain fail closed and clean up", async () => {
  const timedOutCall = convergingDailyCall();
  const timedOut = await confirmCandidateAudioPublicationDisabled(timedOutCall, {
    timeoutMs: 30,
    pollIntervalMs: 5,
    retryAfterMs: 15,
  });
  assert.equal(timedOut.category, "definite_failure");
  assert.equal(timedOut.publicationEnabled, true);
  assert.equal(timedOutCall.listenerCount, 0);

  const controller = new AbortController();
  const cancelledCall = convergingDailyCall();
  const cancelledPending = confirmCandidateAudioPublicationDisabled(cancelledCall, {
    timeoutMs: 80,
    pollIntervalMs: 5,
    retryAfterMs: 40,
    signal: controller.signal,
  });
  controller.abort();
  const cancelled = await cancelledPending;
  assert.equal(cancelled.category, "cancelled_terminal");
  assert.equal(cancelledCall.listenerCount, 0);
});

test("a definite setter exception retries once while ambiguity does not", async () => {
  const retryCall = convergingDailyCall({ setterThrows: [1] });
  const retryPending = confirmCandidateAudioPublicationDisabled(retryCall, {
    timeoutMs: 80,
    pollIntervalMs: 5,
    retryAfterMs: 40,
  });
  await wait(10);
  retryCall.updateAudioState("off");
  const retried = await retryPending;
  assert.equal(retried.category, "confirmed_disabled");
  assert.equal(retried.attempts, 2);

  const ambiguous = {
    on() {},
    off() {},
    setLocalAudio() { return this; },
    localAudio() { return undefined; },
    participants() { return { local: { local: true, tracks: { audio: { state: "mystery" } } } }; },
  };
  const ambiguousResult = await confirmCandidateAudioPublicationDisabled(ambiguous, {
    timeoutMs: 30,
    pollIntervalMs: 5,
    retryAfterMs: 15,
  });
  assert.equal(ambiguousResult.category, "ambiguous");
  assert.equal(ambiguousResult.attempts, 1);
});

test("confirmation at the timeout boundary wins and later confirmation is ignored", async () => {
  const boundaryClock = manualClock();
  const boundaryCall = convergingDailyCall();
  boundaryClock.setTimer(() => boundaryCall.updateAudioState("off"), 30);
  const boundaryPending = confirmCandidateAudioPublicationDisabled(boundaryCall, {
    timeoutMs: 30,
    pollIntervalMs: 10,
    retryAfterMs: 15,
    now: boundaryClock.now,
    setTimer: boundaryClock.setTimer,
    clearTimer: boundaryClock.clearTimer,
  });
  await boundaryClock.advanceTo(30);
  const boundary = await boundaryPending;
  assert.equal(boundary.category, "confirmed_disabled");
  assert.equal(boundary.elapsedMs, 30);
  assert.equal(boundaryCall.listenerCount, 0);
  assert.equal(boundaryClock.pending, 0);

  const lateClock = manualClock();
  const lateCall = convergingDailyCall({ initialState: "loading" });
  const latePending = confirmCandidateAudioPublicationDisabled(lateCall, {
    timeoutMs: 30,
    pollIntervalMs: 10,
    retryAfterMs: 15,
    now: lateClock.now,
    setTimer: lateClock.setTimer,
    clearTimer: lateClock.clearTimer,
  });
  await lateClock.advanceTo(30);
  const late = await latePending;
  assert.equal(late.category, "timed_out");
  lateCall.updateAudioState("off");
  assert.equal(lateCall.listenerCount, 0);
  assert.equal(late.category, "timed_out");
});

test("duplicate and remote participant updates resolve only the local transition", async () => {
  const call = convergingDailyCall();
  const pending = confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 80,
    pollIntervalMs: 10,
    retryAfterMs: 40,
  });
  call.updateAudioState("off", { local: false });
  call.updateAudioState("off");
  call.updateAudioState("off");
  const result = await pending;
  assert.equal(result.category, "confirmed_disabled");
  assert.equal(result.confirmationSource, "participant_updated");
  assert.equal(call.requests, 1);
  assert.equal(call.listenerCount, 0);
});

test("localAudio false alone cannot authorize farewell without participant proof", async () => {
  const clock = manualClock();
  const call = convergingDailyCall({ initialState: "loading" });
  const pending = confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 40,
    pollIntervalMs: 10,
    retryAfterMs: 20,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  call.setLocalAudioEnabled(false);
  let resolved = false;
  void pending.then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved, false);
  await clock.advanceTo(10);
  assert.equal(resolved, false);
  call.updateAudioState("off", { emit: false });
  await clock.advanceTo(20);
  const result = await pending;
  assert.equal(result.category, "confirmed_disabled");
  assert.equal(result.confirmationSource, "participant_snapshot_poll");
});

test("a stable authoritative enabled state retries once and fails closed", async () => {
  const clock = manualClock();
  const call = convergingDailyCall();
  const pending = confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 40,
    pollIntervalMs: 10,
    retryAfterMs: 20,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  await clock.advanceTo(40);
  const result = await pending;
  assert.equal(result.category, "definite_failure");
  assert.equal(result.publicationEnabled, true);
  assert.equal(result.attempts, 2);
  assert.equal(call.requests, 2);
  assert.equal(clock.pending, 0);
});

test("the separate reconnect reassertion is one request with no retry", async () => {
  const clock = manualClock();
  const call = convergingDailyCall();
  const pending = confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 40,
    pollIntervalMs: 10,
    retryAfterMs: 20,
    allowRetry: false,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  await clock.advanceTo(40);
  const result = await pending;
  assert.equal(result.category, "definite_failure");
  assert.equal(result.attempts, 1);
  assert.equal(call.requests, 1);
});

test("the 20-second boundary reserves closing and requests audio lock before farewell", () => {
  const result = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState("synthetic-session"),
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: true,
  });
  assert.equal(result.state.phase, "FINAL_FAREWELL_ELIGIBLE");
  assert.equal(result.state.candidateAudioLockPhase, "REQUESTED");
  assert.deepEqual(result.actions, [
    "interrupt_replica",
    "record_closing_farewell_reserved",
    "request_candidate_audio_lock",
  ]);
  assert.equal(result.actions.includes("send_closing_farewell"), false);
});

test("confirmed Daily publication lock permits exactly one farewell dispatch", () => {
  const closing = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState("synthetic-session"),
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  }).state;
  const resolved = markCandidateAudioLockResolved(closing, {
    category: "confirmed_disabled",
    attempts: 1,
    publicationEnabled: false,
  });
  assert.equal(resolved.state.candidateAudioLockPhase, "LOCKED");
  assert.equal(resolved.dispatchFarewell, true);
  const duplicate = markCandidateAudioLockResolved(resolved.state, {
    category: "confirmed_disabled",
    attempts: 1,
    publicationEnabled: false,
  });
  assert.equal(duplicate.dispatchFarewell, false);
});

test("candidate turns are suppressed irreversibly after final closing begins", () => {
  const interviewing = createInterviewTimeBoundaryState("synthetic-session");
  const closing = evaluateInterviewTimeBoundary({
    state: interviewing,
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: false,
  }).state;
  assert.equal(candidateTurnSuppressedDuringFinalClosing(interviewing), false);
  assert.equal(candidateTurnSuppressedDuringFinalClosing(closing), true);
  assert.equal(finalClosingRequiresAudioOff(closing), true);
});

test("one tab owns farewell dispatch while all tabs observe the irreversible lock", () => {
  const storage = memoryStorage();
  const first = claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a");
  const second = claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-b");
  assert.equal(first.owned, true);
  assert.equal(second.owned, false);
  assert.equal(second.state.phase, "RESERVED");

  const locked = advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "AUDIO_LOCKED",
  );
  assert.equal(locked.advanced, true);
  assert.equal(readSharedFinalClosingRuntime(storage, "synthetic-conversation").phase, "AUDIO_LOCKED");
  assert.equal(finalClosingRequiresAudioOff(createInterviewTimeBoundaryState(), locked.state), true);

  const rejected = advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
    "FAREWELL_DISPATCHED",
  );
  assert.equal(rejected.advanced, false);
  assert.equal(readSharedFinalClosingRuntime(storage, "synthetic-conversation").phase, "AUDIO_LOCKED");
});

test("shared storage uses only an opaque conversation-derived key", () => {
  const key = finalClosingSharedStorageKey("synthetic-conversation-secret-marker");
  assert.match(key, /^alphascreen-final-closing:/);
  assert.doesNotMatch(key, /synthetic|conversation|secret|marker/);
});

test("corrupt shared state is ambiguous and cannot acquire or dispatch", () => {
  const storage = memoryStorage();
  const key = finalClosingSharedStorageKey("synthetic-conversation");
  storage.setItem(key, "not-json");
  const result = claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a");
  assert.equal(result.owned, false);
  assert.equal(result.reason, "ambiguous_shared_state");
});

test("audio restoration is limited to an explicit pre-dispatch abort", () => {
  const closing = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState("synthetic-session"),
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  }).state;
  assert.equal(finalClosingAudioRestoreAllowed(closing, { explicitAbort: false }), false);
  assert.equal(finalClosingAudioRestoreAllowed(closing, { explicitAbort: true }), true);
  const locked = markCandidateAudioLockResolved(closing, {
    category: "confirmed_disabled",
    attempts: 1,
    publicationEnabled: false,
  }).state;
  assert.equal(finalClosingAudioRestoreAllowed(locked, { explicitAbort: true }), true);
  const dispatched = { ...locked, closingFarewellPhase: "DISPATCHED" };
  assert.equal(finalClosingAudioRestoreAllowed(dispatched, { explicitAbort: true }), false);
});

test("normal interview behavior never requests or requires an audio lock", () => {
  for (const remainingSeconds of [180, 60, 21, 20.001]) {
    const result = evaluateInterviewTimeBoundary({
      state: createInterviewTimeBoundaryState("synthetic-session"),
      remainingSeconds,
      candidateSpeaking: true,
      replicaSpeaking: true,
    });
    assert.equal(result.state.phase, "INTERVIEWING");
    assert.equal(result.state.candidateAudioLockPhase, "IDLE");
    assert.equal(result.actions.includes("request_candidate_audio_lock"), false);
    assert.equal(finalClosingRequiresAudioOff(result.state), false);
  }
});

test("runtime pins the audited Daily version and never restores candidate audio during closing", () => {
  assert.match(source, /@daily-co\/daily-js@0\.91\.0\/dist\/daily\.js/);
  assert.match(source, /setLocalAudio\(false, \{ forceDiscardTrack: false \}\)/);
  assert.doesNotMatch(source, /setLocalAudio\(true/);
  assert.equal((source.match(/startAudioOff: closingAudioOffRequired\(\)/g) || []).length, 3);
  assert.match(source, /finalClosingTabIdRef\.current = FINAL_CLOSING_TAB_RUNTIME_ID/);
  assert.doesNotMatch(source, /FINAL_CLOSING_TAB_SESSION_KEY/);
});

test("late owner acquisition joins the same confirmation and cannot be downgraded", () => {
  assert.match(source, /existing\.sharedOwned = existing\.sharedOwned \|\| sharedOwned/);
  assert.match(source, /existing\.handleResult\(\)/);
  assert.match(source, /!operation\.sharedOwned/);
  assert.match(source, /operation\.farewellDispatchAttempted = true/);
  assert.match(source, /startFinalClosingAudioLock\(nextState, sharedClaim\.owned\)/);
});

test("reconnect reassertion is separately bounded and cannot replay farewell", () => {
  assert.match(source, /existing\.reassertAfterReconnect\(\)/);
  assert.match(source, /operation\.reconnectReasserted = true/);
  assert.match(source, /allowRetry: false/);
  assert.doesNotMatch(source, /reassertAfterReconnect[\s\S]{0,2600}sendFinalClosingAnnouncement/);
});

test("runtime suppresses candidate turns and inactivity after the irreversible boundary", () => {
  assert.match(source, /closing_candidate_activity_suppressed/);
  assert.match(source, /isCandidateSpeaking && !suppressCandidateTurn/);
  assert.match(source, /isCandidateUtterance && !suppressCandidateTurn/);
  assert.match(source, /cancelInactivityRuntime\("closing", true\)/);
});

test("farewell dispatch failure remains final-closing and cannot replay", () => {
  const closing = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState("synthetic-session"),
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  }).state;
  const failed = runtime.markClosingFarewellDispatchFailed(
    markCandidateAudioLockResolved(closing, {
      category: "confirmed_disabled",
      attempts: 1,
      publicationEnabled: false,
    }).state,
  );
  const repeated = evaluateInterviewTimeBoundary({
    state: failed,
    remainingSeconds: 10,
    candidateSpeaking: true,
    replicaSpeaking: false,
  });
  assert.equal(repeated.state.phase, "FINAL_FAREWELL_ELIGIBLE");
  assert.equal(repeated.state.closingFarewellPhase, "INTERRUPTED");
  assert.equal(repeated.actions.includes("request_candidate_audio_lock"), false);
  assert.equal(repeated.actions.includes("send_closing_farewell"), false);
});

test("shared final-closing progression is monotonic and duplicate effects cannot replay", () => {
  const storage = memoryStorage();
  assert.equal(claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a").owned, true);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "AUDIO_LOCKED",
  ).advanced, true);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "AUDIO_LOCKED",
  ).advanced, false);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "RESERVED",
  ).advanced, false);
});

test("a surviving observer can single-flight the provider end after the farewell owner disappears", () => {
  const storage = memoryStorage();
  assert.equal(claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a").owned, true);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "AUDIO_LOCKED",
  ).advanced, true);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "FAREWELL_DISPATCHED",
  ).advanced, true);

  const observerEnd = advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
    "PROVIDER_END_REQUESTED",
  );
  assert.equal(observerEnd.advanced, true);
  assert.equal(observerEnd.state.phase, "PROVIDER_END_REQUESTED");
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  ).advanced, false);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
    "ENDED",
  ).advanced, true);
});

test("runtime serializes cross-tab provider-end claims with an opaque Web Lock", () => {
  assert.match(source, /navigator\.locks/);
  assert.match(source, /lockManager\.request\(/);
  assert.match(source, /mode: "exclusive"/);
  assert.match(source, /\$\{FINAL_CLOSING_STORAGE_PREFIX\}-end:\$\{boundedOpaqueHash\(conversationId\)\}/);
  assert.doesNotMatch(source, /-end:\$\{conversationId\}/);
});

test("an unconfirmed provider-end claim remains safely retryable until ENDED proof", () => {
  const storage = memoryStorage();
  claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a");
  advanceSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a", "AUDIO_LOCKED");
  advanceSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a", "FAREWELL_DISPATCHED");
  const first = advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  );
  assert.equal(sharedProviderEndAttemptAllowed(first), true);

  const lostResponseRetry = advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
    "PROVIDER_END_REQUESTED",
  );
  assert.equal(lostResponseRetry.advanced, false);
  assert.equal(lostResponseRetry.state.phase, "PROVIDER_END_REQUESTED");
  assert.equal(sharedProviderEndAttemptAllowed(lostResponseRetry), true);

  advanceSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-b", "ENDED");
  const completed = advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  );
  assert.equal(completed.state.phase, "ENDED");
  assert.equal(sharedProviderEndAttemptAllowed(completed), false);
});

test("an ambiguous mid-flight remount cannot replay farewell but retains the shared deadline end", () => {
  const storage = memoryStorage();
  claimSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a");
  advanceSharedFinalClosingRuntime(storage, "synthetic-conversation", "tab-a", "AUDIO_LOCKED");
  const remounted = claimSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
  );
  assert.equal(remounted.owned, false);
  assert.equal(remounted.state.phase, "AUDIO_LOCKED");
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
    "FAREWELL_DISPATCHED",
  ).advanced, false);
  assert.equal(advanceSharedFinalClosingRuntime(
    storage,
    "synthetic-conversation",
    "tab-b",
    "PROVIDER_END_REQUESTED",
  ).advanced, true);
});
