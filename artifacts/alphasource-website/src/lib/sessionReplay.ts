import { ga4Page } from "./ga4";

export const REPLAY_REVISION = "clarity-20261021";
export const REPLAY_PROJECT = "z1ekxf8e7y";
export const REPLAY_SDK_VERSION = "0.8.72";
const ENDPOINT = "https://g.clarity.ms/collect";
const PREFERENCES = "alphasource:tracking-preferences:v2";
const SENSITIVE = 'form,input,textarea,select,[contenteditable],[role="dialog"]';
const DROPPED = ["form", "input", "textarea", "select", "[contenteditable]", '[role="dialog"]', "iframe", "script", "noscript"];
// Native 0.8.72 event numbers; input, selection, clipboard, custom, extraction,
// errors, variables and unknown event kinds are never forwarded.
const EVENTS = new Set([0, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 25, 26, 28, 29, 35, 36, 47, 48, 53]);
type Sdk = Pick<(typeof import("clarity-js"))["clarity"], "start" | "stop">;
type ReplayWindow = Window & { clarity?: unknown };
type PublicPage = NonNullable<ReturnType<typeof ga4Page>>;

export function replayPage(href: string): PublicPage | null {
  try {
    const url = new URL(href);
    return url.hash ? null : ga4Page(url);
  } catch { return null; }
}

function safeReferrer(referrer: string) {
  if (!referrer) return true;
  const page = replayPage(referrer);
  return Boolean(page && referrer === page.location);
}

/** Keep the native replay encoding; narrow its metadata and analysis events. */
export function replayPayload(raw: string, page: PublicPage): string | null {
  try {
    if (raw.length > 2_000_000) return null;
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.e) || payload.e.length !== 12 || payload.e[0] !== REPLAY_SDK_VERSION || payload.e[4] !== REPLAY_PROJECT ||
      typeof payload.e[11] !== "string" || replayPage(payload.e[11])?.location !== page.location || !Array.isArray(payload.a) ||
      (payload.p !== undefined && !Array.isArray(payload.p))) return null;
    payload.e[11] = page.location;
    payload.a = payload.a.flatMap((event: unknown) => {
      if (!Array.isArray(event) || typeof event[0] !== "number" || !Number.isFinite(event[0])) return [];
      if (event[1] !== 1) return EVENTS.has(event[1]) ? [event] : [];
      const dimensions: unknown[] = event.slice(0, 2);
      for (let i = 2; i + 1 < event.length; i += 2) {
        const key = event[i], values = event[i + 1];
        if (!Array.isArray(values)) continue;
        if (key === 1) dimensions.push(1, [page.location]);
        else if (key === 3) dimensions.push(3, [page.title]);
        else if (key === 0 && values.every(v => typeof v === "string" && v.length <= 512)) dimensions.push(key, values);
        else if ([9, 16].includes(key) && values.every(v => typeof v === "string" && /^[a-z-]{1,40}$/i.test(v))) dimensions.push(key, values);
        else if (key === 17 && values.every(v => ["ltr", "rtl", "auto", ""].includes(v))) dimensions.push(key, values);
        else if ([26, 29, 36, 38].includes(key) && values.every(v => typeof v === "string" && /^(?:[0-9.]{1,12}|true|false)$/.test(v))) dimensions.push(key, values);
        // No raw referrer, tab id, schema text, author, location or high-entropy hints.
      }
      return dimensions.length > 2 ? [dimensions] : [];
    });
    return JSON.stringify({ e: payload.e, a: payload.a, ...(payload.p ? { p: payload.p } : {}) });
  } catch { return null; }
}

