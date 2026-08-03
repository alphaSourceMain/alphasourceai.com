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
  suppressRemotePalAudio,
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

test("only the owner can monotonically advance and request provider end once", () => {
  const storage = memoryStorage();
  claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  assert.equal(
    advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-b", "REMOTE_AUDIO_MUTED").advanced,
    false,
  );
  for (const phase of ["REMOTE_AUDIO_MUTED", "LOCAL_AUDIO_PLAY_REQUESTED"]) {
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

test("owner remount re-arms completion without replaying a reserved provider end", () => {
  const reserved = { version: 1, ownerTabId: "tab-a", phase: "RESERVED" };
  const requested = { ...reserved, phase: "PROVIDER_END_REQUESTED" };
  const complete = { ...reserved, phase: "COMPLETE" };

  assert.deepEqual(sharedFinalClosingRecoveryPlan(reserved, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmNavigationFallback: true,
    requestProviderEnd: true,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(requested, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmNavigationFallback: true,
    requestProviderEnd: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(requested, "tab-b"), {
    owned: false,
    navigateImmediately: false,
    rearmNavigationFallback: true,
    requestProviderEnd: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(complete, "tab-a"), {
    owned: true,
    navigateImmediately: true,
    rearmNavigationFallback: false,
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

test("remote PAL audio is synchronously muted, paused, and detached", () => {
  const element = mediaElement();
  assert.equal(suppressRemotePalAudio(element), "muted_detached");
  assert.equal(element.muted, true);
  assert.equal(element.volume, 0);
  assert.equal(element.paused, true);
  assert.equal(element.srcObject, null);
  assert.equal(suppressRemotePalAudio(element), "already_muted");
});

test("participant updates cannot restore remote audio after local closing", () => {
  const element = mediaElement();
  const result = attachRemotePalAudioTrack(element, { kind: "audio" }, true);
  assert.equal(result, "muted_detached");
  assert.equal(element.muted, true);
  assert.equal(element.volume, 0);
  assert.equal(element.srcObject, null);
});

test("candidate audio unpublish uses the supported Daily call without waiting", () => {
  const calls = [];
  const result = requestCandidateAudioUnpublish({
    setLocalAudio(enabled, options) {
      calls.push([enabled, options]);
      return this;
    },
  });
  assert.equal(result, "requested");
  assert.deepEqual(calls, [[false, { forceDiscardTrack: false }]]);
  assert.equal(requestCandidateAudioUnpublish({}), "unsupported");
  assert.equal(requestCandidateAudioUnpublish({
    setLocalAudio() { throw new Error("synthetic"); },
  }), "failed");
});

test("runtime ordering mutes remote audio before requesting local playback", async () => {
  const source = await readFile(sourcePath, "utf8");
  const begin = source.slice(source.indexOf("const beginLocalClosing"));
  const mute = begin.indexOf("suppressRemotePalAudio(remoteAudioRef.current)");
  const overlay = begin.indexOf("flushSync(() => setLocalClosingVisible(true))");
  const play = begin.indexOf("playLocalClosingAudioOnce");
  const provider = begin.indexOf("requestClosingProviderEnd()");
  assert.ok(overlay >= 0);
  assert.ok(mute > overlay);
  assert.ok(play > mute);
  assert.ok(provider > play);
  assert.equal(source.match(/playLocalClosingAudioOnce\(/g)?.length, 1);
  assert.equal(source.match(/requestCandidateAudioUnpublish\(callRef\.current\)/g)?.length, 1);
  assert.match(source, /end-conversation[\s\S]{0,700}keepalive:\s*true/);
  assert.match(
    source,
    /rearmNavigationFallback[\s\S]{0,300}localClosingNavigationTimerRef\.current\s*=\s*window\.setTimeout/,
  );
});

test("post-zero provider and candidate messages are ignored before parsing", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(
    source,
    /register\("app-message"[\s\S]{0,500}if \(localClosingActiveRef\.current\) return;/,
  );
  assert.match(
    source,
    /attachRemotePalAudioTrack\([\s\S]{0,180}localClosingActiveRef\.current/,
  );
});
