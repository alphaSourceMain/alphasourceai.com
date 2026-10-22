/** Bump when the disclosure changes; an old marketing choice is not a new opt-in. */
export const LINKEDIN_CONSENT_REVISION = "linkedin-20261022";
export const LINKEDIN_INSIGHT_SCRIPT_SRC = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
const SCRIPT_ID = "alphasource-linkedin-insight";
const PREFERENCES_KEY = "alphasource:tracking-preferences:v2";
const BLOCK_KEY = "alphasource:linkedin-blocked:v1";
const BLOCK_COOKIE = "alphasource_linkedin_blocked";
const BLOCK_PARAM = "__as_linkedin_withdrawn";
const HOSTS = new Set(["alphasourceai.com", "www.alphasourceai.com"]);
const MARKETING_ROUTES = new Set([
  "/", "/about", "/alphascreen", "/alphascreen/how-it-works", "/alphascreen/security",
  "/alphascreen/candidate-experience", "/alphascreen/for-dental-groups", "/faq", "/privacy", "/terms",
]);
// Only LinkedIn identifiers, never auth, GA4, Clarity or shared attribution cookies.
// Documented advertiser-domain cookies: https://www.linkedin.com/legal/l/cookie-table
const LINKEDIN_COOKIES = ["li_fat_id", "li_giant", "oribi_cookie_test", "oribili_user_guid", "ln_or"];
type Block = "withdrawn" | "save-error";
type Lintrk = ((action: string, data?: unknown) => void) & { q: unknown[][] };
export type LinkedInInsightWindow = Window & {
  lintrk?: Lintrk;
  _linkedin_partner_id?: string;
  _linkedin_data_partner_ids?: string[];
  __alphasourceLinkedInDisabled?: boolean;
};
export type LinkedInInsightSync = { marketingAttribution: boolean; linkedinRevision?: string };

function productionHost(url: URL) {
  return url.protocol === "https:" && HOSTS.has(url.hostname) && !url.port && !url.username && !url.password;
}

