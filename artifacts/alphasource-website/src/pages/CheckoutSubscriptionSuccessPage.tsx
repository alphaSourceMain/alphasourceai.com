import { useMemo } from "react";
import { ArrowRight, CheckCircle, Clock3, RefreshCw, ShieldCheck } from "lucide-react";

type ReturnStatus = "ready" | "setup_pending" | "activation_pending" | "payment_pending";

function readStatus(): ReturnStatus {
  if (typeof window === "undefined") return "setup_pending";
  const status = String(new URLSearchParams(window.location.search || "").get("status") || "").trim().toLowerCase();
  if (status === "ready" || status === "activation_pending" || status === "payment_pending") return status;
  return "setup_pending";
}

const STATUS_COPY: Record<ReturnStatus, {
  eyebrow: string;
  title: string;
  body: string;
  tone: "success" | "pending";
}> = {
  ready: {
    eyebrow: "Payment confirmed",
    title: "Your alphaScreen subscription is ready for account access.",
    body: "Stripe checkout was verified and your membership is linked. Open the dashboard if you are already signed in, or sign in from the public site.",
    tone: "success",
  },
  setup_pending: {
    eyebrow: "Payment confirmed",
    title: "Account setup is being prepared.",
    body: "Stripe checkout was verified. Use the password setup link when it opens or arrives. If setup is still pending, our team can resend the account setup link.",
    tone: "pending",
  },
  activation_pending: {
    eyebrow: "Processing activation",
    title: "Your payment is received and activation is still processing.",
    body: "Stripe checkout returned successfully. Dashboard access activates only after the server confirms payment and provisioning completes.",
    tone: "pending",
  },
  payment_pending: {
    eyebrow: "Checkout status pending",
    title: "Stripe checkout is still finalizing.",
    body: "Payment confirmation has not finished yet. Refresh in a moment or return from Stripe Checkout again after payment is complete.",
    tone: "pending",
  },
};

export default function CheckoutSubscriptionSuccessPage() {
  const status = useMemo(() => readStatus(), []);
  const copy = STATUS_COPY[status];
  const Icon = copy.tone === "success" ? CheckCircle : Clock3;

  const refresh = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#F8F9FD] px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                copy.tone === "success" ? "bg-[#02D99D]/10 text-[#02D99D]" : "bg-[#A380F6]/10 text-[#A380F6]"
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
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02D99D]">Verified server-side</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                This page does not activate access by itself.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A380F6]">Next step</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Finish password setup or sign in once provisioning is complete.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02ABE0]">Payment details</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Card details stay inside Stripe Checkout.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90"
            >
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
            >
              Sign in from home
            </a>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547]/65 transition-colors hover:border-[#02ABE0] hover:text-[#02ABE0]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh status
            </button>
          </div>

          <div className="mt-8 flex items-start gap-3 border-t border-[#0A1547]/10 pt-5 text-sm font-semibold leading-relaxed text-[#0A1547]/55">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#02D99D]" />
            <p>
              Browser return is only a handoff. Stripe webhook and server-side payment verification remain the source of truth for billing and access.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
