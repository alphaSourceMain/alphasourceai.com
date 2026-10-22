import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync, build } from "esbuild";
import { JSDOM, CookieJar } from "jsdom";
import { createRequire } from "node:module";

const source = readFileSync(new URL("../src/lib/linkedinInsight.ts", import.meta.url), "utf8");
const compiled = transformSync(source, { loader: "ts", format: "esm", define: { "import.meta.env": "{}" } }).code;
const { createLinkedInInsight, linkedInPage, linkedInPartnerId, LINKEDIN_CONSENT_REVISION, LINKEDIN_INSIGHT_SCRIPT_SRC } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const key = "alphasource:tracking-preferences:v2";
const blockKey = "alphasource:linkedin-blocked:v1";
const cookie = "alphasource_linkedin_blocked";
const savedConsent = { analytics: false, sessionReplay: false, marketingAttribution: true, linkedinRevision: LINKEDIN_CONSENT_REVISION, updatedAt: "2026-10-22T17:00:00.000Z" };
const allow = { marketingAttribution: true, linkedinRevision: LINKEDIN_CONSENT_REVISION };
const root = "https://www.alphasourceai.com/";
const excluded = [
  "alphascreen/pricing/", "alphascreen/roi/", "support/", "support/?signin=client", "support/?signin=admin",
  "support/?signin=client&setup=password", "dashboard/", "dashboard/billing", "admin/", "sales/", "login/",
  "signin/", "auth/callback", "pwreset/", "reset-password/", "set-password/", "membership-agreement/sign/token",
  "payment/success", "checkout/", "interview/token", "candidate/token", "unknown/",
];
const closers = new Set();
test.afterEach(() => { for (const close of closers) close(); closers.clear(); });
function harness(options = {}) {
  const { url = root, choice = savedConsent, partnerId = "1234567", enabled = true, referrer, foreign = false,
    values = new Map(choice ? [[key, JSON.stringify(choice)]] : []), session = new Map(), jar = new CookieJar() } = options;
  let readonly = Boolean(options.readonly), blockedSession = Boolean(options.blockedSession), blockedCookies = Boolean(options.blockedCookies);
  let reloads = 0;
  const navigations = [], replacements = [], historyWrites = [], cookieWrites = [], scripts = [];
  const dom = new JSDOM("<!doctype html><body><button data-replay-auth='client'>Sign in</button><button data-replay-auth='admin'>Admin</button><a id='private' href='/dashboard/'>Dashboard</a><a id='anchor' href='#contact'>Contact</a><form><input id='name' value='SYNTHETIC'></form></body>", { url, cookieJar: jar, ...(referrer ? { referrer } : {}) });
  closers.add(() => dom.window.close());
  const doc = dom.window.document;
  const nativeCookie = Object.getOwnPropertyDescriptor(dom.window.Document.prototype, "cookie");
  Object.defineProperty(doc, "cookie", {
    get() { return blockedCookies ? "" : nativeCookie.get.call(doc); },
    set(value) { cookieWrites.push(value); if (!blockedCookies) nativeCookie.set.call(doc, value); },
    configurable: true,
  });
  const append = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = element => { scripts.push(element); return append(element); }; // no resource execution
  const win = {
    document: doc,
    navigator: { globalPrivacyControl: Boolean(options.gpc) },
    location: { href: url, reload: () => { reloads++; }, assign: to => navigations.push(to), replace: to => replacements.push(to) },
    localStorage: { getItem: name => values.get(name) ?? null, setItem: (name, value) => { if (readonly) throw Error("blocked localStorage"); values.set(name, value); } },
    sessionStorage: { getItem: name => { if (blockedSession) throw Error("blocked session"); return session.get(name) ?? null; },
      setItem: (name, value) => { if (blockedSession) throw Error("blocked session"); session.set(name, value); },
      removeItem: name => { if (blockedSession) throw Error("blocked session"); session.delete(name); } },
    addEventListener: dom.window.addEventListener.bind(dom.window),
    history: { pushState: (...args) => write(args), replaceState: (...args) => write(args) },
  };
  function write(args) {
    const destination = new URL(args[2] ?? win.location.href, win.location.href);
    if (destination.origin !== new URL(win.location.href).origin) throw new DOMException("Cross origin", "SecurityError");
    historyWrites.push({ destination: destination.href, scriptPresent: Boolean(doc.getElementById("alphasource-linkedin-insight")) });
    win.location.href = destination.href; // stands for Wouter's history write / route commit
  }
  if (foreign) { const s = doc.createElement("script"); s.src = LINKEDIN_INSIGHT_SCRIPT_SRC; append(s); }
  const tag = createLinkedInInsight(win, partnerId, enabled);
  return { win, dom, doc, tag, values, session, jar, scripts, navigations, replacements, historyWrites, cookieWrites,
    reloads: () => reloads, readonly: () => { readonly = true; },
    blockEverything: () => { readonly = true; blockedSession = true; blockedCookies = true; },
    fire: (name, event) => dom.window.dispatchEvent(event ?? new dom.window.Event(name)),
    interact: (selector, type = "click", args = {}) => {
      const event = type === "keydown" ? new dom.window.KeyboardEvent(type, { key: "Enter", bubbles: true, cancelable: true, ...args })
        : new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...args });
      doc.querySelector(selector).dispatchEvent(event);
      return event;
    },
  };
}
function stopped(h) {
  assert.equal(h.doc.getElementById("alphasource-linkedin-insight"), null);
  assert.equal(h.win.__alphasourceLinkedInDisabled, true);
  assert.equal(h.win._linkedin_partner_id, undefined);
  assert.deepEqual(h.win._linkedin_data_partner_ids, []);
  h.win.lintrk("track", { conversion_id: "synthetic" });
  assert.deepEqual(h.win.lintrk.q, []);
}