/** Full URL admission, not a query-stripping pathname test. Stricter than GA4. */
export function linkedInPage(href: string): string | null {
  try {
    const url = new URL(href);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
    if (!productionHost(url) || url.href.includes("?") || (url.hash && !/^#[a-z][a-z0-9-]*$/i.test(url.hash)) || !MARKETING_ROUTES.has(path)) return null;
    return "https://www.alphasourceai.com" + (path === "/" ? "/" : path + "/");
  } catch { return null; }
}

export function linkedInPartnerId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
export function readConfiguredLinkedInPartnerId(): string {
  return linkedInPartnerId(import.meta.env.VITE_LINKEDIN_PARTNER_ID);
}

export function createLinkedInInsight(win: LinkedInInsightWindow, partnerId: string, enabled = true) {
  const id = linkedInPartnerId(partnerId);
  const configured = () => { try { return Boolean(id && enabled && productionHost(new URL(win.location.href))); } catch { return false; } };
  const blockValue = (value: string | null): Block | null => value === "withdrawn" || value === "save-error" ? value : null;
  function readBlock(): Block | null {
    if (!configured()) return null;
    const values: (Block | null)[] = [];
    try { values.push(blockValue(new URL(win.location.href).searchParams.get(BLOCK_PARAM))); } catch { /* Cookie/storage fallback. */ }
    try { values.push(blockValue(win.sessionStorage.getItem(BLOCK_KEY))); } catch { /* Cookie/URL fallback. */ }
    try { values.push(blockValue(win.document.cookie.split("; ").find(value => value.startsWith(BLOCK_COOKIE + "="))?.split("=")[1] ?? null)); } catch { /* URL fallback. */ }
    return values.includes("save-error") ? "save-error" : values.includes("withdrawn") ? "withdrawn" : null;
  }
  let block = readBlock();
  let held = Boolean(block) || !linkedInPage(win.location.href), requested = false, contaminated = false, guardInstalled = false, unloading = false, resourceFailed = false;
  let script: HTMLScriptElement | null = null;
  let prepared: { next: boolean; persisted: boolean; reload: boolean; destination: string | null } | null = null;

  function rememberBlock(reason: Block, acrossContexts = false): boolean {
    // Never downgrade an unacknowledged failed save to a silent temporary hold.
    block = block === "save-error" ? block : reason;
    let saved = false;
    try {
      win.sessionStorage.setItem(BLOCK_KEY, block);
      if (!acrossContexts) saved = win.sessionStorage.getItem(BLOCK_KEY) === block;
    } catch { /* Try privacy cookie. */ }
    try {
      for (const domain of ["", ";Domain=alphasourceai.com"]) win.document.cookie = BLOCK_COOKIE + "=" + block + ";Path=/;Secure;SameSite=Lax" + domain;
      saved = win.document.cookie.split("; ").includes(BLOCK_COOKIE + "=" + block) || saved;
    } catch { /* Query fallback excludes the next document even with blocked storage. */ }
    return saved;
  }
  function clearBlock() {
    block = null;
    try { win.sessionStorage.removeItem(BLOCK_KEY); } catch { /* Startup still checks all gates. */ }
    try {
      for (const domain of ["", ";Domain=alphasourceai.com", ";Domain=www.alphasourceai.com"]) win.document.cookie = BLOCK_COOKIE + "=;Max-Age=0;Path=/;Secure;SameSite=Lax" + domain;
    } catch { /* Remain denied if unremovable. */ }
  }
  function carryBlock(destination: URL) {
    // Session storage alone cannot cover a noopener/new-tab browsing context.
    // Unless a cross-tab cookie verifies, carry denial on our own URLs only.
    if (block && productionHost(destination) && !rememberBlock(block, true)) destination.searchParams.set(BLOCK_PARAM, block);
    return destination;
  }
  function expireCookies() {
    const paths = new Set(["/"]);
    const pathname = new URL(win.location.href).pathname;
    if (/^\/[a-z0-9/_-]*$/i.test(pathname)) {
      const segments = pathname.split("/").filter(Boolean);
      for (let index = 1; index <= segments.length; index++) {
        const path = "/" + segments.slice(0, index).join("/");
        paths.add(path); paths.add(path + "/");
      }
    }
    for (const key of LINKEDIN_COOKIES) for (const path of paths) {
      for (const domain of ["", ";Domain=alphasourceai.com", ";Domain=www.alphasourceai.com"]) {
        try { win.document.cookie = key + "=;Max-Age=0;Expires=Thu, 01 Jan 1970 00:00:00 GMT;Path=" + path + ";Secure;SameSite=Lax" + domain; } catch { /* Best effort; not third-party/HttpOnly cookies. */ }
      }
    }
  }
  function retireDocument() {
    held = true;
    requested = false;
    if (!contaminated) return;
    win.__alphasourceLinkedInDisabled = true;
    if (script) { script.onload = null; script.onerror = null; script.remove(); script = null; }
    win.document.getElementById(SCRIPT_ID)?.remove();
    try { if (win.lintrk?.q) win.lintrk.q.length = 0; } catch { /* Vendor-owned queues may be frozen; unload regardless. */ }
    const inert: Lintrk = Object.assign(() => {}, { q: [] as unknown[][] });
    win.lintrk = inert;
    delete win._linkedin_partner_id;
    win._linkedin_data_partner_ids = [];
    // Entrypoints are inert, but downloaded SDK closures require document unload.
  }
  function prepareWithdrawal(reason: Block, persisted: boolean) {
    retireDocument();
    const survivesReload = rememberBlock(reason) || persisted;
    expireCookies();
    let destination: string | null = null;
    if (!survivesReload) {
      const fallback = new URL(win.location.href);
      fallback.searchParams.set(BLOCK_PARAM, block!);
      destination = fallback.href;
    }
    return { reload: contaminated || Boolean(destination), destination };
  }
  function finishReload(plan: { reload: boolean; destination: string | null }, reloadPending = false) {
    if (!plan.reload || unloading) return false;
    unloading = true;
    if (plan.destination) win.location.replace(plan.destination);
    else if (!reloadPending) win.location.reload();
    return true;
  }
  function withdraw(reason: Block = "withdrawn") {
    return finishReload(prepareWithdrawal(reason, false));
  }
  function reloadDocument() {
    retireDocument();
    return finishReload({ reload: contaminated, destination: null });
  }
  function consent(): boolean {
    if (!configured() || block || readBlock() || held || win.__alphasourceLinkedInDisabled) return false;
    try {
      const raw = win.localStorage.getItem(PREFERENCES_KEY);
      const saved = JSON.parse(raw || "null");
      if (saved?.marketingAttribution !== true || saved.linkedinRevision !== LINKEDIN_CONSENT_REVISION ||
        typeof saved.updatedAt !== "string" || !Number.isFinite(Date.parse(saved.updatedAt))) return false;
      win.localStorage.setItem(PREFERENCES_KEY, raw!);
      return true;
    } catch { return false; }
  }
  function pageAllowed() {
    const referrer = win.document.referrer;
    return Boolean(configured() && linkedInPage(win.location.href) &&
      safeReferrer(referrer) &&
      !(win.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
  }
  function safeReferrer(referrer: string) {
    if (!referrer) return true;
    try {
      const url = new URL(referrer);
      // Same-site private flows are excluded, including apex/www transitions.
      if (HOSTS.has(url.hostname)) return Boolean(linkedInPage(referrer));
      // Normal cross-site landings expose an origin-only referrer. Do not pass
      // arbitrary external paths/queries/identifiers to the remote tag.
      return url.protocol === "https:" && !url.port && !url.username && !url.password && url.href === url.origin + "/";
    } catch { return false; }
  }
  function navigate(destination: URL) {
    retireDocument();
    expireCookies();
    unloading = true;
    win.location.assign(carryBlock(destination).href); // BEFORE history writes / protected React render.
  }
  function installGuard() {
    if (guardInstalled || !configured()) return;
    guardInstalled = true;
    for (const method of ["pushState", "replaceState"] as const) {
      const previous = win.history[method].bind(win.history);
      win.history[method] = function (data: unknown, unused: string, url?: string | URL | null) {
        const destination = new URL(url == null ? win.location.href : String(url), win.location.href);
        if (destination.origin !== new URL(win.location.href).origin) { previous(data, unused, url); return; }
        if (contaminated && (!pageAllowed() || !linkedInPage(destination.href) || !consent())) { navigate(destination); return; }
        if (!linkedInPage(win.location.href) || !linkedInPage(destination.href)) held = true;
        previous(data, unused, carryBlock(destination).href);
      };
    }
    const interaction = (event: Event) => {
      if (unloading) return;
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const keyboard = event as KeyboardEvent;
      const mouse = event as MouseEvent;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (block && anchor) anchor.href = carryBlock(new URL(anchor.href, win.location.href)).href;
      if (!contaminated) return;
      if (event.type === "click" && mouse.button !== 0) return;
      const auth = target.closest("[data-replay-auth]")?.getAttribute("data-replay-auth");
      if ((auth === "client" || auth === "admin") && (event.type === "click" || (event.type === "keydown" && ["Enter", " "].includes(keyboard.key)))) {
        event.preventDefault(); event.stopImmediatePropagation();
        navigate(new URL("/support/?signin=" + auth, win.location.href));
        return;
      }
      // Modified links may open a separate clean document; modified buttons
      // still run their normal onClick and must pass the auth fence above.
      if (keyboard.metaKey || keyboard.ctrlKey || keyboard.shiftKey || keyboard.altKey) return;
      if (event.type === "click" && anchor && (!anchor.target || anchor.target === "_self") && !anchor.hasAttribute("download")) {
        const destination = new URL(anchor.href, win.location.href);
        if (destination.origin === new URL(win.location.href).origin && !linkedInPage(destination.href)) {
          event.preventDefault(); event.stopImmediatePropagation(); navigate(destination); return;
        }
      }
    };
    for (const name of ["click", "keydown", "auxclick", "contextmenu"]) win.document.addEventListener(name, interaction, true);
    for (const name of ["popstate", "hashchange"]) win.addEventListener(name, event => {
      if (!linkedInPage(win.location.href)) held = true;
      if (contaminated && (!pageAllowed() || !consent())) {
        event.stopImmediatePropagation(); reloadDocument();
      }
    }, true);
    win.addEventListener("pagehide", () => { retireDocument(); if (block === "withdrawn" || block === "save-error") expireCookies(); });
    win.addEventListener("pageshow", event => { if ((event as PageTransitionEvent).persisted && contaminated) reloadDocument(); });
    win.addEventListener("storage", event => {
      if ((event.key === PREFERENCES_KEY || event.key === null) && contaminated && !consent()) withdraw();
    });
  }
  function start() {
    if (requested || !pageAllowed() || !consent() || win.document.activeElement?.closest('form,input,textarea,select,[contenteditable],[role="dialog"]')) return;
    if (win.document.querySelector('script[src*="' + LINKEDIN_INSIGHT_SCRIPT_SRC + '"]') || win.lintrk) return;
    installGuard();
    win.__alphasourceLinkedInDisabled = false;
    win._linkedin_partner_id = id;
    win._linkedin_data_partner_ids = [id];
    const lintrk = ((action: string, data?: unknown) => { if (!held && !unloading && pageAllowed() && consent()) lintrk.q.push([action, data]); }) as Lintrk;
    lintrk.q = [];
    win.lintrk = lintrk;
    requested = true;
    contaminated = true;
    script = win.document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = LINKEDIN_INSIGHT_SCRIPT_SRC;
    script.onload = () => { if (held || unloading) return; if (!consent()) withdraw(); else if (!pageAllowed()) reloadDocument(); };
    script.onerror = () => { resourceFailed = true; retireDocument(); }; // No automatic retry/reload loop.
    win.document.head.appendChild(script);
  }
  function sync(input: LinkedInInsightSync) {
    if (!configured() || resourceFailed) return;
    if (input.marketingAttribution && input.linkedinRevision === LINKEDIN_CONSENT_REVISION && pageAllowed() && consent()) start();
    else if (contaminated && !unloading) {
      if (!input.marketingAttribution || input.linkedinRevision !== LINKEDIN_CONSENT_REVISION || !consent()) withdraw();
      else reloadDocument();
    }
  }
  function prepareChoice(next: boolean, persisted: boolean) {
    if (!configured()) return;
    let plan: { reload: boolean; destination: string | null };
    if (!persisted && next && !contaminated) {
      held = true; // Failed opt-in is not a withdrawal and never stamps a marker.
      plan = { reload: false, destination: null };
    } else if (!persisted || !next) {
      plan = prepareWithdrawal(persisted ? "withdrawn" : "save-error", persisted);
    } else {
      clearBlock(); // Only an explicitly persisted grant may remove denial.
      const destination = new URL(win.location.href);
      const hadMarker = destination.searchParams.has(BLOCK_PARAM);
      destination.searchParams.delete(BLOCK_PARAM);
      const reload = contaminated || Boolean(linkedInPage(destination.href)) || hadMarker;
      retireDocument(); // Never start beneath a closing consent dialog.
      plan = { reload, destination: hadMarker ? destination.href : null };
    }
    prepared = { next, persisted, ...plan };
  }
  function changeChoice(next: boolean, persisted: boolean, reloadPending = false) {
    if (!configured()) return false;
    if (!prepared || prepared.next !== next || prepared.persisted !== persisted) prepareChoice(next, persisted);
    const plan = prepared!;
    prepared = null;
    return finishReload(plan, reloadPending);
  }
  function needsConsentRefresh() {
    if (!configured() || !linkedInPage(win.location.href)) return false;
    try {
      const saved = JSON.parse(win.localStorage.getItem(PREFERENCES_KEY) || "null");
      return Boolean(saved?.marketingAttribution && saved.linkedinRevision !== LINKEDIN_CONSENT_REVISION && typeof saved.updatedAt === "string");
    } catch { return false; }
  }
  function withdrawalState() { return { withdrawn: block === "withdrawn" || block === "save-error", saveFailed: block === "save-error" }; }
  if (block) rememberBlock(block); // Re-establish denial when storage becomes available again.
  installGuard(); // Before React, independently of GA4 and Clarity.
  return { start, sync, prepareChoice, changeChoice, needsConsentRefresh, withdrawalState };
}

const runtime = typeof window === "undefined" ? null : createLinkedInInsight(window as LinkedInInsightWindow,
  readConfiguredLinkedInPartnerId(), import.meta.env.PROD);
export const syncLinkedInInsight = (input: LinkedInInsightSync) => runtime?.sync(input);
export const changeLinkedInChoice = (next: boolean, persisted: boolean, reloadPending = false) => runtime?.changeChoice(next, persisted, reloadPending) ?? false;
export const prepareLinkedInChoice = (next: boolean, persisted: boolean) => runtime?.prepareChoice(next, persisted);
export const needsLinkedInConsentRefresh = () => runtime?.needsConsentRefresh() ?? false;
export const linkedInWithdrawalState = () => runtime?.withdrawalState() ?? { withdrawn: false, saveFailed: false };
