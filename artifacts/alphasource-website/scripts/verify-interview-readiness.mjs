import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preflightSource = await readFile(path.join(root, "src/pages/InterviewPage.tsx"), "utf8");
const liveSource = await readFile(path.join(root, "src/pages/InterviewCviPage.tsx"), "utf8");
const candidatesSource = await readFile(path.join(root, "src/pages/dashboard/CandidatesPage.tsx"), "utf8");

assert.match(preflightSource, /supported\.autoGainControl[\s\S]*audioConstraints\.autoGainControl = true/);
assert.match(preflightSource, /supported\.echoCancellation[\s\S]*audioConstraints\.echoCancellation = true/);
assert.match(preflightSource, /supported\.noiseSuppression[\s\S]*audioConstraints\.noiseSuppression = true/);
assert.match(preflightSource, /Say a few words in your normal speaking voice/);
assert.match(preflightSource, /disabled=\{deviceLoading \|\| !previewAudioTrackLive \|\| !previewVideoTrackLive \|\| !micSignalDetected\}/);
assert.match(preflightSource, />\s*Continue anyway\s*</);
assert.doesNotMatch(preflightSource, />\s*Skip\s*</);

assert.match(liveSource, /startLocalAudioLevelObserver\(250\)/);
assert.match(liveSource, /register\("local-audio-level"/);
assert.match(liveSource, /LOCAL_AUDIO_READY_THRESHOLD/);
assert.match(liveSource, /local_audio_recovery_requested/);
assert.match(liveSource, /settings\.autoGainControl = true/);
assert.match(liveSource, /getConstraints\?\.\(\) \|\| \{\}/);
assert.match(liveSource, /applyQuietPreflightAudioRecovery/);
assert.match(liveSource, /session\.preflightAudioState !== "low" && session\.preflightAudioState !== "silent"/);
assert.match(liveSource, /We may not be hearing you/);
assert.match(liveSource, />\s*\{microphoneRecoveryBusy \? "Refreshing…" : "Try microphone"\}\s*</);
assert.doesNotMatch(liveSource, /local_media_preflight_result[\s\S]{0,1200}(device_id|device_label|exact_audio_level)/);

for (const label of ["Not started", "No response", "Tech issue", "Processing", "Incomplete", "Scored"]) {
  assert.match(candidatesSource, new RegExp(label.replace(" ", "\\s+")));
}
assert.match(candidatesSource, /emptyState=\{c\.interviewState\}/);

console.log("Interview readiness verification passed: audible preflight, bounded override, live mic recovery, privacy-safe telemetry, and concise dashboard states are present.");
