import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const pageSourcePath = join(testDirectory, "InterviewCviPage.tsx");
const startSourcePath = join(testDirectory, "InterviewPage.tsx");
const assetPath = join(websiteRoot, "public", "media", "interview-closing-final.mp3");

process.env.PORT ||= "4187";
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
const audioModule = await server.ssrLoadModule("/src/lib/interviewLocalClosingAudio.ts");
after(async () => server.close());

const {
  INTERVIEW_LOCAL_CLOSING_ASSET,
  INTERVIEW_LOCAL_CLOSING_DURATION_MS,
  INTERVIEW_LOCAL_CLOSING_FALLBACK_MS,
  INTERVIEW_LOCAL_CLOSING_TEXT,
  createLocalClosingAudioController,
} = audioModule;

function fakeAudio({ rejectPlay = false } = {}) {
  const listeners = new Map();
  const playStates = [];
  const element = {
    src: "",
    preload: "",
    muted: false,
    volume: 1,
    currentTime: 0,
    pauseCount: 0,
    loadCount: 0,
    addEventListener(name, listener) {
      const values = listeners.get(name) || [];
      values.push(listener);
      listeners.set(name, values);
    },
    removeEventListener(name, listener) {
      listeners.set(name, (listeners.get(name) || []).filter((value) => value !== listener));
    },
    load() { this.loadCount += 1; },
    pause() { this.pauseCount += 1; },
    async play() {
      playStates.push({ muted: this.muted, volume: this.volume, currentTime: this.currentTime });
      if (rejectPlay) throw new Error("synthetic playback rejection");
    },
    emit(name) {
      for (const listener of listeners.get(name) || []) listener();
    },
  };
  return { element, playStates };
}

test("the bundled clip contract is exact and bounded", async () => {
  const details = await stat(assetPath);
  const bytes = await readFile(assetPath);
  assert.equal(INTERVIEW_LOCAL_CLOSING_TEXT,
    "We are out of time. Thank you for your time. I am ending the session now.");
  assert.equal(INTERVIEW_LOCAL_CLOSING_ASSET, "/media/interview-closing-final.mp3");
  assert.equal(INTERVIEW_LOCAL_CLOSING_DURATION_MS, 4519);
  assert.equal(INTERVIEW_LOCAL_CLOSING_FALLBACK_MS, 6000);
  assert.ok(details.size > 60_000 && details.size < 90_000);
  assert.ok(bytes.length === details.size);
});

test("preload and trusted-gesture prime reuse one inaudible element", async () => {
  const fake = fakeAudio();
  let factoryCalls = 0;
  const controller = createLocalClosingAudioController(() => {
    factoryCalls += 1;
    return fake.element;
  });
  assert.equal(controller.preload(), true);
  assert.equal(await controller.prime(), "primed");
  assert.equal(factoryCalls, 1);
  assert.equal(controller.element(), fake.element);
  assert.deepEqual(fake.playStates, [{ muted: false, volume: 0, currentTime: 0 }]);
  assert.equal(fake.element.muted, false);
  assert.equal(fake.element.volume, 1);
  assert.equal(fake.element.currentTime, 0);
});

test("playback is audible, one-shot, and completes only from ended", async () => {
  const fake = fakeAudio();
  const events = [];
  const controller = createLocalClosingAudioController(() => fake.element);
  await controller.prime();
  const result = await controller.playOnce({
    onStarted: () => events.push("started"),
    onEnded: () => events.push("ended"),
    onFailed: () => events.push("failed"),
  });
  assert.equal(result, "started");
  assert.deepEqual(fake.playStates.at(-1), { muted: false, volume: 1, currentTime: 0 });
  assert.deepEqual(events, ["started"]);
  fake.element.emit("ended");
  assert.deepEqual(events, ["started", "ended"]);
  assert.equal(await controller.playOnce({
    onStarted: () => events.push("duplicate-started"),
    onEnded: () => events.push("duplicate-ended"),
    onFailed: () => events.push("duplicate-failed"),
  }), "duplicate");
  assert.deepEqual(events, ["started", "ended"]);
});

test("prime and deadline playback failures are bounded and never retried", async () => {
  const fake = fakeAudio({ rejectPlay: true });
  const events = [];
  const controller = createLocalClosingAudioController(() => fake.element);
  assert.equal(await controller.prime(), "prime_failed");
  assert.equal(await controller.playOnce({
    onStarted: () => events.push("started"),
    onEnded: () => events.push("ended"),
    onFailed: () => events.push("failed"),
  }), "play_failed");
  assert.deepEqual(events, ["failed"]);
  assert.equal(await controller.playOnce({
    onStarted: () => events.push("repeat-started"),
    onEnded: () => events.push("repeat-ended"),
    onFailed: () => events.push("repeat-failed"),
  }), "duplicate");
  assert.deepEqual(events, ["failed"]);
});

test("load failure preserves the unavailable fallback contract", async () => {
  const events = [];
  const controller = createLocalClosingAudioController(() => {
    throw new Error("synthetic load failure");
  });
  assert.equal(controller.preload(), false);
  assert.equal(await controller.prime(), "unavailable");
  assert.equal(await controller.playOnce({
    onStarted: () => events.push("started"),
    onEnded: () => events.push("ended"),
    onFailed: () => events.push("failed"),
  }), "unavailable");
  assert.deepEqual(events, ["failed"]);
});

test("the trusted Start Interview click primes before the provider request", async () => {
  const source = await readFile(startSourcePath, "utf8");
  const handler = source.slice(source.indexOf("async function handleStartInterview"));
  const prime = handler.indexOf("primeLocalClosingAudio()");
  const create = handler.indexOf('fetch(joinUrl(backendBase, "/create-tavus-interview")');
  assert.ok(prime >= 0);
  assert.ok(create > prime);
  assert.match(source, /preloadLocalClosingAudio\(\)/);
  assert.match(source, /local_closing_audio_prime_result/);
});

test("the local clip is isolated from the remote PAL audio element", async () => {
  const source = await readFile(pageSourcePath, "utf8");
  assert.match(source, /remoteAudioRef/);
  assert.match(source, /suppressRemotePalAudio\(remoteAudioRef\.current\)/);
  assert.match(source, /playLocalClosingAudioOnce/);
  assert.doesNotMatch(source, /playLocalClosingAudioOnce\([\s\S]{0,300}remoteAudioRef/);
});
