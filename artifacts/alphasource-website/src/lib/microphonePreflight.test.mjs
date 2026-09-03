import assert from "node:assert/strict";
import { after, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");

process.env.PORT ||= "4181";
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
const preflight = await server.ssrLoadModule("/src/lib/microphonePreflight.ts");
const interview = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

test("sustained voice requires the complete voiced-time threshold", () => {
  const shortSpeech = [0, 100, 200, 300].map((at) => ({ at, rms: 0.02 }));
  const sustainedSpeech = [...shortSpeech, { at: 400, rms: 0.02 }];
  assert.equal(preflight.voicedMilliseconds(shortSpeech, 0.018), 300);
  assert.equal(preflight.sustainedVoiceDetected(shortSpeech, 0.018, 350), false);
  assert.equal(preflight.sustainedVoiceDetected(sustainedSpeech, 0.018, 350), true);
});

test("sample teardown continues through a recorder stop race", () => {
  let recorderStopCalls = 0;
  let trackStopCalls = 0;
  const revoked = [];
  const recorder = {
    state: "recording",
    ondataavailable: () => {},
    onerror: () => {},
    onstart: () => {},
    onstop: () => {},
    stop() {
      recorderStopCalls += 1;
      throw new DOMException("already stopped", "InvalidStateError");
    },
  };
  const sampleTrack = { stop: () => { trackStopCalls += 1; } };

  preflight.releaseMicrophoneSampleResources({
    recorder,
    sampleTrack,
    sampleUrl: "blob:local-only-sample",
    revokeObjectUrl: (url) => revoked.push(url),
  });

  assert.equal(recorderStopCalls, 1);
  assert.equal(trackStopCalls, 1);
  assert.deepEqual(revoked, ["blob:local-only-sample"]);
  assert.equal(recorder.ondataavailable, null);
  assert.equal(recorder.onerror, null);
  assert.equal(recorder.onstart, null);
  assert.equal(recorder.onstop, null);
});

test("omitted AGC settings remain default instead of turning a successful update into failure", () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getSupportedConstraints: () => ({ autoGainControl: true }) } },
  });
  try {
    assert.equal(interview.verifyAppliedAudioProcessing({ getSettings: () => ({}) }), "default");
    assert.equal(interview.verifyAppliedAudioProcessing({ getSettings: () => ({ autoGainControl: false }) }), "failed");
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
  }
});
