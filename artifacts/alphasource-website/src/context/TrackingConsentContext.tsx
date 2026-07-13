import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type TrackingConsentChoice = "granted" | "denied";

const TRACKING_CONSENT_STORAGE_KEY = "alphasource:tracking-consent:v1";
const OPTIONAL_ANALYTICS_ID_KEY = "alphasource:anonymous_id";
const OPTIONAL_SESSION_ID_KEY = "alphasource:session_id";

export const PUBLIC_OPTIONAL_TRACKING_ROUTES = new Set([
  "/",
  "/about",
  "/alphascreen",
  "/alphascreen/pricing",
  "/alphascreen/how-it-works",
  "/alphascreen/security",
  "/alphascreen/candidate-experience",
  "/alphascreen/for-dental-groups",
  "/alphascreen/roi",
  "/faq",
  "/support",
  "/terms",
  "/privacy",
]);

export function normalizeTrackingPath(path: string): string {
  const clean = String(path || "/").split("?")[0].split("#")[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
}

export function isPublicOptionalTrackingRoute(path: string): boolean {
  return PUBLIC_OPTIONAL_TRACKING_ROUTES.has(normalizeTrackingPath(path));
}

function readStoredConsent(): TrackingConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function persistConsent(choice: TrackingConsentChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, choice);
  } catch {
    // Optional tracking remains disabled when preference storage is unavailable.
  }
}

function clearOptionalTrackingIdentifiers(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OPTIONAL_ANALYTICS_ID_KEY);
    window.sessionStorage.removeItem(OPTIONAL_SESSION_ID_KEY);
  } catch {
    // Third-party storage is outside this site's safe deletion scope.
  }
}

interface TrackingConsentContextType {
  choice: TrackingConsentChoice | null;
  optionalTrackingAllowed: boolean;
  preferencesOpen: boolean;
  allowOptionalTracking: () => void;
  declineOptionalTracking: () => void;
  openTrackingPreferences: () => void;
  closeTrackingPreferences: () => void;
}

const TrackingConsentContext = createContext<TrackingConsentContextType>({
  choice: null,
  optionalTrackingAllowed: false,
  preferencesOpen: false,
  allowOptionalTracking: () => {},
  declineOptionalTracking: () => {},
  openTrackingPreferences: () => {},
  closeTrackingPreferences: () => {},
});

export function TrackingConsentProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<TrackingConsentChoice | null>(() => readStoredConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const allowOptionalTracking = useCallback(() => {
    persistConsent("granted");
    setChoice("granted");
    setPreferencesOpen(false);
  }, []);

  const declineOptionalTracking = useCallback(() => {
    persistConsent("denied");
    clearOptionalTrackingIdentifiers();
    setChoice("denied");
    setPreferencesOpen(false);
  }, []);

  const openTrackingPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closeTrackingPreferences = useCallback(() => setPreferencesOpen(false), []);

  return (
    <TrackingConsentContext.Provider
      value={{
        choice,
        optionalTrackingAllowed: choice === "granted",
        preferencesOpen,
        allowOptionalTracking,
        declineOptionalTracking,
        openTrackingPreferences,
        closeTrackingPreferences,
      }}
    >
      {children}
    </TrackingConsentContext.Provider>
  );
}

export function useTrackingConsent() {
  return useContext(TrackingConsentContext);
}
