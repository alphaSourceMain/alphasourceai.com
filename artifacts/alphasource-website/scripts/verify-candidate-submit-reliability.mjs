import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pageSource = fs.readFileSync(path.join(projectRoot, "src/pages/InterviewPage.tsx"), "utf8");
const transportSource = fs.readFileSync(path.join(projectRoot, "src/lib/candidateSubmissionTransport.ts"), "utf8");
const routes = JSON.parse(fs.readFileSync(path.join(projectRoot, "render-routes.json"), "utf8"));

const assertions = [
  [pageSource.includes("env.VITE_CANDIDATE_API_BASE"), "candidate API base is environment-gated"],
  [pageSource.includes('import.meta.env.PROD') && pageSource.includes('? "/candidate-api"'), "production builds default to the same-origin candidate proxy"],
  [pageSource.includes("postCandidateSubmission({"), "candidate submit uses bounded transport helper"],
  [pageSource.includes("const submissionKey = getOrCreateCandidateSubmissionKey(roleToken)"), "one submission key is reused across attempts"],
  [transportSource.includes("CANDIDATE_SUBMISSION_MAX_ATTEMPTS = 2"), "transport permits exactly two total attempts"],
  [transportSource.includes("body: buildBody()"), "each attempt receives a fresh multipart body"],
  [routes.proxyRewrites?.some((rule) => rule.source === "/candidate-api/*" && rule.status === 200), "same-origin candidate proxy precedes SPA routing"],
];

const failures = assertions.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error("Candidate submission reliability verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Verified ${assertions.length} candidate submission reliability contracts.`);
