import { useEffect } from "react";
import { useTrackingConsent } from "@/context/TrackingConsentContext";

interface TrackingConsentNoticeProps {
  visible: boolean;
}

export default function TrackingConsentNotice({ visible }: TrackingConsentNoticeProps) {
  const {
    choice,
    preferencesOpen,
    allowOptionalTracking,
    declineOptionalTracking,
    closeTrackingPreferences,
  } = useTrackingConsent();

  useEffect(() => {
    if (!visible || !preferencesOpen || !choice) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTrackingPreferences();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choice, closeTrackingPreferences, preferencesOpen, visible]);

  if (!visible || (choice && !preferencesOpen)) return null;

  return (
    <section
      aria-label="Privacy choices"
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-xl border border-[#0A1547]/15 bg-white p-4 shadow-lg sm:inset-x-auto sm:right-5 sm:w-[34rem]"
    >
      <h2 className="text-base font-black text-[#0A1547]">Privacy choices</h2>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]">
        We use optional analytics and marketing attribution tools to understand how visitors find and use our site, along with optional chat tools to support visitors. You can allow or decline these technologies. Essential sign-in and security functions always remain active.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={allowOptionalTracking}
          className="min-h-9 border border-[#0A1547] bg-white px-3 text-sm font-bold text-[#0A1547] hover:border-[#A380F6] hover:text-[#5D43CC] focus:outline-none focus:ring-2 focus:ring-[#A380F6] focus:ring-offset-2"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={declineOptionalTracking}
          className="min-h-9 border border-[#0A1547] bg-white px-3 text-sm font-bold text-[#0A1547] hover:border-[#A380F6] hover:text-[#5D43CC] focus:outline-none focus:ring-2 focus:ring-[#A380F6] focus:ring-offset-2"
        >
          Decline
        </button>
        <a
          href="/privacy/"
          className="px-1 text-sm font-bold text-[#5D43CC] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#A380F6] focus:ring-offset-2"
        >
          Privacy Policy
        </a>
      </div>
    </section>
  );
}
