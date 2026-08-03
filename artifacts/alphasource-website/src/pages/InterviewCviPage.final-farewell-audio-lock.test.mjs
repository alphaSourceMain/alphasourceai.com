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
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  finalClosingAudioRestoreAllowed,
  finalClosingRequiresAudioOff,
  finalClosingSharedStorageKey,
  lockCandidateAudioPublication,
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

function fakeCall({ initiallyEnabled = true, apply = true, throwOn = [] } = {}) {
  let enabled = initiallyEnabled;
  let requests = 0;
  return {
    get requests() { return requests; },
    localAudio() { return enabled; },
    setLocalAudio(next) {
      requests += 1;
      if (throwOn.includes(requests)) throw new Error("synthetic Daily failure");
      if (apply) enabled = Boolean(next);
      return this;
    },
  };
}

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

test("setLocalAudio false is state-confirmed before success", () => {
  const call = fakeCall();
  const result = lockCandidateAudioPublication(call);
  assert.deepEqual(result, {
    category: "confirmed_disabled",
    attempts: 1,
    publicationEnabled: false,
  });
  assert.equal(call.requests, 1);
  assert.equal(call.localAudio(), false);
});

test("an already disabled microphone is accepted without another mutation", () => {
  const call = fakeCall({ initiallyEnabled: false });
  const result = lockCandidateAudioPublication(call);
  assert.equal(result.category, "already_disabled");
  assert.equal(result.attempts, 0);
  assert.equal(result.publicationEnabled, false);
  assert.equal(call.requests, 0);
});

test("a definitively unapplied failure may retry once and then confirms", () => {
  const call = fakeCall({ throwOn: [1] });
  const result = lockCandidateAudioPublication(call);
  assert.equal(result.category, "confirmed_disabled");
  assert.equal(result.attempts, 2);
  assert.equal(call.requests, 2);
});

test("a persistent definite failure is bounded and cannot dispatch farewell", () => {
  const call = fakeCall({ apply: false });
  const lock = lockCandidateAudioPublication(call);
  assert.equal(lock.category, "definite_failure");
  assert.equal(lock.attempts, 2);
  const closing = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState("synthetic-session"),
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  }).state;
  const resolved = markCandidateAudioLockResolved(closing, lock);
  assert.equal(resolved.dispatchFarewell, false);
  assert.equal(resolved.state.candidateAudioLockPhase, "FAILED");
});

test("ambiguous and unsupported publication state fail closed without replay", () => {
  const ambiguousCall = {
    setLocalAudio() { return this; },
    localAudio() { throw new Error("synthetic ambiguous state"); },
  };
  const ambiguous = lockCandidateAudioPublication(ambiguousCall);
  assert.equal(ambiguous.category, "ambiguous");
  assert.equal(ambiguous.attempts, 0);

  const unsupported = lockCandidateAudioPublication({});
  assert.equal(unsupported.category, "unsupported");
  assert.equal(unsupported.attempts, 0);
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