export function createSessionReplay(win: ReplayWindow, enabled: boolean, load: () => Promise<Sdk> = () => import("clarity-js").then(module => module.clarity)) {
  let requested = false, held = false, live = false, generation = 0;
  let sdk: Sdk | null = null;
  let guardInstalled = false;
  const inFlight = new Set<AbortController>();
  const page = () => replayPage(win.location.href);
  function consent() {
    try {
      const raw = win.localStorage.getItem(PREFERENCES);
      const saved = JSON.parse(raw || "null");
      if (saved?.sessionReplay !== true || saved.clarityRevision !== REPLAY_REVISION || typeof saved.updatedAt !== "string" || !Number.isFinite(Date.parse(saved.updatedAt))) return false;
      win.localStorage.setItem(PREFERENCES, raw!);
      return true;
    } catch { return false; }
  }
  const allowed = () => enabled && !held && Boolean(page()) && safeReferrer(win.document.referrer) &&
    !(win.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl && consent();
  function clearCookies() {
    // Only Microsoft replay identifiers, never application/auth/Google cookies.
    for (const key of ["_clck", "_clsk"]) {
      for (const domain of ["", ";Domain=alphasourceai.com", ";Domain=www.alphasourceai.com"]) {
        win.document.cookie = `${key}=;Max-Age=0;Path=/;Secure;SameSite=Lax${domain}`;
      }
    }
    try { win.sessionStorage.removeItem("_cltk"); } catch { /* Storage may be blocked. */ }
  }
  function hold() {
    held = true;
    live = false; // MUST precede the native stop() flush or any delayed restart.
    generation++;
    inFlight.forEach(controller => controller.abort());
    inFlight.clear();
    try { sdk?.stop(); } catch { /* A provider failure cannot block the site. */ }
  }
  function upload(raw: string, attempt: number) {
    if (!live || generation !== attempt) return;
    if (!allowed()) { hold(); return; }
    const current = page();
    const body = current && replayPayload(raw, current);
    if (!body) { hold(); return; }
    const controller = new AbortController();
    inFlight.add(controller);
    try {
      void win.fetch(ENDPOINT, { method: "POST", body, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal })
        .then(response => { if (!response.ok) hold(); })
        .catch(() => { hold(); })
        .finally(() => inFlight.delete(controller));
    } catch { inFlight.delete(controller); hold(); }
  }
  function installGuard() {
    if (guardInstalled) return;
    guardInstalled = true;
    for (const method of ["pushState", "replaceState"] as const) {
      const previous = win.history[method].bind(win.history);
      win.history[method] = function (data: unknown, unused: string, url?: string | URL | null) {
        const destination = new URL(url == null ? win.location.href : String(url), win.location.href);
        if (destination.origin !== new URL(win.location.href).origin) { previous(data, unused, url); return; }
        if (requested && (!page() || !replayPage(destination.href))) { hold(); win.location.assign(destination.href); return; }
        previous(data, unused, url);
      };
    }
    const interaction = (event: Event) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const auth = target.closest("[data-replay-auth]");
      if (auth && (event.type === "click" || (event.type === "keydown" && ["Enter", " "].includes((event as KeyboardEvent).key)))) {
        const kind = auth.getAttribute("data-replay-auth");
        if (kind === "client" || kind === "admin") {
          hold(); event.preventDefault(); event.stopImmediatePropagation();
          win.location.assign(`/support/?signin=${kind}`);
          return;
        }
      }
      if (target.closest(SENSITIVE)) hold();
    };
    for (const event of ["click", "keydown", "pointerdown", "focusin", "beforeinput", "paste", "submit"]) win.document.addEventListener(event, interaction, true);
    win.addEventListener("popstate", event => {
      if (!page()) { hold(); event.stopImmediatePropagation(); win.location.reload(); }
    }, true);
    win.addEventListener("hashchange", event => {
      const changed = (event as HashChangeEvent).newURL || win.location.href;
      if (!replayPage(changed)) { hold(); win.location.reload(); }
    }, true);
    win.addEventListener("pagehide", () => { hold(); if (!consent()) clearCookies(); });
    win.addEventListener("pageshow", event => { if ((event as PageTransitionEvent).persisted) { hold(); win.location.reload(); } });
    win.addEventListener("storage", event => {
      if ((event as StorageEvent).key === PREFERENCES && !consent()) { hold(); clearCookies(); win.location.reload(); }
    });
  }
  async function start() {
    if (requested || !allowed()) return;
    if (win.clarity || win.document.querySelector('script[src*="clarity.ms"]')) return;
    requested = true;
    installGuard();
    const attempt = ++generation;
    try {
      const loaded = await load();
      if (generation !== attempt || !allowed() || win.clarity || win.document.querySelector('script[src*="clarity.ms"]')) return;
      if (win.document.activeElement?.closest(SENSITIVE)) { hold(); return; }
      clearCookies();
      win.document.body.setAttribute("data-clarity-mask", "true");
      sdk = loaded;
      live = true;
      const configuration = { projectId: REPLAY_PROJECT, upload: (raw: string) => upload(raw, attempt), content: false, mask: ["body"], drop: DROPPED,
        track: false, report: null, modules: [], cookies: [], fraud: false, conversions: false, diagnostics: false, action: null, fallback: null };
      // The pinned vendor's native defaults use null for these disabled transports,
      // although its published declaration omits null. Keep the audited runtime values.
      loaded.start(configuration as unknown as Parameters<Sdk["start"]>[0]);
    } catch { hold(); }
  }
  function changeChoice(next: boolean, persisted: boolean) {
    if (requested) { hold(); if (!next) clearCookies(); }
    // First opt-in also enters a clean document, never starts beneath a closing dialog.
    const reload = Boolean(persisted && (requested || (next && enabled && page())));
    if (reload) win.location.reload();
    return reload;
  }
  function needsConsentRefresh() {
    if (!enabled || !page()) return false;
    try {
      const saved = JSON.parse(win.localStorage.getItem(PREFERENCES) || "null");
      return Boolean(saved && (saved.analytics || saved.marketingAttribution) && saved.clarityRevision !== REPLAY_REVISION);
    } catch { return false; }
  }
  return { start, hold, changeChoice, needsConsentRefresh };
}

const runtime = typeof window === "undefined" ? null : createSessionReplay(window,
  import.meta.env.PROD && import.meta.env.VITE_PRODUCTION_CLARITY_ENABLED === "true");
export const startSessionReplay = () => runtime?.start();
export const holdSessionReplay = () => runtime?.hold();
export const changeReplayChoice = (next: boolean, persisted: boolean) => runtime?.changeChoice(next, persisted) ?? false;
export const needsReplayConsentRefresh = () => runtime?.needsConsentRefresh() ?? false;
