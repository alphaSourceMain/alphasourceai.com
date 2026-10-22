import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const source = readFileSync(new URL("../src/lib/linkedinInsight.ts", import.meta.url), "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "esm",
  define: { "import.meta.env": "{}" },
}).code;
const {
  createLinkedInInsight,
  linkedInPartnerId,
  LINKEDIN_CONSENT_REVISION,
  LINKEDIN_INSIGHT_SCRIPT_SRC,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const key = "alphasource:tracking-preferences:v2";
const savedConsent = {
  analytics: false,
  marketingAttribution: true,
  linkedinRevision: LINKEDIN_CONSENT_REVISION,
  updatedAt: "2026-10-22T17:00:00.000Z",
};

function harness({ choice = savedConsent, partnerId = "1234567", readonly = false, foreign = false } = {}) {
  const values = new Map(choice ? [[key, JSON.stringify(choice)]] : []);
  const scripts = [];
  const listeners = [];
  let reloads = 0;
  const elements = new Map();
  const win = {
    location: { reload: () => { reloads += 1; } },
    localStorage: {
      getItem: (name) => values.get(name) || null,
      setItem: (name, value) => {
        if (readonly) throw new Error("blocked");
        values.set(name, value);
      },
    },
    addEventListener: (type, listener) => listeners.push({ type, listener }),
    document: {
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => (foreign ? { existing: true } : null),
      createElement: () => {
        const element = {
          id: "",
          async: false,
          src: "",
          onerror: null,
          remove() { elements.delete(element.id); },
        };
        scripts.push(element);
        return element;
      },
      head: {
        appendChild: (element) => { elements.set(element.id, element); },
      },
    },
  };
  const tag = createLinkedInInsight(win, partnerId);
  const allow = {
    onPublicRoute: true,
    marketingAttribution: true,
    linkedinRevision: LINKEDIN_CONSENT_REVISION,
  };
  return { win, tag, scripts, listeners, values, reloads: () => reloads, allow };
}

test("blank partner ids are ignored and never hard-coded", () => {
  assert.equal(linkedInPartnerId(""), "");
  assert.equal(linkedInPartnerId("  "), "");
  assert.equal(linkedInPartnerId(undefined), "");
  assert.equal(linkedInPartnerId(" 1234567 "), "1234567");
  assert.match(source, /import\.meta\.env\.VITE_LINKEDIN_PARTNER_ID/);
  assert.doesNotMatch(source, /px\.ads\.linkedin\.com|noscript|_linkedin_partner_id\s*=\s*["']\d+/);
});

test("an empty partner id skips the tag even when marketing consent is saved", () => {
  const blank = harness({ partnerId: "" });
  blank.tag.sync(blank.allow);
  blank.tag.start();
  assert.equal(blank.scripts.length, 0);
  assert.equal(blank.tag.needsConsentRefresh(), false);
  assert.equal(blank.tag.changeChoice(false, true), false);
  assert.equal(blank.reloads(), 0);
  assert.equal(blank.listeners.length, 0);
});

test("marketing consent without the current LinkedIn revision does not load the tag", () => {
  const prior = harness({
    choice: { analytics: true, marketingAttribution: true, updatedAt: "2026-10-21T22:00:00.000Z" },
  });
  assert.equal(prior.tag.needsConsentRefresh(), true);
  prior.tag.sync({ ...prior.allow, linkedinRevision: undefined });
  prior.tag.start();
  assert.equal(prior.scripts.length, 0);
  assert.equal(prior.win._linkedin_partner_id, undefined);

  const analyticsOnly = harness({
    choice: { ...savedConsent, marketingAttribution: false },
  });
  analyticsOnly.tag.sync({ ...analyticsOnly.allow, marketingAttribution: false });
  assert.equal(analyticsOnly.scripts.length, 0);
  assert.equal(analyticsOnly.tag.needsConsentRefresh(), false);
});

test("the standard insight tag loads once, asynchronously, and without a noscript pixel", () => {
  const h = harness();
  h.tag.sync({ ...h.allow, onPublicRoute: false });
  assert.equal(h.scripts.length, 0);
  assert.equal(h.reloads(), 0);

  h.tag.sync(h.allow);
  h.tag.sync(h.allow);
  h.tag.start();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.scripts[0].async, true);
  assert.equal(h.scripts[0].src, LINKEDIN_INSIGHT_SCRIPT_SRC);
  assert.equal(h.scripts[0].src, "https://snap.licdn.com/li.lms-analytics/insight.min.js");
  assert.equal(h.win._linkedin_partner_id, "1234567");
  assert.deepEqual(h.win._linkedin_data_partner_ids, ["1234567"]);
  assert.equal(typeof h.win.lintrk, "function");
  assert.deepEqual(h.win.lintrk.q, []);
  assert.equal(h.scripts[0].id, "alphasource-linkedin-insight");
  assert.doesNotMatch(JSON.stringify(h.scripts), /px\.ads\.linkedin\.com|noscript/);
});

test("withdrawn consent and private routes unload a tag that already loaded", () => {
  const withdrawn = harness();
  withdrawn.tag.sync(withdrawn.allow);
  assert.equal(withdrawn.scripts.length, 1);
  withdrawn.tag.sync({ ...withdrawn.allow, marketingAttribution: false });
  assert.equal(withdrawn.win.document.getElementById("alphasource-linkedin-insight"), null);
  assert.equal(withdrawn.reloads(), 1);
  withdrawn.tag.sync(withdrawn.allow);
  assert.equal(withdrawn.scripts.length, 1);
  assert.equal(withdrawn.tag.changeChoice(true, true), false);
  withdrawn.tag.sync(withdrawn.allow);
  assert.equal(withdrawn.scripts.length, 2);

  const privateRoute = harness();
  privateRoute.tag.sync(privateRoute.allow);
  privateRoute.tag.sync({ ...privateRoute.allow, onPublicRoute: false });
  assert.equal(privateRoute.reloads(), 1);
  assert.equal(privateRoute.win.document.getElementById("alphasource-linkedin-insight"), null);

  const saved = harness();
  saved.tag.sync(saved.allow);
  assert.equal(saved.tag.changeChoice(false, true), true);
  assert.equal(saved.reloads(), 1);
  saved.tag.start();
  assert.equal(saved.scripts.length, 1);
  assert.equal(saved.tag.changeChoice(false, false), false);
});

test("blocked storage, a failed script, and a foreign tag do not keep loading", () => {
  const blocked = harness({ readonly: true });
  blocked.tag.sync(blocked.allow);
  assert.equal(blocked.scripts.length, 0);

  const failed = harness();
  failed.tag.sync(failed.allow);
  failed.scripts[0].onerror();
  failed.tag.sync(failed.allow);
  assert.equal(failed.scripts.length, 1);
  assert.equal(failed.win.document.getElementById("alphasource-linkedin-insight"), null);

  const foreign = harness({ foreign: true });
  foreign.tag.sync(foreign.allow);
  assert.equal(foreign.scripts.length, 0);
  assert.equal(foreign.win._linkedin_partner_id, undefined);
});

test("cross-tab withdrawal reloads after the tag has loaded", () => {
  const h = harness();
  h.tag.sync(h.allow);
  const storage = h.listeners.find((listener) => listener.type === "storage");
  h.values.set(key, JSON.stringify({ ...savedConsent, marketingAttribution: false }));
  storage.listener({ key });
  assert.equal(h.reloads(), 1);
  storage.listener({ key: "other" });
  assert.equal(h.reloads(), 1);
});

test("the tag is mounted with GA4 and Clarity and disclosed with the marketing category", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const app = read("src/App.tsx");
  const replay = app.indexOf("<PublicSessionReplay location={location} />");
  const linkedin = app.indexOf("<LinkedInInsightLoader location={location} />");
  const pixel = app.indexOf("<IDPixelLoader location={location} />");
  assert.ok(replay >= 0 && linkedin > replay && pixel > linkedin);
  assert.match(read("src/components/TrackingConsentNotice.tsx"), /LinkedIn Insight Tag/);
  assert.match(read("src/components/TrackingConsentNotice.tsx"), /Google Analytics 4/);
  assert.match(read("src/components/TrackingConsentNotice.tsx"), /Microsoft Clarity/);
  assert.match(read("src/pages/PrivacyPage.tsx"), /LinkedIn Insight Tag/);
  assert.match(read("src/context/TrackingConsentContext.tsx"), /linkedinRevision: LINKEDIN_CONSENT_REVISION/);
  assert.match(read("src/context/TrackingConsentContext.tsx"), /changeLinkedInChoice\(Boolean\(nextPreferences\.marketingAttribution\), persisted && !replayReload\)/);
  assert.match(read("src/context/TrackingConsentContext.tsx"), /needsLinkedInConsentRefresh\(\)/);
  const example = read(".env.example");
  assert.match(example, /VITE_LINKEDIN_PARTNER_ID=/);
  assert.match(example, /build-time/);
  assert.doesNotMatch(read("src/components/LinkedInInsightLoader.tsx"), /px\.ads\.linkedin\.com/);
});
