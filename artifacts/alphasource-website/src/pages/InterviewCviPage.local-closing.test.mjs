import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
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

test("the only application closing transition is reserved at zero", () => {
  const state = closing.createInterviewTimeBoundaryState("synthetic");
  for (const remainingSeconds of [180, 60, 20, 1, 0.001]) {
    const result = closing.evaluateInterviewTimeBoundary({ state, remainingSeconds });
    assert.equal(result.state.phase, "INTERVIEWING");
    assert.deepEqual(result.actions, []);
  }
  const result = closing.evaluateInterviewTimeBoundary({ state, remainingSeconds: 0 });
  assert.equal(result.state.phase, "LOCAL_CLOSING");
  assert.deepEqual(result.actions, [
    "reserve_local_closing",
    "mute_remote_pal_audio",
    "request_candidate_audio_unpublish",
    "play_local_closing_audio",
    "request_provider_end",
  ]);
});

test("the runtime has a bundled fixed asset and no PAL farewell control", async () => {
  const source = await readFile(sourcePath, "utf8");
  await access(assetPath);
  assert.equal(source.match(/event_type: "conversation\.echo"/g)?.length || 0, 1);
  assert.match(source, /CANDIDATE_INACTIVITY_NUDGE_TEXT/);
  assert.doesNotMatch(source, /buildFinalClosingAnnouncementMessage/);
  assert.doesNotMatch(source, /conversation\.interrupt/);
  assert.doesNotMatch(source, /closing_farewell_/);
  assert.doesNotMatch(source, /FINAL_CLOSING_THRESHOLD_SECONDS\s*=\s*20/);
  assert.match(source, /INTERVIEW_LOCAL_CLOSING_TEXT/);
  assert.match(source, /local_closing_reserved/);
  assert.match(source, /remote_pal_audio_muted/);
  assert.match(source, /candidate_audio_unpublish_requested/);
  assert.match(source, /local_closing_audio_play_requested/);
});
