import { useEffect } from "react";
import { useTrackingConsent } from "@/context/TrackingConsentContext";
import { startSessionReplay } from "@/lib/sessionReplay";

export default function PublicSessionReplay({ location }: { location: string }) {
  const { preferences } = useTrackingConsent();
  useEffect(() => {
    if (preferences?.sessionReplay) void startSessionReplay();
  }, [preferences?.sessionReplay, location]);
  return null;
}
