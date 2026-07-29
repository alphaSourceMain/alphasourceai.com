import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4176";
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
const timer = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  buildFinalClosingAnnouncementMessage,
  buildHiddenInterviewBoundaryMessage,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  timerToneForRemaining,
} = timer;

function evaluate(
  state,
  remainingSeconds,
  candidateSpeaking = false,
  replicaSpeaking = false,
  closingAnnouncementObserved = false,
) {
  return evaluateInterviewTimeBoundary({
    state,
    remainingSeconds,
    candidateSpeaking,
    replicaSpeaking,
    closingAnnouncementObserved,
  });
}

test("countdown warning colors remain visual-only at two and one minutes", () => {
  assert.equal(timerToneForRemaining(121), "normal");
  assert.equal(timerToneForRemaining(120), "warning");
  assert.equal(timerToneForRemaining(61), "warning");
  assert.equal(timerToneForRemaining(60), "urgent");
  assert.equal(timerToneForRemaining(1), "urgent");
});

test("more than thirty seconds preserves normal interview flow", () => {
  const result = evaluate(createInterviewTimeBoundaryState(), 31);
  assert.deepEqual(result.actions, []);
  assert.equal(result.state.wrapControlSent, false);
});

test("thirty-second closing control fires once at a natural turn boundary", () => {
  const first = evaluate(createInterviewTimeBoundaryState(), 30);
  const repeated = evaluate(first.state, 29);

  assert.deepEqual(first.actions, ["send_wrap_control"]);
  assert.deepEqual(repeated.actions, []);
  assert.equal(repeated.state.wrapControlSent, true);
});

test("active candidate or replica speech defers closing control", () => {
  const initial = createInterviewTimeBoundaryState();
  const candidateActive = evaluate(initial, 30, true, false);
  const replicaActive = evaluate(candidateActive.state, 29, false, true);
  const naturalBoundary = evaluate(replicaActive.state, 28, false, false);

  assert.deepEqual(candidateActive.actions, []);
  assert.deepEqual(replicaActive.actions, []);
  assert.deepEqual(naturalBoundary.actions, ["send_wrap_control"]);
});

test("final termination control and provider shutdown schedule are idempotent", () => {
  const first = evaluate(createInterviewTimeBoundaryState(), 10, true, false);
  const duplicate = evaluate(first.state, 9, false, false);

  assert.deepEqual(first.actions, [
    "send_termination_control",
    "send_final_announcement",
    "schedule_provider_shutdown",
  ]);
  assert.deepEqual(duplicate.actions, []);
  assert.equal(duplicate.state.terminationControlSent, true);
  assert.equal(duplicate.state.finalAnnouncementSent, true);
  assert.equal(duplicate.state.shutdownScheduled, true);
});

test("an already observed natural closing is not announced twice", () => {
  const result = evaluate(createInterviewTimeBoundaryState(), 10, false, false, true);
  assert.deepEqual(result.actions, [
    "send_termination_control",
    "schedule_provider_shutdown",
  ]);
  assert.equal(result.state.finalAnnouncementSent, true);
});

test("reconnect and rerender reuse state without replaying the closing sequence", () => {
  const wrapped = evaluate(createInterviewTimeBoundaryState(), 30);
  const sameStateAfterReconnect = wrapped.state;
  const afterReconnect = evaluate(sameStateAfterReconnect, 25);

  assert.deepEqual(afterReconnect.actions, []);
  assert.strictEqual(afterReconnect.state, sameStateAfterReconnect);
});

test("same-session timer effect re-entry preserves clock origin and one-shot state", () => {
  const initial = initializeInterviewTimerRuntime(null, "synthetic-conversation:10", 1_000);
  const wrapped = evaluate(initial.boundaryState, 30);
  const afterWrap = {
    ...initial,
    boundaryState: wrapped.state,
  };
  const rerun = initializeInterviewTimerRuntime(
    afterWrap,
    "synthetic-conversation:10",
    99_000,
  );

  assert.strictEqual(rerun, afterWrap);
  assert.equal(rerun.startedAt, 1_000);
  assert.equal(rerun.boundaryState.wrapControlSent, true);
  assert.deepEqual(evaluate(rerun.boundaryState, 29).actions, []);
});

test("a genuinely new conversation initializes an independent timer runtime", () => {
  const previous = initializeInterviewTimerRuntime(null, "synthetic-conversation-a:10", 1_000);
  const next = initializeInterviewTimerRuntime(
    previous,
    "synthetic-conversation-b:10",
    2_000,
  );

  assert.notStrictEqual(next, previous);
  assert.equal(next.startedAt, 2_000);
  assert.deepEqual(next.boundaryState, createInterviewTimeBoundaryState());
});

test("runtime controls use hidden context and contain no spoken script", () => {
  for (const phase of ["closing_window", "termination_window"]) {
    const message = buildHiddenInterviewBoundaryMessage("synthetic-conversation", phase);
    assert.equal(message.message_type, "conversation");
    assert.equal(message.event_type, "conversation.append_llm_context");
    assert.equal(message.conversation_id, "synthetic-conversation");
    assert.equal("text" in message.properties, false);
    assert.equal("speech" in message.properties, false);
    assert.equal("audio" in message.properties, false);

    const contract = JSON.parse(message.properties.context);
    assert.equal(contract.visibility, "internal_only");
    assert.equal(contract.disclosure, "forbidden");
    assert.equal(contract.control_state, phase);
    assert.doesNotMatch(message.properties.context, /\b(?:10|30|60|120)\b/);
    assert.doesNotMatch(message.properties.context, /\b(?:seconds?|minutes?|timer)\b/i);
  }
});

test("the only bounded direct speech is the approved closing announcement", () => {
  const message = buildFinalClosingAnnouncementMessage("synthetic-conversation");
  assert.equal(message.event_type, "conversation.echo");
  assert.equal(message.properties.done, true);
  assert.match(message.properties.text, /concludes the interview/i);
  assert.doesNotMatch(message.properties.text, /\b(?:10|30|60|120)\b/);
  assert.doesNotMatch(message.properties.text, /\b(?:seconds?|minutes?|timer|instruction|system)\b/i);
});

test("source contains no transcript-facing timer app message", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(source, /conversation\.respond/);
  assert.doesNotMatch(source, /TIME_WARNING_(?:NOTICE|TEXT)/);
  assert.doesNotMatch(source, /GRACEFUL_WRAP_(?:NOTICE|TEXT)/);
  assert.doesNotMatch(source, /setTimeNotice/);
  assert.match(source, /conversation\.append_llm_context/);
  assert.match(
    source,
    /initializeInterviewTimerRuntime\(\s*previousRuntime,\s*timerSessionKey,\s*monotonicNow\(\),\s*\)/,
  );
  assert.equal(
    source.match(/closingAnnouncementObservedRef\.current = false/g)?.length || 0,
    1,
  );
  assert.equal(source.match(/event_type: "conversation\.echo"/g)?.length || 0, 1);
  const echoStart = source.indexOf('event_type: "conversation.echo"');
  const echoEnd = source.indexOf("};", echoStart);
  const echoBlock = source.slice(echoStart, echoEnd);
  assert.doesNotMatch(echoBlock, /\b(?:seconds?|minutes?|timer|instruction|system)\b/i);
});
