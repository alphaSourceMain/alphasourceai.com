import { useMemo } from "react";
import { AlertCircle, ArrowRight, CheckCircle, Clock3, RefreshCw, ShieldCheck } from "lucide-react";

type ReturnStatus = "ready" | "setup_pending" | "activation_pending" | "payment_pending" | "cancelled";

function readStatus(): ReturnStatus {
  if (typeof window === "undefined") return "setup_pending";
  const status = String(new URLSearchParams(window.location.search || "").get("status") || "").trim().toLowerCase();
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "pending") return "payment_pending";
  if (status === "ready" || status === "activation_pending" || status === "payment_pending") return status;
  return "setup_pending";
}

const STATUS_COPY: Record<ReturnStatus, {
  eyebrow: string;
  title: string;
  body: string;
  tone: "success" | "pending" | "cancelled";
  primaryLabel: string;
  primaryHref?: string;
  secondaryLabel: string;
}> = {
  ready: {
    eyebrow: "Payment confirmed",
    title: "Your alphaScreen membership is ready.",
    body: "Your payment is confirmed and account setup is ready. Open the dashboard if you are already signed in, or sign in to continue.",
    tone: "success",
    primaryLabel: "Open dashboard",
    primaryHref: "/dashboard",
    secondaryLabel: "Sign in to continue",
  },
  setup_pending: {
    eyebrow: "Payment received",
    title: "We are setting up your account.",
    body: "Payment confirmation can take a moment. Once setup is ready, you can finish setting your password and continue to the dashboard.",
    tone: "pending",
    primaryLabel: "Refresh status",
    secondaryLabel: "Sign in from home",
  },
  activation_pending: {
    eyebrow: "Setting up your account",
    title: "Your membership is almost ready.",
    body: "Your payment was received and account setup is still finishing. Dashboard access becomes available after setup is complete.",
    tone: "pending",
    primaryLabel: "Refresh status",
    secondaryLabel: "Sign in from home",
  },
  payment_pending: {
    eyebrow: "Payment finalizing",
    title: "We are waiting for payment confirmation.",
    body: "Secure checkout may take a moment to confirm. Refresh this page shortly, or resume signup if checkout was not completed.",
    tone: "pending",
    primaryLabel: "Refresh status",
    secondaryLabel: "Resume signup",
  },
  cancelled: {
    eyebrow: "Payment not completed",
    title: "Checkout was not completed.",
    body: "No alphaScreen payment was completed from this return. You can resume membership signup when you are ready.",
    tone: "cancelled",
    primaryLabel: "Resume signup",
    primaryHref: "/alphascreen/pricing",
    secondaryLabel: "Talk to sales",
  },
};

export default function CheckoutSubscriptionSuccessPage() {
  const status = useMemo(() => readStatus(), []);
  const copy = STATUS_COPY[status];
  const Icon = copy.tone === "success" ? CheckCircle : copy.tone === "cancelled" ? AlertCircle : Clock3;

  const refresh = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  const primaryIsRefresh = !copy.primaryHref;
  const secondaryHref = status === "cancelled"
    ? "/alphascreen/pricing#pricing-demo"
    : status === "payment_pending"
      ? "/alphascreen/pricing"
      : "/";

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#F8F9FD] px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                copy.tone === "success"
                  ? "bg-[#02D99D]/10 text-[#02D99D]"
                  : copy.tone === "cancelled"
                    ? "bg-red-50 text-red-600"
                    : "bg-[#A380F6]/10 text-[#A380F6]"
              }`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">{copy.eyebrow}</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-[#0A1547] sm:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#0A1547]/60">{copy.body}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02D99D]">Secure payment</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Payment details stay protected inside Stripe Checkout.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A380F6]">Account setup</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Setup may take a moment after payment confirmation.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02ABE0]">Next step</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Finish setting your password or sign in when your account is ready.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {primaryIsRefresh ? (
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" />
                {copy.primaryLabel}
              </button>
            ) : (
              <a
                href={copy.primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90"
              >
                {copy.primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
            <a
              href={secondaryHref}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
            >
              {copy.secondaryLabel}
            </a>
            {!primaryIsRefresh ? (
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547]/65 transition-colors hover:border-[#02ABE0] hover:text-[#02ABE0]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh status
              </button>
            ) : null}
          </div>

          <div className="mt-8 flex items-start gap-3 border-t border-[#0A1547]/10 pt-5 text-sm font-semibold leading-relaxed text-[#0A1547]/55">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#02D99D]" />
            <p>
              For security, account access is completed only after payment confirmation and account setup are finished.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
