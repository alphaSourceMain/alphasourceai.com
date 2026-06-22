import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CheckCircle,
  Clock3,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

type PackageLoadState = "loading" | "ready" | "fallback";

type BillingCadence = {
  key?: string;
  display_name?: string;
  stripe_price_configured?: boolean;
};

type AlphaScreenPackage = {
  plan_key: string;
  display_name: string;
  included_interviews: number;
  included_interviews_per_role: number;
  interview_duration_minutes: number;
  max_interview_minutes: number;
  additional_interview_price: number;
  additional_interview_fee: number;
  overage_price: number;
  per_role_fee: number;
  billing_cadences: BillingCadence[];
};

const FALLBACK_PACKAGES: AlphaScreenPackage[] = [
  {
    plan_key: "basic",
    display_name: "Basic",
    included_interviews: 20,
    included_interviews_per_role: 20,
    interview_duration_minutes: 10,
    max_interview_minutes: 10,
    additional_interview_price: 30,
    additional_interview_fee: 30,
    overage_price: 30,
    per_role_fee: 399,
    billing_cadences: [
      { key: "monthly", display_name: "Monthly", stripe_price_configured: false },
      { key: "annual", display_name: "Annual", stripe_price_configured: false },
    ],
  },
  {
    plan_key: "pro",
    display_name: "Pro",
    included_interviews: 30,
    included_interviews_per_role: 30,
    interview_duration_minutes: 12,
    max_interview_minutes: 12,
    additional_interview_price: 35,
    additional_interview_fee: 35,
    overage_price: 35,
    per_role_fee: 699,
    billing_cadences: [
      { key: "monthly", display_name: "Monthly", stripe_price_configured: false },
      { key: "annual", display_name: "Annual", stripe_price_configured: false },
    ],
  },
];

const BEST_FOR: Record<string, string> = {
  basic: "Lean teams that want consistent first-pass screening for focused roles.",
  pro: "Growing hiring teams with more active roles and higher candidate volume.",
};

