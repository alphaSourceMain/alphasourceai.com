import { useEffect } from "react";
import { isPublicOptionalTrackingRoute, useTrackingConsent } from "@/context/TrackingConsentContext";
import { syncLinkedInInsight } from "@/lib/linkedinInsight";

export default function LinkedInInsightLoader({ location }: { location: string }) {
  const { preferences } = useTrackingConsent();

  useEffect(() => {
    syncLinkedInInsight({
      onPublicRoute: isPublicOptionalTrackingRoute(location),
      marketingAttribution: preferences?.marketingAttribution === true,
      linkedinRevision: preferences?.linkedinRevision,
    });
  }, [location, preferences?.linkedinRevision, preferences?.marketingAttribution]);

  return null;
}