test("blank partner ids are ignored and never hard-coded", () => {
  for (const value of ["", "  ", undefined]) assert.equal(linkedInPartnerId(value), "");
  assert.equal(linkedInPartnerId(" 1234567 "), "1234567");
  assert.match(source, /import\.meta\.env\.VITE_LINKEDIN_PARTNER_ID/);
  assert.match(source, /readConfiguredLinkedInPartnerId\(\), import\.meta\.env\.PROD/);
  assert.doesNotMatch(source, /px\.ads\.linkedin\.com|noscript|_linkedin_partner_id\s*=\s*["']\d+/);
});
test("an empty partner id skips the tag even when marketing consent is saved", () => {
  const h = harness({ partnerId: "" });
  const original = h.win.history.pushState;
  h.tag.sync(allow); h.tag.start();
  assert.equal(h.scripts.length, 0); assert.equal(h.tag.changeChoice(false, true), false);
  assert.equal(h.reloads(), 0); assert.equal(h.tag.needsConsentRefresh(), false);
  assert.equal(h.win.history.pushState, original);
});
test("marketing consent without the current LinkedIn revision does not load the tag", () => {
  const old = harness({ choice: { ...savedConsent, linkedinRevision: undefined } });
  assert.equal(old.tag.needsConsentRefresh(), true); old.tag.sync({ ...allow, linkedinRevision: undefined }); old.tag.start();
  assert.equal(old.scripts.length, 0);
  const analyticsOnly = harness({ choice: { ...savedConsent, analytics: true, marketingAttribution: false } });
  analyticsOnly.tag.sync({ ...allow, marketingAttribution: false }); analyticsOnly.tag.start();
  assert.equal(analyticsOnly.scripts.length, 0);
});
test("the standard insight tag loads once, asynchronously, and without a noscript pixel", () => {
  const h = harness(); h.tag.sync(allow); h.tag.sync(allow); h.tag.start();
  assert.equal(h.scripts.length, 1); assert.equal(h.scripts[0].async, true);
  assert.equal(h.scripts[0].src, LINKEDIN_INSIGHT_SCRIPT_SRC); assert.equal(h.scripts[0].referrerPolicy, "no-referrer");
  assert.equal(h.win._linkedin_partner_id, "1234567"); assert.deepEqual(h.win._linkedin_data_partner_ids, ["1234567"]);
  h.win.lintrk("track", { conversion_id: "synthetic" }); assert.equal(h.win.lintrk.q.length, 1);
  assert.equal(h.doc.querySelectorAll("noscript,img").length, 0);
});
test("withdrawn consent and private routes unload a tag that already loaded", () => {
  const h = harness(); h.tag.sync(allow); h.tag.sync({ ...allow, marketingAttribution: false });
  stopped(h); assert.equal(h.reloads(), 1); h.tag.sync(allow); h.tag.start(); assert.equal(h.scripts.length, 1);
  const privatePage = harness(); privatePage.tag.start(); privatePage.win.history.pushState(null, "", "/dashboard/");
  stopped(privatePage); assert.deepEqual(privatePage.navigations, [root + "dashboard/"]); assert.equal(privatePage.historyWrites.length, 0);
});
test("blocked storage, a failed script, and a foreign tag do not keep loading", () => {
  const blocked = harness({ readonly: true }); blocked.tag.start(); assert.equal(blocked.scripts.length, 0);
  const failed = harness(); failed.tag.start(); failed.scripts[0].onerror(); failed.tag.sync(allow);
  assert.equal(failed.scripts.length, 1); stopped(failed); assert.equal(failed.reloads(), 0, "no failed-resource reload loop");
  const foreign = harness({ foreign: true }); foreign.tag.start(); assert.equal(foreign.scripts.length, 0); assert.equal(foreign.win._linkedin_partner_id, undefined);
});
test("cross-tab withdrawal reloads after the tag has loaded, including storage.clear", () => {
  for (const eventKey of [key, null]) {
    const h = harness(); h.tag.start(); h.values.clear();
    h.fire("storage", new h.dom.window.StorageEvent("storage", { key: eventKey }));
    stopped(h); assert.equal(h.reloads(), 1);
  }
});
test("the tag is mounted with GA4 and Clarity and disclosed with the marketing category", () => {
  const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const app = read("src/App.tsx");
  assert.ok(app.indexOf("<PublicSessionReplay location={location} />") < app.indexOf("<LinkedInInsightLoader location={location} />"));
  assert.ok(app.indexOf("<LinkedInInsightLoader location={location} />") < app.indexOf("<IDPixelLoader location={location} />"));
  assert.doesNotMatch(read("src/components/LinkedInInsightLoader.tsx"), /isPublicOptionalTrackingRoute/);
  assert.match(read("src/components/TrackingConsentNotice.tsx"), /Clarity does not record entered values or form interactions/);
  assert.match(read("src/components/TrackingConsentNotice.tsx"), /role="alert"/);
  assert.match(read("src/pages/PrivacyPage.tsx"), /LinkedIn Insight Tag/);
  assert.match(read("src/pages/PrivacyPage.tsx"), /10\/22\/2026/);
  const prerender = read("scripts/prerender-public-routes.mjs");
  assert.match(prerender, /section\("LinkedIn Insight Tag and marketing attribution"/);
  assert.match(prerender, /updatedAt: "October 22, 2026"/);
  const context = read("src/context/TrackingConsentContext.tsx");
  assert.ok(context.indexOf("prepareLinkedInChoice(Boolean(nextPreferences.marketingAttribution), persisted)") < context.indexOf("changeReplayChoice(Boolean(nextPreferences.sessionReplay), persisted)"));
  assert.match(context, /changeLinkedInChoice\(Boolean\(nextPreferences\.marketingAttribution\), persisted, replayReload\)/);
  assert.match(context, /needsLinkedInConsentRefresh\(\)/);
  assert.match(read(".env.example"), /VITE_LINKEDIN_PARTNER_ID=/);
});

test("exact marketing allowlist permits public pages and plain anchors on both production hosts", () => {
  for (const host of ["alphasourceai.com", "www.alphasourceai.com"]) for (const path of [
    "", "about/", "alphascreen/", "alphascreen/how-it-works/", "alphascreen/security/",
    "alphascreen/candidate-experience/", "alphascreen/for-dental-groups/", "faq/", "privacy/", "terms/", "about/#contact",
  ]) {
    const h = harness({ url: "https://" + host + "/" + path }); h.tag.start();
    assert.equal(h.scripts.length, 1, host + "/" + path);
  }
});
test("every excluded route stays excluded, even a direct start call or a misleading sync", () => {
  for (const path of excluded) {
    const h = harness({ url: root + path }); h.tag.start(); h.tag.sync(allow);
    assert.equal(h.scripts.length, 0, path); assert.equal(linkedInPage(root + path), null);
  }
});
test("query parameters and parameter-bearing or encoded fragments never load", () => {
  for (const suffix of ["?email=synthetic%40example.invalid", "?token=SYNTHETIC", "?utm_source=linkedin", "?", "#access_token=synthetic", "#email=synthetic%40example.invalid", "#contact?token=synthetic", "#access%5Ftoken%3Dsynthetic", "#/dashboard", "#contact&state=synthetic"]) {
    const h = harness({ url: root + suffix }); h.tag.start(); h.tag.sync(allow);
    assert.equal(h.scripts.length, 0, suffix);
  }
});
test("QA, DEV, previews, lookalike hosts, non-HTTPS, credentials, ports and nonproduction builds never load", () => {
  for (const url of ["https://interview-agent-frontend-qa.onrender.com/", "https://alphasourceai-com.onrender.com/", "https://preview.alphasourceai.com/", "https://www.alphasourceai.com.evil.invalid/", "https://evil.invalid/", "http://www.alphasourceai.com/", "https://www.alphasourceai.com:8443/", "https://user:secret@www.alphasourceai.com/"]) {
    const h = harness({ url }); const original = h.win.history.pushState; h.tag.start();
    assert.equal(h.scripts.length, 0, url); assert.equal(h.win.history.pushState, original);
  }
  const disabled = harness({ enabled: false }); disabled.tag.start(); assert.equal(disabled.scripts.length, 0);
});
test("normal origin-only ad referrers work, same-site private or external identifying referrers do not", () => {
  for (const referrer of ["https://www.linkedin.com/", "https://www.google.com/", root, root + "about/", "https://alphasourceai.com/faq/"]) {
    const h = harness({ referrer }); h.tag.start(); assert.equal(h.scripts.length, 1, referrer);
  }
  for (const referrer of [root + "support/", root + "dashboard/", root + "?token=synthetic", "https://alphasourceai.com/dashboard/", "https://external.invalid/?email=synthetic", "https://external.invalid/private-identifier", "https://external.invalid:8443/", "https://user:secret@external.invalid/"]) {
    const h = harness({ referrer }); h.tag.start(); assert.equal(h.scripts.length, 0, referrer);
  }
  const gpc = harness({ gpc: true }); gpc.tag.start(); assert.equal(gpc.scripts.length, 0);
});
test("pushState and replaceState retire the vendor BEFORE every excluded destination can render", () => {
  for (const method of ["pushState", "replaceState"]) for (const path of [...excluded, "?token=synthetic", "#access_token=synthetic"]) {
    const h = harness(); h.tag.start();
    const queued = h.win.lintrk; queued("track", {}); assert.equal(queued.q.length, 1);
    h.win.history[method](null, "", root + path);
    assert.equal(queued.q.length, 0); stopped(h);
    assert.equal(h.historyWrites.length, 0, method + ":" + path);
    assert.deepEqual(h.navigations, [root + path]); assert.equal(h.win.location.href, root);
    assert.equal(h.session.get(blockKey), undefined, "navigation is not withdrawal");
  }
});
test("public navigation and anchor interactions remain client-side; cross-origin history still throws", () => {
  const h = harness(); h.tag.start(); h.win.history.pushState(null, "", "/about/#contact");
  assert.equal(h.historyWrites.length, 1); assert.equal(h.historyWrites[0].scriptPresent, true); assert.equal(h.navigations.length, 0);
  assert.throws(() => h.win.history.pushState(null, "", "https://external.invalid/"), { name: "SecurityError" });
  assert.equal(h.navigations.length, 0);
  const anchor = harness(); anchor.tag.start(); assert.equal(anchor.interact("#anchor").defaultPrevented, false); assert.equal(anchor.reloads(), 0);
});
test("unsafe-current restoration cannot reuse a contaminated document", () => {
  const h = harness(); h.tag.start(); h.win.location.href = root + "?token=synthetic";
  h.win.history.replaceState(null, "", "/about/");
  stopped(h); assert.equal(h.historyWrites.length, 0); assert.deepEqual(h.navigations, [root + "about/"]);
});
test("authentication capture works before the inline panel, independently of other providers", () => {
  for (const kind of ["client", "admin"]) for (const type of ["click", "keydown"]) {
    const h = harness(); h.tag.start(); let rendered = false;
    h.doc.querySelector("[data-replay-auth=" + kind + "]").addEventListener(type, () => { rendered = true; });
    const event = h.interact("[data-replay-auth=" + kind + "]", type);
    assert.equal(event.defaultPrevented, true); assert.equal(rendered, false); stopped(h);
    assert.deepEqual(h.navigations, [root + "support/?signin=" + kind]); assert.equal(h.session.get(blockKey), undefined);
    assert.equal(h.values.get(key), JSON.stringify(savedConsent));
  }
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    const modified = harness(); modified.tag.start(); let rendered = false;
    modified.doc.querySelector("[data-replay-auth=client]").addEventListener("click", () => { rendered = true; });
    modified.interact("[data-replay-auth=client]", "click", { [modifier]: true });
    assert.equal(rendered, false); stopped(modified);
    assert.deepEqual(modified.navigations, [root + "support/?signin=client"]);
    const link = harness(); link.tag.start();
    assert.equal(link.interact("#private", "click", { [modifier]: true }).defaultPrevented, false);
    assert.equal(link.navigations.length, 0);
  }
});
test("excluded anchor clicks are fenced before React handlers; new-tab and form behavior stays unchanged", () => {
  const h = harness(); h.tag.start(); let rendered = false;
  h.doc.querySelector("#private").addEventListener("click", () => { rendered = true; });
  assert.equal(h.interact("#private").defaultPrevented, true); assert.equal(rendered, false); stopped(h);
  const fresh = harness(); fresh.tag.start(); fresh.doc.querySelector("#private").target = "_blank";
  assert.equal(fresh.interact("#private").defaultPrevented, false); assert.equal(fresh.navigations.length, 0);
  assert.equal(fresh.interact("#name").defaultPrevented, false); assert.equal(fresh.doc.querySelector("#name").value, "SYNTHETIC"); assert.equal(fresh.reloads(), 0);
});
test("popstate, unsafe hash and BFCache retire injected documents but never hijack clean ones", () => {
  for (const type of ["popstate", "hashchange", "pageshow"]) {
    const h = harness(); h.tag.start();
    let privateRendered = false; h.dom.window.addEventListener(type, () => { privateRendered = true; });
    if (type !== "pageshow") h.win.location.href = root + "#access_token=synthetic";
    const event = type === "pageshow" ? new h.dom.window.PageTransitionEvent(type, { persisted: true }) : new h.dom.window.Event(type);
    h.fire(type, event); stopped(h); assert.equal(h.reloads(), 1);
    if (type !== "pageshow") assert.equal(privateRendered, false);
    assert.equal(h.session.get(blockKey), undefined);
  }
  const clean = harness({ choice: null }); let delivered = false;
  clean.dom.window.addEventListener("popstate", () => { delivered = true; }); clean.win.location.href = root + "dashboard/";
  clean.fire("popstate"); assert.equal(delivered, true); assert.equal(clean.reloads(), 0);
});
test("denial markers exist before another provider can reload", () => {
  const h = harness(); h.tag.start(); h.readonly();
  h.tag.prepareChoice(false, false); stopped(h);
  assert.equal(h.session.get(blockKey), "save-error"); assert.equal(h.reloads(), 0);
  assert.equal(h.tag.changeChoice(false, false, true), true); assert.equal(h.reloads(), 0, "other provider owns the one scheduled reload");
  assert.equal(h.tag.withdrawalState().saveFailed, true);
});
test("failed withdrawal stops entrypoints, clears cookies, hard unloads and cannot reactivate the old stored grant", () => {
  const h = harness(); h.doc.cookie = "li_fat_id=SYNTHETIC;Path=/;Secure"; h.doc.cookie = "_ga=KEEP;Path=/;Secure"; h.doc.cookie = "_clck=KEEP;Path=/;Secure"; h.doc.cookie = "auth=KEEP;Path=/;Secure";
  h.tag.start(); h.win.lintrk("track", {}); h.readonly();
  assert.equal(h.tag.changeChoice(false, false), true); stopped(h); assert.equal(h.reloads(), 1);
  assert.equal(h.values.get(key), JSON.stringify(savedConsent), "old persisted grant really remains");
  assert.equal(h.tag.withdrawalState().saveFailed, true); assert.doesNotMatch(h.doc.cookie, /li_fat_id=/);
  for (const name of ["_ga", "_clck", "auth"]) assert.match(h.doc.cookie, new RegExp(name + "=KEEP"));
  h.tag.sync(allow); h.tag.start(); assert.equal(h.scripts.length, 1);
  const fresh = harness({ values: h.values, session: h.session, jar: h.jar });
  fresh.tag.start(); assert.equal(fresh.scripts.length, 0); assert.equal(fresh.tag.withdrawalState().saveFailed, true);
});
test("script removal does not pretend to stop vendor closures: a real document boundary is requested", () => {
  const h = harness(); h.tag.start(); let ticks = 0;
  h.dom.window.addEventListener("synthetic-vendor-tick", () => { ticks++; });
  h.readonly(); h.tag.changeChoice(false, false); h.fire("synthetic-vendor-tick");
  assert.equal(ticks, 1, "inert globals alone cannot cancel a downloaded closure");
  assert.equal(h.reloads(), 1, "full unload is required, not merely node removal");
  h.dom.window.close(); const fresh = harness({ session: h.session, values: h.values, jar: h.jar });
  fresh.fire("synthetic-vendor-tick"); fresh.tag.start(); assert.equal(fresh.scripts.length, 0); assert.equal(ticks, 1);
});
test("session-only and cookie-only withdrawal fallback is verified, with no unnecessary query", () => {
  for (const options of [{ blockedSession: true }, { blockedCookies: true }]) {
    const h = harness(options); h.tag.start(); h.readonly(); h.tag.changeChoice(false, false);
    assert.equal(h.reloads(), 1); assert.equal(h.replacements.length, 0);
    const fresh = harness({ ...options, session: h.session, values: h.values, jar: h.jar });
    fresh.tag.start(); assert.equal(fresh.scripts.length, 0); assert.equal(fresh.tag.withdrawalState().saveFailed, true);
  }
});
test("when both denial stores fail, opaque query fallback keeps stale grants off across a clean reload", () => {
  const h = harness(); h.tag.start(); h.blockEverything(); h.tag.changeChoice(false, false);
  stopped(h); assert.equal(h.reloads(), 0); assert.equal(h.replacements.length, 1);
  const url = new URL(h.replacements[0]); assert.equal(url.searchParams.get("__as_linkedin_withdrawn"), "save-error");
  assert.equal(url.searchParams.size, 1);
  const fresh = harness({ url: url.href, values: h.values, blockedSession: true, blockedCookies: true });
  fresh.tag.start(); assert.equal(fresh.scripts.length, 0); assert.equal(fresh.tag.withdrawalState().saveFailed, true);
  assert.equal(fresh.historyWrites.length, 0); assert.equal(fresh.replacements.length, 0, "never silently strip fallback");
});
test("session-only failed withdrawal survives modified and noopener links into empty-session documents", () => {
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey", "blank", "auxclick", "contextmenu"]) {
    const h = harness({ blockedCookies: true }); h.tag.start(); h.readonly(); h.tag.changeChoice(false, false);
    assert.equal(h.session.get(blockKey), "save-error");
    const sameTab = harness({ session: h.session, values: h.values, blockedCookies: true });
    const anchor = sameTab.doc.querySelector("#private"); anchor.href = root + "about/";
    if (modifier === "blank") { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    const type = ["auxclick", "contextmenu"].includes(modifier) ? modifier : "click";
    assert.equal(sameTab.interact("#private", type, type !== "click" ? { button: 1 } : modifier === "blank" ? {} : { [modifier]: true }).defaultPrevented, false);
    assert.equal(new URL(anchor.href).searchParams.get("__as_linkedin_withdrawn"), "save-error");
    const newTab = harness({ url: anchor.href, values: h.values, session: new Map(), blockedCookies: true });
    newTab.tag.start(); assert.equal(newTab.scripts.length, 0); assert.equal(newTab.tag.withdrawalState().saveFailed, true);
  }
});
test("withdrawal reload gap still carries new-tab denial and prevents inline authentication", () => {
  const h = harness({ blockedCookies: true }); h.tag.start(); h.readonly(); h.tag.changeChoice(false, false);
  const anchor = h.doc.querySelector("#private"); anchor.href = root + "about/"; anchor.target = "_blank"; anchor.rel = "noopener";
  assert.equal(h.interact("#private", "click", { metaKey: true }).defaultPrevented, false);
  const newTab = harness({ url: anchor.href, values: h.values, session: new Map(), blockedCookies: true });
  newTab.tag.start(); assert.equal(newTab.scripts.length, 0); assert.equal(newTab.tag.withdrawalState().saveFailed, true);
  let rendered = false;
  h.doc.querySelector("[data-replay-auth=client]").addEventListener("click", () => { rendered = true; });
  assert.equal(h.interact("[data-replay-auth=client]").defaultPrevented, true);
  assert.equal(rendered, false); assert.equal(h.navigations.length, 0); assert.equal(h.reloads(), 1);
});
test("failed-save fallback survives ordinary links, modified links and SPA navigation across documents", () => {
  const values = new Map([[key, JSON.stringify(savedConsent)]]);
  let url = root + "?__as_linkedin_withdrawn=save-error";
  for (const path of ["about/", "faq/", "alphascreen/"]) {
    const h = harness({ url, values, readonly: true, blockedSession: true, blockedCookies: true });
    h.tag.start(); assert.equal(h.scripts.length, 0); assert.equal(h.tag.withdrawalState().saveFailed, true);
    h.doc.querySelector("#private").href = root + path;
    assert.equal(h.interact("#private", "click", { ctrlKey: true }).defaultPrevented, false);
    url = h.doc.querySelector("#private").href;
    assert.equal(new URL(url).searchParams.get("__as_linkedin_withdrawn"), "save-error");
    h.win.history.pushState(null, "", "/about/");
    assert.equal(new URL(h.historyWrites[0].destination).searchParams.get("__as_linkedin_withdrawn"), "save-error");
    h.doc.querySelector("#private").href = "https://external.invalid/";
    h.interact("#private"); assert.equal(h.doc.querySelector("#private").href, "https://external.invalid/");
  }
  const restored = harness({ url, values });
  assert.equal(restored.session.get(blockKey), "save-error", "available storage re-establishes denial before links drop the marker");
  const fresh = harness({ url: root + "faq/", values, session: restored.session, jar: restored.jar });
  fresh.tag.start(); assert.equal(fresh.scripts.length, 0); assert.equal(fresh.tag.withdrawalState().saveFailed, true);
});
test("an initially sensitive or pre-injection sensitive document never becomes eligible by stripping its URL", () => {
  for (const initial of [root + "?token=synthetic", root + "support/?signin=client", root + "dashboard/"]) {
    const h = harness({ url: initial }); h.win.history.replaceState(null, "", "/about/"); h.tag.start();
    assert.equal(h.scripts.length, 0); assert.equal(h.navigations.length, 0);
  }
  const h = harness(); h.win.history.pushState(null, "", "/dashboard/"); h.win.history.replaceState(null, "", "/about/"); h.tag.start();
  assert.equal(h.scripts.length, 0);
});
test("a vendor-owned frozen queue cannot prevent withdrawal and the required unload", () => {
  const h = harness(); h.tag.start(); Object.freeze(h.win.lintrk.q); h.readonly();
  assert.doesNotThrow(() => h.tag.changeChoice(false, false)); stopped(h); assert.equal(h.reloads(), 1);
});
test("failed initial opt-in stays closed without a withdrawal marker or reload", () => {
  const h = harness({ choice: { ...savedConsent, marketingAttribution: false } }); h.readonly();
  h.tag.prepareChoice(true, false); assert.equal(h.tag.changeChoice(true, false), false);
  h.tag.sync(allow); h.tag.start(); assert.equal(h.scripts.length, 0); assert.equal(h.reloads(), 0);
  assert.equal(h.session.get(blockKey), undefined); assert.equal(h.tag.withdrawalState().withdrawn, false);
});
test("successful saved withdrawal reloads once; successful regrant starts only in a fresh document", () => {
  const h = harness(); h.tag.start(); h.values.set(key, JSON.stringify({ ...savedConsent, marketingAttribution: false }));
  h.tag.changeChoice(false, true); stopped(h); assert.equal(h.reloads(), 1);
  const next = harness({ values: h.values, session: h.session, jar: h.jar }); next.tag.start(); assert.equal(next.scripts.length, 0);
  next.values.set(key, JSON.stringify(savedConsent)); next.tag.prepareChoice(true, true); next.tag.changeChoice(true, true);
  next.tag.start(); assert.equal(next.scripts.length, 0); assert.equal(next.reloads(), 1);
  const fresh = harness({ values: next.values, session: next.session, jar: next.jar }); fresh.tag.start(); assert.equal(fresh.scripts.length, 1);
});
test("only a successfully persisted regrant may remove the fallback marker", () => {
  const h = harness({ url: root + "?__as_linkedin_withdrawn=save-error" });
  h.tag.changeChoice(true, false); assert.equal(h.replacements.length, 0); h.tag.start(); assert.equal(h.scripts.length, 0);
  h.values.set(key, JSON.stringify(savedConsent)); h.tag.prepareChoice(true, true); h.tag.changeChoice(true, true);
  assert.deepEqual(h.replacements, [root]); h.tag.start(); assert.equal(h.scripts.length, 0);
});
test("cookie expiry includes parent-domain and reachable path cookies, never other providers", () => {
  const h = harness({ url: root + "alphascreen/how-it-works/" });
  h.doc.cookie = "li_giant=SYNTHETIC;Domain=alphasourceai.com;Path=/alphascreen;Secure";
  h.doc.cookie = "li_fat_id=SYNTHETIC;Path=/alphascreen/how-it-works/;Secure";
  h.tag.start(); h.tag.changeChoice(false, true);
  assert.doesNotMatch(h.doc.cookie, /li_giant=|li_fat_id=/);
  assert.ok(h.cookieWrites.some(v => v.startsWith("li_fat_id=") && v.includes("Domain=alphasourceai.com")));
  assert.ok(h.cookieWrites.every(v => !/^(_ga|_clck|_clsk|auth)=/.test(v)));
});
test("failed-save React consent state shows an error and preserves provider sequencing", async () => {
  const require = createRequire(import.meta.url);
  const React = require("react"), { createRoot } = require("react-dom/client");
  const calls = [], initial = { withdrawn: false, saveFailed: false };
  const code = (await build({
    entryPoints: [new URL("../src/context/TrackingConsentContext.tsx", import.meta.url).pathname],
    bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic", external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "provider-spies", setup(build) {
      build.onResolve({ filter: /^@\/lib\/(ga4|sessionReplay|linkedinInsight)$/ }, args => ({ path: args.path, namespace: "test-provider" }));
      build.onLoad({ filter: /.*/, namespace: "test-provider" }, args => ({ contents:
        args.path.endsWith("linkedinInsight") ?
          'export const LINKEDIN_CONSENT_REVISION="linkedin-20261022";export const needsLinkedInConsentRefresh=()=>false;export const linkedInWithdrawalState=()=>globalThis.__liTestInitial;export const prepareLinkedInChoice=(...a)=>globalThis.__liTestCalls.push(["prepare",...a]);export const changeLinkedInChoice=(...a)=>globalThis.__liTestCalls.push(["linkedin",...a]);' :
        args.path.endsWith("ga4") ?
          'export const GA4_CONSENT_REVISION="ga4-20261021";export const needsGa4ConsentRefresh=()=>false;export const revokeGa4=(...a)=>globalThis.__liTestCalls.push(["ga4",...a]);' :
          'export const REPLAY_REVISION="clarity-20261021";export const needsReplayConsentRefresh=()=>false;export const holdSessionReplay=()=>{};export const changeReplayChoice=(...a)=>{globalThis.__liTestCalls.push(["replay",...a]);return false;};',
        loader: "js" }));
    }}],
  })).outputFiles[0].text;
  const dom = new JSDOM("<!doctype html><div id='test-root'></div>", { url: root, pretendToBeVisual: true });
  const saved = Object.getOwnPropertyDescriptors(globalThis);
  const testGlobals = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT", "__liTestInitial", "__liTestCalls"];
  let mounted;
  try {
    globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.__liTestInitial = initial; globalThis.__liTestCalls = calls;
    const module = { exports: {} }; new Function("require", "module", "exports", code)(require, module, module.exports);
    const { TrackingConsentProvider, useTrackingConsent } = module.exports;
    let consent;
    function Readback() { consent = useTrackingConsent(); return React.createElement("div", { role: consent.preferencesSaveError ? "alert" : undefined }, consent.preferencesSaveError ?? "saved"); }
    mounted = createRoot(dom.window.document.getElementById("test-root"));
    await React.act(async () => mounted.render(React.createElement(TrackingConsentProvider, null, React.createElement(Readback))));
    const storage = dom.window.localStorage; const nativeSet = storage.setItem.bind(storage);
    // jsdom Storage proxies do not allow overriding methods on the instance.
    const prototype = Object.getPrototypeOf(storage), descriptor = Object.getOwnPropertyDescriptor(prototype, "setItem");
    Object.defineProperty(prototype, "setItem", { value: () => { throw Error("blocked"); }, configurable: true });
    try {
      await React.act(async () => consent.savePreferences({ analytics: false, sessionReplay: false, marketingAttribution: false }));
      assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /couldn't save/);
      assert.equal(consent.preferencesOpen, true); assert.equal(consent.hasSavedPreferences, false); assert.equal(consent.marketingAttributionEnabled, false);
      assert.deepEqual(calls.map(v => v[0]), ["prepare", "replay", "linkedin", "ga4"]);
      assert.deepEqual(calls[0], ["prepare", false, false]);
    } finally { Object.defineProperty(prototype, "setItem", descriptor); }
    nativeSet(key, JSON.stringify(savedConsent));
    calls.length = 0;
    await React.act(async () => consent.savePreferences({ analytics: false, sessionReplay: false, marketingAttribution: true }));
    assert.equal(consent.preferencesSaveError, null); assert.equal(consent.preferencesOpen, false); assert.equal(consent.marketingAttributionEnabled, true);
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    dom.window.close();
    for (const name of testGlobals) { if (saved[name]) Object.defineProperty(globalThis, name, saved[name]); else delete globalThis[name]; }
  }
});
