import assert from "node:assert/strict";
import { after, test } from "node:test";
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

globalThis.MediaStream ||= class MediaStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
};

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
  advanceSharedFinalClosingRuntime,
  attachRemotePalAudioTrack,
  claimSharedFinalClosingRuntime,
  finalClosingSharedStorageKey,
  readSharedFinalClosingRuntime,
  requestCandidateAudioUnpublish,
  sharedFinalClosingRecoveryPlan,
  sharedProviderEndAttemptAllowed,
} = closing;

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function mediaElement() {
  return {
    muted: false,
    volume: 1,
    srcObject: { existing: true },
    paused: false,
    pause() { this.paused = true; },
    play() { return Promise.resolve(); },
  };
}

test("one tab exclusively claims a conversation-bound closing", () => {
  const storage = memoryStorage();
  const first = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  const duplicate = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  const competing = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-b");
  const otherConversation = claimSharedFinalClosingRuntime(storage, "conversation-b", "tab-b");
  assert.equal(first.owned, true);
  assert.equal(duplicate.owned, true);
  assert.equal(competing.owned, false);
  assert.equal(otherConversation.owned, true);
  assert.notEqual(
    finalClosingSharedStorageKey("conversation-a"),
    finalClosingSharedStorageKey("conversation-b"),
  );
});

test("only the owner can monotonically advance through avatar Echo and request provider end once", () => {
  const storage = memoryStorage();
  claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  assert.equal(
    advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-b", "CANDIDATE_AUDIO_BLOCKED").advanced,
    false,
  );
  for (const phase of ["CANDIDATE_AUDIO_BLOCKED", "INTERRUPT_SENT", "ECHO_DISPATCHED", "ECHO_COMPLETED"]) {
    assert.equal(
      advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-a", phase).advanced,
      true,
    );
  }
  const provider = advanceSharedFinalClosingRuntime(
    storage,
    "conversation-a",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  );
  const duplicate = advanceSharedFinalClosingRuntime(
    storage,
    "conversation-a",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  );
  assert.equal(sharedProviderEndAttemptAllowed(provider), true);
  assert.equal(sharedProviderEndAttemptAllowed(duplicate), false);
  assert.equal(readSharedFinalClosingRuntime(storage, "conversation-a").phase, "PROVIDER_END_REQUESTED");
  assert.equal(
    advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-a", "RESERVED").advanced,
    false,
  );
});

test("owner remount never replays Echo and requests provider end only after completion", () => {
  const reserved = { version: 1, ownerTabId: "tab-a", phase: "RESERVED" };
  const requested = { ...reserved, phase: "PROVIDER_END_REQUESTED" };
  const complete = { ...reserved, phase: "COMPLETE" };

  assert.deepEqual(sharedFinalClosingRecoveryPlan(reserved, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: true,
    requestProviderEnd: false,
  });
  const echoCompleted = { ...reserved, phase: "ECHO_COMPLETED" };
  assert.deepEqual(sharedFinalClosingRecoveryPlan(echoCompleted, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: true,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(requested, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(requested, "tab-b"), {
    owned: false,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(complete, "tab-a"), {
    owned: true,
    navigateImmediately: true,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
  });
});

test("ambiguous shared state fails closed and never grants ownership", () => {
  const storage = memoryStorage();
  storage.setItem(finalClosingSharedStorageKey("conversation-a"), "{malformed");
  assert.equal(readSharedFinalClosingRuntime(storage, "conversation-a"), null);
  const claim = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  assert.equal(claim.owned, false);
  assert.equal(claim.reason, "ambiguous_shared_state");
});

test("remote PAL audio stays attached and audible during avatar closing", () => {
  const element = mediaElement();
  const result = attachRemotePalAudioTrack(element, { kind: "audio" }, true);
  assert.equal(result, "attached");
  assert.equal(element.muted, false);
  assert.equal(element.volume, 1);
  assert.ok(element.srcObject);
});

test("candidate audio unpublish terminally discards the Daily track", () => {
  const calls = [];
  const result = requestCandidateAudioUnpublish({
    setLocalAudio(enabled, options) {
      calls.push([enabled, options]);
      return this;
    },
  });
  assert.equal(result, "requested");
  assert.deepEqual(calls, [[false, { forceDiscardTrack: true }]]);
  assert.equal(requestCandidateAudioUnpublish({}), "unsupported");
  assert.equal(requestCandidateAudioUnpublish({
    setLocalAudio() { throw new Error("synthetic"); },
  }), "failed");
});

test("runtime awaits confirmed candidate audio-off before interrupt and avatar Echo", async () => {
  const source = await readFile(sourcePath, "utf8");
  const begin = source.slice(source.indexOf("const beginAvatarClosing"));
  const block = begin.indexOf("await confirmCandidateAudioPublicationDisabled");
  const confirmedGate = begin.indexOf('audioLockResult.category !== "confirmed_disabled"');
  const sharedAudioBlocked = begin.indexOf('"CANDIDATE_AUDIO_BLOCKED"');
  const successInterrupt = begin.indexOf("let interruptSent", sharedAudioBlocked);
  const interrupt = begin.indexOf("buildReplicaInterruptMessage", successInterrupt);
  const echo = begin.indexOf("buildFinalClosingAnnouncementMessage", interrupt);
  const provider = begin.indexOf("requestClosingProviderEnd");
  assert.ok(block >= 0);
  assert.ok(confirmedGate > block);
  assert.ok(sharedAudioBlocked > confirmedGate);
  assert.ok(successInterrupt > sharedAudioBlocked);
  assert.ok(interrupt > block);
  assert.ok(echo > interrupt);
  assert.ok(provider > echo);
  assert.doesNotMatch(begin.slice(0, provider), /requestClosingProviderEnd\(/);
  assert.doesNotMatch(begin, /requestCandidateAudioUnpublish\(callRef\.current\)/);
  assert.match(begin.slice(block, sharedAudioBlocked), /confirmed_disabled/);
  assert.match(begin.slice(block, sharedAudioBlocked), /audio_lock_failed/);
  assert.match(source, /end-conversation[\s\S]{0,700}keepalive:\s*true/);
  assert.match(
    source,
    /rearmCompletionFallback[\s\S]{0,500}armClosingCompletionFallback/,
  );
});

test("post-zero provider speech is parsed for closing completion while ordinary turns are blocked", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /if \(avatarClosingActiveRef\.current\)[\s\S]{0,900}recordClosingEchoSpeechEvent/);
  assert.doesNotMatch(source, /register\("app-message"[\s\S]{0,500}if \(avatarClosingActiveRef\.current\) return;/);
  assert.match(
    source,
    /progressWatchdogTimer = window\.setInterval[\s\S]{0,450}avatarClosingActiveRef\.current[\s\S]{0,120}stopProgressWatchdog\(\)/,
  );
});
