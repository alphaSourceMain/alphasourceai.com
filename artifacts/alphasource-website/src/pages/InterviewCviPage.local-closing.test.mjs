import assert from "node:assert/strict";
import { after, test } from "node:test";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");
const assetPath = join(websiteRoot, "public", "media", "interview-closing-final.mp3");

process.env.PORT ||= "4191";
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

test("zero sends one interrupt and one exact avatar Echo without a provider end", () => {
  const state = closing.createInterviewTimeBoundaryState("synthetic");
  for (const remainingSeconds of [180, 60, 20, 1, 0.001]) {
    const result = closing.evaluateInterviewTimeBoundary({ state, remainingSeconds });
    assert.equal(result.state.phase, "INTERVIEWING");
    assert.deepEqual(result.actions, []);
  }
  const result = closing.evaluateInterviewTimeBoundary({ state, remainingSeconds: 0 });
  assert.equal(result.state.phase, "AVATAR_CLOSING");
  assert.deepEqual(result.actions, [
    "reserve_avatar_closing",
    "request_candidate_audio_unpublish",
    "interrupt_replica",
    "send_closing_echo",
  ]);
  assert.equal(closing.closingProviderEndAllowed(result.state), false);

  const conversationId = "synthetic-conversation";
  const inferenceId = closing.closingApplicationInferenceId(conversationId);
  assert.deepEqual(closing.buildReplicaInterruptMessage(conversationId), {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: conversationId,
  });
  assert.deepEqual(closing.buildFinalClosingAnnouncementMessage(conversationId, inferenceId), {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text: "We are out of time. Thank you for your time. I am ending the session now.",
      done: true,
      inference_id: inferenceId,
    },
  });
});

test("strong and weak avatar completion defer provider end until the closing line stops", () => {
  const conversationId = "synthetic-conversation";
  const reserved = closing.evaluateInterviewTimeBoundary({
    state: closing.createInterviewTimeBoundaryState(conversationId),
    remainingSeconds: 0,
  }).state;
  const dispatched = closing.markClosingEchoDispatched(reserved);
  const inferenceId = dispatched.farewellInferenceId;

  const uncorrelatedStopBeforeStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "stopped",
    conversationId,
    turnKey: "interrupted-prior-turn",
    providerSequence: null,
    interrupted: false,
    applicationControl: false,
    correlation: "local",
  }, conversationId);
  assert.equal(uncorrelatedStopBeforeStart.transition, "none");
  assert.strictEqual(uncorrelatedStopBeforeStart.state, dispatched);

  const strong = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "stopped",
    conversationId,
    turnKey: "strong-turn",
    providerSequence: 8,
    interrupted: false,
    applicationControl: true,
    inferenceId,
    correlation: "provider",
  }, conversationId);
  assert.equal(strong.transition, "completed");
  assert.equal(closing.closingProviderEndAllowed(strong.state), true);

  const weakStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started",
    conversationId,
    turnKey: "weak-start",
    providerSequence: null,
    interrupted: false,
    applicationControl: false,
    correlation: "local",
  }, conversationId);
  assert.equal(weakStart.transition, "speaking");
  const weakStop = closing.recordClosingEchoSpeechEvent(weakStart.state, {
    kind: "stopped",
    conversationId,
    turnKey: "weak-stop",
    providerSequence: null,
    interrupted: false,
    applicationControl: false,
    correlation: "local",
  }, conversationId);
  assert.equal(weakStop.transition, "completed");
  assert.equal(closing.closingProviderEndAllowed(weakStop.state), true);
});

test("the runtime keeps normal video UI and contains no local closing asset or splash", async () => {
  const source = await readFile(sourcePath, "utf8");
  await assert.rejects(access(assetPath, constants.F_OK));
  assert.equal(source.match(/event_type: "conversation\.echo"/g)?.length || 0, 2);
  assert.match(source, /CANDIDATE_INACTIVITY_NUDGE_TEXT/);
  assert.match(source, /buildFinalClosingAnnouncementMessage/);
  assert.match(source, /conversation\.interrupt/);
  assert.match(source, /closing_farewell_started/);
  assert.doesNotMatch(source, /playLocalClosingAudioOnce/);
  assert.doesNotMatch(source, /INTERVIEW_LOCAL_CLOSING_TEXT/);
  assert.doesNotMatch(source, /localClosingVisible/);
  assert.doesNotMatch(source, /role="status"/);
  assert.doesNotMatch(source, /remote_pal_audio_muted/);
  assert.doesNotMatch(source, /FINAL_CLOSING_THRESHOLD_SECONDS\s*=\s*20/);
});
