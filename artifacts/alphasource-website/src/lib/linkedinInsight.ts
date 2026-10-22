/** Bump when the LinkedIn disclosure changes so an older marketing choice cannot opt a visitor in silently. */
export const LINKEDIN_CONSENT_REVISION = "linkedin-20261022";
export const LINKEDIN_INSIGHT_SCRIPT_SRC = "https://snap.licdn.com/li.lms-analytics/insight.min.js";

const SCRIPT_ID = "alphasource-linkedin-insight";
const PREFERENCES_KEY = "alphasource:tracking-preferences:v2";

type Lintrk = ((action: string, data?: unknown) => void) & { q: unknown[][] };

type InsightScript = {
  id: string;
  async: boolean;
  src: string;
  onerror: (() => void) | null;
  remove: () => void;
};

export type LinkedInInsightWindow = {
  document: {
    getElementById: (id: string) => { remove: () => void } | null;
    querySelector: (selector: string) => unknown;
    createElement: (tag: "script") => InsightScript;
    head: { appendChild: (node: InsightScript) => void };
  };
  localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
  location: { reload: () => void };
  addEventListener: (type: string, listener: (event: { key?: string | null }) => void) => void;
  _linkedin_partner_id?: string;
  _linkedin_data_partner_ids?: string[];
  lintrk?: Lintrk;
};

export type LinkedInInsightSync = {
  onPublicRoute: boolean;
  marketingAttribution: boolean;
  linkedinRevision?: string;
};

export function linkedInPartnerId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readConfiguredLinkedInPartnerId(): string {
  // Direct member access so Vite inlines this build-time value.
  return linkedInPartnerId(import.meta.env.VITE_LINKEDIN_PARTNER_ID);
}

export function createLinkedInInsight(win: LinkedInInsightWindow, partnerId: string) {
  let requested = false;
  let held = false;
  let script: InsightScript | null = null;
  const id = linkedInPartnerId(partnerId);

  function consent(): boolean {
    if (!id) return false;
    try {
      const raw = win.localStorage.getItem(PREFERENCES_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (
        saved?.marketingAttribution !== true ||
        saved.linkedinRevision !== LINKEDIN_CONSENT_REVISION ||
        typeof saved.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(saved.updatedAt))
      ) {
        return false;
      }
      // Fail closed when preferences cannot be persisted, including read-only storage.
      win.localStorage.setItem(PREFERENCES_KEY, raw!);
      return true;
    } catch {
      return false;
    }
  }

  function removeScript() {
    script?.remove();
    script = null;
    win.document.getElementById(SCRIPT_ID)?.remove();
  }

  function hold() {
    held = true;
    requested = false;
    removeScript();
  }

  function start() {
    if (!id || held || requested || !consent()) return;
    // A tag already on the page is not reused or duplicated.
    if (win.document.querySelector(`script[src*="${LINKEDIN_INSIGHT_SCRIPT_SRC}"]`)) return;

    win._linkedin_partner_id = id;
    const ids = win._linkedin_data_partner_ids ?? [];
    win._linkedin_data_partner_ids = ids;
    if (!ids.includes(id)) ids.push(id);

    if (!win.lintrk) {
      const lintrk = ((action: string, data?: unknown) => {
        lintrk.q.push([action, data]);
      }) as Lintrk;
      lintrk.q = [];
      win.lintrk = lintrk;
    }

    requested = true;
    const element = win.document.createElement("script");
    element.id = SCRIPT_ID;
    element.async = true;
    element.src = LINKEDIN_INSIGHT_SCRIPT_SRC;
    element.onerror = () => {
      hold();
    };
    script = element;
    win.document.head.appendChild(element);
  }

  function sync(input: LinkedInInsightSync) {
    if (!id) return;
    const allowed =
      input.onPublicRoute &&
      input.marketingAttribution === true &&
      input.linkedinRevision === LINKEDIN_CONSENT_REVISION &&
      consent();
    if (allowed) {
      start();
      return;
    }
    if (!requested) return;
    hold();
    // Leaving a public page, or losing consent, must not keep the tag running.
    if (!input.onPublicRoute || input.marketingAttribution !== true || input.linkedinRevision !== LINKEDIN_CONSENT_REVISION) {
      win.location.reload();
    }
  }

  function changeChoice(next: boolean, persisted: boolean) {
    if (!id) return false;
    if (next) {
      held = false;
      return false;
    }
    const wasRequested = requested;
    if (wasRequested) hold();
    const reload = Boolean(persisted && wasRequested);
    if (reload) win.location.reload();
    return reload;
  }

  function needsConsentRefresh() {
    if (!id) return false;
    try {
      const saved = JSON.parse(win.localStorage.getItem(PREFERENCES_KEY) || "null");
      return Boolean(
        saved &&
          saved.marketingAttribution === true &&
          saved.linkedinRevision !== LINKEDIN_CONSENT_REVISION &&
          typeof saved.updatedAt === "string",
      );
    } catch {
      return false;
    }
  }

  if (id) {
    win.addEventListener("storage", (event) => {
      if (event.key === PREFERENCES_KEY && requested && !consent()) {
        hold();
        win.location.reload();
      }
    });
  }

  return { start, sync, hold, changeChoice, needsConsentRefresh };
}

const runtime =
  typeof window === "undefined"
    ? null
    : createLinkedInInsight(window as unknown as LinkedInInsightWindow, readConfiguredLinkedInPartnerId());

export const syncLinkedInInsight = (input: LinkedInInsightSync) => runtime?.sync(input);
export const changeLinkedInChoice = (next: boolean, persisted: boolean) => runtime?.changeChoice(next, persisted) ?? false;
export const needsLinkedInConsentRefresh = () => runtime?.needsConsentRefresh() ?? false;
