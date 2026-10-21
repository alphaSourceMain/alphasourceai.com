/** Production public-site measurement only. No auth, lead, billing or candidate data. */
export const GA4_MEASUREMENT_ID = "G-SR258DR5SR";
const PREFERENCES_KEY = "alphasource:tracking-preferences:v2";
const HOSTS = new Set(["www.alphasourceai.com", "alphasourceai.com"]);
const TITLES: Record<string, string> = {
  "/": "alphaSource AI", "/about": "About alphaSource AI", "/alphascreen": "alphaScreen",
  "/alphascreen/how-it-works": "How alphaScreen Works", "/alphascreen/security": "alphaScreen Security",
  "/alphascreen/candidate-experience": "alphaScreen Candidate Experience",
  "/alphascreen/for-dental-groups": "alphaScreen for Dental Groups", "/faq": "alphaScreen FAQ",
  "/privacy": "Privacy Policy", "/terms": "Terms of Service",
};
const FORM_IDS = new Set(["home-contact", "about-contact", "alphascreen-demo"]);
const LEAD_EVENTS = new Set(["lead_form_viewed", "lead_form_started", "lead_form_abandoned",
  "lead_form_submit_attempted", "lead_form_submit_failed", "lead_form_submit_succeeded"]);
type GaWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  "ga-disable-G-SR258DR5SR"?: boolean;
};

export function ga4Page(url: URL): { path: string; title: string; location: string } | null {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  // No token, sign-in, campaign or arbitrary query values enter this initial provider integration.
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname) || url.port || url.username || url.password || url.search || (url.hash && !/^#[a-z][a-z0-9-]*$/i.test(url.hash)) || !TITLES[path]) return null;
  return { path, title: TITLES[path], location: `https://www.alphasourceai.com${path === "/" ? "/" : `${path}/`}` };
}

export function ga4Event(name: string, properties: Record<string, unknown>): { name: string; properties: Record<string, string> } | null {
  if (name === "cta_clicked") {
    // Deliberately omit arbitrary link labels, targets, placement strings and DOM text.
    return { name: "cta_clicked", properties: {} };
  }
  if (!LEAD_EVENTS.has(name) || typeof properties.form_id !== "string" || !FORM_IDS.has(properties.form_id)) return null;
  return { name, properties: { form_id: properties.form_id } };
}

export function createGa4(win: GaWindow, enabled: boolean) {
  let requested = false;
  let ready = false;
  let held = false;
  let generation = 0;
  let lastPage = "";
  let script: HTMLScriptElement | null = null;
  let guardInstalled = false;
  const disableKey = `ga-disable-${GA4_MEASUREMENT_ID}` as const;
  const page = () => { try { return ga4Page(new URL(win.location.href)); } catch { return null; } };
  function consent() {
    try {
      const raw = win.localStorage.getItem(PREFERENCES_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.analytics !== true || typeof saved.updatedAt !== "string" || !Number.isFinite(Date.parse(saved.updatedAt))) return false;
      // Fail closed if preferences cannot be persisted (including read-only/blocked storage).
      win.localStorage.setItem(PREFERENCES_KEY, raw!);
      return true;
    } catch { return false; }
  }
  const allowed = () => enabled && !held && Boolean(page()) && consent();
  const command = (...args: unknown[]) => {
    // gtag's queue requires an arguments object, not an array.
    (function (...values: unknown[]) { void values; win.dataLayer?.push(arguments); }).apply(null, args);
  };
  function hold() {
    held = true;
    if (!requested) return false;
    ready = false;
    generation += 1;
    win[disableKey] = true;
    if (script) { script.onload = null; script.onerror = null; script.remove(); }
    if (win.dataLayer) win.dataLayer.length = 0;
    return true;
  }
  function installGuard() {
    if (guardInstalled || !enabled) return;
    guardInstalled = true;
    // Wouter navigation is intercepted BEFORE its history write / protected React render.
    for (const method of ["pushState", "replaceState"] as const) {
      const previous = win.history[method].bind(win.history);
      win.history[method] = function (data: unknown, unused: string, url?: string | URL | null) {
        const destination = new URL(url == null ? win.location.href : String(url), win.location.href);
        // Preserve the browser's same-origin history restriction; never turn a rejected
        // cross-origin pushState into an external redirect.
        if (destination.origin !== new URL(win.location.href).origin) {
          previous(data, unused, url);
          return;
        }
        if (requested && !ga4Page(destination)) {
          hold();
          win.location.assign(destination.href);
          return;
        }
        previous(data, unused, url);
      };
    }
    win.addEventListener("popstate", event => {
      if (requested && !page()) {
        hold();
        event.stopImmediatePropagation();
        win.location.reload();
      }
    }, true);
    win.addEventListener("pagehide", () => { hold(); });
    win.addEventListener("pageshow", event => {
      // A cached document must not resurrect a previously initialized provider after a private flow.
      if ((event as PageTransitionEvent).persisted && requested) { hold(); win.location.reload(); }
    });
    win.addEventListener("storage", event => {
      if ((event as StorageEvent).key === PREFERENCES_KEY && requested && !consent()) { hold(); win.location.reload(); }
    });
  }
  function pageView() {
    const current = page();
    if (!ready || !current || !allowed() || current.path === lastPage) return;
    lastPage = current.path;
    const values = { page_title: current.title, page_location: current.location, page_referrer: "" };
    command("set", values);
    command("event", "page_view", { ...values, send_to: GA4_MEASUREMENT_ID });
  }
  function start() {
    if (requested || !allowed()) return;
    // A foreign tag/queue is not reused or overwritten; it requires separate review.
    if (win.gtag || win.dataLayer || win.document.querySelector('script[src*="googletagmanager.com"]')) return;
    requested = true;
    win[disableKey] = true;
    win.dataLayer = [];
    const attempt = ++generation;
    script = win.document.createElement("script");
    script.id = "alphasource-production-ga4";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    script.onload = () => {
      if (attempt !== generation || !allowed()) { hold(); return; }
      command("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      command("js", new Date());
      const current = page()!;
      win[disableKey] = false;
      command("config", GA4_MEASUREMENT_ID, {
        send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
        page_location: current.location, page_title: current.title, page_referrer: "",
        cookie_domain: "alphasourceai.com", cookie_flags: "SameSite=Lax;Secure",
      });
      ready = true;
      pageView();
    };
    script.onerror = () => { hold(); };
    win.document.head.appendChild(script);
  }
  function track(name: string, properties: Record<string, unknown> = {}) {
    if (!allowed()) return;
    start();
    if (name === "page_viewed") { pageView(); return; }
    const event = ga4Event(name, properties);
    const current = page();
    if (ready && event && current) command("event", event.name, {
      ...event.properties, page_location: current.location, page_title: current.title, page_referrer: "", send_to: GA4_MEASUREMENT_ID,
    });
  }
  function revoke(persisted: boolean) {
    if (requested && hold() && persisted) win.location.reload();
  }
  return { track, hold, revoke, installGuard };
}

const runtime = typeof window === "undefined" ? null : createGa4(window as GaWindow,
  import.meta.env.PROD && import.meta.env.VITE_PRODUCTION_GA4_ENABLED === "true");
export const installGa4NavigationGuard = () => runtime?.installGuard();
export const trackGa4 = (name: string, properties: Record<string, unknown> = {}) => runtime?.track(name, properties);
export const holdGa4ForDocument = () => runtime?.hold();
export const revokeGa4 = (persisted: boolean) => runtime?.revoke(persisted);