const PLAN_ACCENTS: Record<string, { color: string; border: string; bg: string }> = {
  basic: {
    color: "#02D99D",
    border: "rgba(2,217,157,0.35)",
    bg: "rgba(2,217,157,0.08)",
  },
  pro: {
    color: "#A380F6",
    border: "rgba(163,128,246,0.35)",
    bg: "rgba(163,128,246,0.09)",
  },
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePackage(raw: unknown): AlphaScreenPackage | null {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  if (!source) return null;
  const planKey = String(source.plan_key || "").trim().toLowerCase();
  if (planKey !== "basic" && planKey !== "pro") return null;

  const fallback = FALLBACK_PACKAGES.find((item) => item.plan_key === planKey) || FALLBACK_PACKAGES[0];
  const cadencesRaw = Array.isArray(source.billing_cadences) ? source.billing_cadences : fallback.billing_cadences;
  const billingCadences: BillingCadence[] = [];
  cadencesRaw.forEach((cadence) => {
    const item = cadence && typeof cadence === "object" ? cadence as Record<string, unknown> : {};
    const key = String(item.key || "").trim().toLowerCase();
    if (!key) return;
    billingCadences.push({
      key,
      display_name: String(item.display_name || key).trim(),
      stripe_price_configured: item.stripe_price_configured === true,
    });
  });

  return {
    plan_key: planKey,
    display_name: String(source.display_name || fallback.display_name).trim() || fallback.display_name,
    included_interviews: asNumber(source.included_interviews, fallback.included_interviews),
    included_interviews_per_role: asNumber(source.included_interviews_per_role, fallback.included_interviews_per_role),
    interview_duration_minutes: asNumber(source.interview_duration_minutes, fallback.interview_duration_minutes),
    max_interview_minutes: asNumber(source.max_interview_minutes, fallback.max_interview_minutes),
    additional_interview_price: asNumber(source.additional_interview_price, fallback.additional_interview_price),
    additional_interview_fee: asNumber(source.additional_interview_fee, fallback.additional_interview_fee),
    overage_price: asNumber(source.overage_price, fallback.overage_price),
    per_role_fee: asNumber(source.per_role_fee, fallback.per_role_fee),
    billing_cadences: billingCadences,
  };
}

function normalizePackages(rawPackages: unknown): AlphaScreenPackage[] {
  if (!Array.isArray(rawPackages)) return FALLBACK_PACKAGES;
  const normalized = rawPackages
    .map(normalizePackage)
    .filter((item): item is AlphaScreenPackage => Boolean(item));

  const byKey = new Map(normalized.map((item) => [item.plan_key, item]));
  return FALLBACK_PACKAGES.map((fallback) => byKey.get(fallback.plan_key) || fallback);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function PackageMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#0A1547]/10 bg-white px-4 py-3">
      <div className="mt-0.5 text-[#02ABE0]">{icon}</div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0A1547]/45">{label}</p>
        <p className="text-sm font-black text-[#0A1547]">{value}</p>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: AlphaScreenPackage }) {
  const accent = PLAN_ACCENTS[plan.plan_key] || PLAN_ACCENTS.basic;
  const included = plan.included_interviews_per_role || plan.included_interviews;
  const duration = plan.max_interview_minutes || plan.interview_duration_minutes;
  const overage = plan.additional_interview_fee || plan.additional_interview_price || plan.overage_price;
  const cadenceLabels = plan.billing_cadences.length
    ? plan.billing_cadences.map((cadence) => {
      const label = cadence.display_name || cadence.key || "Billing";
      return cadence.stripe_price_configured ? label : `${label} planned`;
    })
    : ["Monthly planned", "Annual planned"];

  return (
    <article
      className="rounded-lg border bg-white p-6 shadow-sm transition-transform hover:-translate-y-1"
      style={{
        borderColor: plan.plan_key === "pro" ? accent.border : "rgba(10,21,71,0.10)",
        boxShadow: plan.plan_key === "pro" ? "0 18px 46px rgba(10,21,71,0.12)" : "0 10px 28px rgba(10,21,71,0.06)",
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: accent.color }}>
            {plan.display_name}
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#0A1547]">{plan.display_name} package</h2>
        </div>
        <div className="rounded-lg p-2.5" style={{ backgroundColor: accent.bg, color: accent.color }}>
          {plan.plan_key === "pro" ? <BriefcaseBusiness className="h-5 w-5" /> : <Layers3 className="h-5 w-5" />}
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-black tracking-normal text-[#0A1547]">{formatUsd(plan.per_role_fee)}</span>
          <span className="pb-1.5 text-sm font-bold text-[#0A1547]/55">/ role / mo</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#0A1547]/60">{BEST_FOR[plan.plan_key]}</p>
      </div>

      <div className="grid gap-3">
        <PackageMetric
          icon={<CheckCircle className="h-4 w-4" />}
          label="Included"
          value={`${included} interviews per role`}
        />
        <PackageMetric
          icon={<Clock3 className="h-4 w-4" />}
          label="Interview cap"
          value={`${duration}-minute interviews`}
        />
        <PackageMetric
          icon={<BadgeDollarSign className="h-4 w-4" />}
          label="Additional interviews"
          value={`${formatUsd(overage)} each`}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {cadenceLabels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-[#0A1547]/10 bg-[#F8F9FD] px-3 py-1 text-xs font-bold text-[#0A1547]/65"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-full border border-[#0A1547]/12 bg-[#0A1547]/5 px-4 py-3 text-sm font-black text-[#0A1547]/45"
        >
          Start purchase - coming soon
        </button>
        <a
          href="/alphascreen#request-demo"
          className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent.color }}
          data-analytics-cta={`Request demo for ${plan.display_name}`}
          data-analytics-placement="pricing-card"
          data-analytics-target="/alphascreen#request-demo"
        >
          Request demo instead
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function EnterpriseCard() {
  return (
    <article className="rounded-lg border border-[#0A1547]/10 bg-[#0A1547] p-6 text-white shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#02ABE0]">Enterprise</p>
          <h2 className="mt-2 text-2xl font-black">Custom package</h2>
        </div>
        <div className="rounded-lg bg-white/10 p-2.5 text-[#02D99D]">
          <Building2 className="h-5 w-5" />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-white/70">
        For teams that need custom interview volume, enterprise onboarding, advanced support, or negotiated commercial terms.
      </p>
      <div className="mt-6 grid gap-3">
        {[
          "Custom interview volume",
          "Agreement and billing review",
          "Priority implementation planning",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm font-bold text-white/85">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-[#02D99D]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <a
        href="/alphascreen#request-demo"
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#0A1547] transition-opacity hover:opacity-90"
        data-analytics-cta="Contact Sales"
        data-analytics-placement="pricing-enterprise"
        data-analytics-target="/alphascreen#request-demo"
      >
        Contact Sales
        <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}

function LoadingNotice({ state }: { state: PackageLoadState }) {
  if (state === "ready") return null;

  const isLoading = state === "loading";
  return (
    <div className="mb-6 rounded-lg border border-[#0A1547]/10 bg-white px-4 py-3 text-sm font-semibold text-[#0A1547]/65">
      {isLoading
        ? "Loading current alphaScreen package configuration..."
        : "Showing current package defaults while live package configuration is unavailable."}
    </div>
  );
}

export default function AlphaScreenPricingPage() {
  const [packages, setPackages] = useState<AlphaScreenPackage[]>(FALLBACK_PACKAGES);
  const [loadState, setLoadState] = useState<PackageLoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPackages() {
      try {
        const response = await fetch(joinUrl(getPublicBackendBase(), "/api/alphascreen/packages"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Package endpoint returned ${response.status}`);
        const body = await response.json() as { packages?: unknown };
        setPackages(normalizePackages(body.packages));
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setPackages(FALLBACK_PACKAGES);
        setLoadState("fallback");
      }
    }

    void loadPackages();
    return () => controller.abort();
  }, []);

  const planCards = useMemo(() => normalizePackages(packages), [packages]);

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-[#F8F9FD] pt-28">
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(10,21,71,0.14) 1px, transparent 0)",
          backgroundSize: "36px 36px",
        }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#A380F6]/25 bg-white px-3 py-1.5 text-sm font-bold text-[#A380F6] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#02D99D]" />
              alphaScreen pricing
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.04] tracking-normal text-[#0A1547] lg:text-6xl">
              alphaScreen pricing
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#0A1547]/65">
              Structured AI-assisted interview screening for hiring teams that need a clearer, more consistent read on candidates before the next conversation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#packages"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#A380F6] px-6 py-3.5 text-base font-black text-white transition-opacity hover:opacity-90"
                data-analytics-cta="View Packages"
                data-analytics-placement="pricing-hero"
              >
                View packages
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/alphascreen#request-demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-base font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
                data-analytics-cta="Request a Demo"
                data-analytics-placement="pricing-hero"
                data-analytics-target="/alphascreen#request-demo"
              >
                Request a demo
              </a>
            </div>
            <p className="mt-5 max-w-xl text-sm font-semibold leading-relaxed text-[#0A1547]/55">
              Self-serve purchase is being prepared. Final signup will require agreement review and payment before dashboard activation.
            </p>
          </div>

          <div className="rounded-lg border border-[#0A1547]/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#0A1547]/8 pb-4">
              <div className="flex items-center gap-3">
                <img src="/alpha-symbol.png" alt="" className="h-9 w-9" />
                <div>
                  <p className="text-sm font-black text-[#0A1547]">alphaScreen packages</p>
                  <p className="text-xs font-bold text-[#0A1547]/45">Public pricing preview</p>
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 text-[#02D99D]" />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Basic", "20 interviews", "10-minute cap"],
                ["Pro", "30 interviews", "12-minute cap"],
                ["Enterprise", "Custom volume", "Contact Sales"],
              ].map(([name, volume, duration]) => (
                <div key={name} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-[#F8F9FD] px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-[#0A1547]">{name}</p>
                    <p className="text-xs font-semibold text-[#0A1547]/50">{volume}</p>
                  </div>
                  <p className="self-center text-xs font-black text-[#0A1547]/60">{duration}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Packages</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">
              Pick the screening capacity that matches your hiring motion.
            </h2>
          </div>
          <LoadingNotice state={loadState} />
          <div className="grid gap-5 lg:grid-cols-3">
            {planCards.map((plan) => (
              <PlanCard key={plan.plan_key} plan={plan} />
            ))}
            <EnterpriseCard />
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#0A1547]/55">
            Package details shown here are for planning. Self-serve signup, agreement generation, and Stripe checkout are not active on this page yet.
          </p>
        </div>
      </section>

      <section className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Coming workflow</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">What self-serve signup will require</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
                This pricing page is the UI foundation only. The commercial flow will stay gated until agreement generation, payment, and account activation are wired end to end.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["1", "Choose a package", "Select Basic, Pro, or contact Sales for custom terms."],
                ["2", "Review agreement", "Final signup will require membership agreement review and signature."],
                ["3", "Complete payment", "Stripe checkout will be added in a later phase."],
                ["4", "Set up dashboard", "Activation will happen only after payment and account setup are complete."],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-lg border border-[#0A1547]/10 bg-white p-5">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1547] text-sm font-black text-white">
                    {step}
                  </div>
                  <h3 className="text-base font-black text-[#0A1547]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#0A1547]/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-5xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-black text-[#0A1547]">Need access before self-serve purchase opens?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
            Request a demo and the alphaSource team can walk through package fit, agreement timing, and current onboarding options.
          </p>
          <a
            href="/alphascreen#request-demo"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-base font-black text-white transition-opacity hover:opacity-90"
            data-analytics-cta="Request a Demo"
            data-analytics-placement="pricing-bottom"
            data-analytics-target="/alphascreen#request-demo"
          >
            Request a demo
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
