import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { trackEvent } from "@/lib/analytics";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

type PackageLoadState = "loading" | "ready" | "fallback";
type PurchaseIntentStatus = "idle" | "submitting" | "success";

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

type PurchaseIntentForm = {
  company_legal_name: string;
  company_dba: string;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_title: string;
  billing_cadence: string;
  agreement_acknowledged: boolean;
  contact_acknowledged: boolean;
};

type PurchaseIntentResult = {
  purchase_intent_id: string;
  status: string;
  duplicate?: boolean;
  selected_package?: {
    plan_key?: string;
    display_name?: string;
    billing_cadence?: string;
    included_interviews?: number;
    interview_duration_minutes?: number;
    max_interview_minutes?: number;
    additional_interview_price?: number;
    additional_interview_fee?: number;
    per_role_fee?: number;
  };
  next_step_message?: string;
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

const EMPTY_PURCHASE_FORM: PurchaseIntentForm = {
  company_legal_name: "",
  company_dba: "",
  buyer_first_name: "",
  buyer_last_name: "",
  buyer_email: "",
  buyer_phone: "",
  buyer_title: "",
  billing_cadence: "monthly",
  agreement_acknowledged: false,
  contact_acknowledged: false,
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function purchaseIntentEndpoint(): string {
  return joinUrl(getPublicBackendBase(), "/api/alphascreen/purchase-intents");
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function cleanText(value: string, max: number): string {
  return String(value || "").trim().slice(0, max);
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

function cadenceOptions(plan: AlphaScreenPackage | null): BillingCadence[] {
  const options = (plan?.billing_cadences || []).filter((cadence) => String(cadence.key || "").trim());
  return options.length ? options : [{ key: "monthly", display_name: "Monthly" }];
}

function defaultCadence(plan: AlphaScreenPackage | null): string {
  const options = cadenceOptions(plan);
  return options.find((cadence) => cadence.key === "monthly")?.key || options[0]?.key || "monthly";
}

function cadenceLabel(plan: AlphaScreenPackage | null, key: string): string {
  const match = cadenceOptions(plan).find((cadence) => cadence.key === key);
  return match?.display_name || key || "Billing cadence";
}

function validatePurchaseForm(form: PurchaseIntentForm, selectedPlan: AlphaScreenPackage | null): string {
  if (!selectedPlan) return "Choose Basic or Pro before starting purchase intake.";
  if (!cleanText(form.company_legal_name, 120)) return "Company legal name is required.";
  if (!cleanText(form.buyer_first_name, 80)) return "Buyer first name is required.";
  if (!cleanText(form.buyer_last_name, 80)) return "Buyer last name is required.";
  if (!validEmail(form.buyer_email)) return "Enter a valid work email address.";
  if (!form.agreement_acknowledged) return "Confirm that agreement signing and payment are required before access is activated.";
  if (!form.contact_acknowledged) return "Confirm that alphaSource may contact you about this alphaScreen purchase.";
  return "";
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

function PlanCard({
  plan,
  selected,
  onStart,
}: {
  plan: AlphaScreenPackage;
  selected: boolean;
  onStart: (plan: AlphaScreenPackage) => void;
}) {
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
          onClick={() => onStart(plan)}
          className="w-full rounded-full px-4 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: selected ? "#0A1547" : accent.color }}
          data-analytics-cta={`Start with ${plan.display_name}`}
          data-analytics-placement="pricing-card"
          data-analytics-target="#purchase-intake"
        >
          {selected ? `${plan.display_name} selected` : `Start with ${plan.display_name}`}
        </button>
        <a
          href="#pricing-demo"
          className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent.color }}
          data-analytics-cta={`Request demo for ${plan.display_name}`}
          data-analytics-placement="pricing-card"
          data-analytics-target="#pricing-demo"
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
        href="#pricing-demo"
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#0A1547] transition-opacity hover:opacity-90"
        data-analytics-cta="Contact Sales"
        data-analytics-placement="pricing-enterprise"
        data-analytics-target="#pricing-demo"
      >
        Contact Sales
        <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}

function PurchaseTextField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-[#0A1547]">
        {label}
        {required ? <span className="text-[#A380F6]"> *</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-[#0A1547]/12 bg-white px-4 py-3 text-sm text-[#0A1547] outline-none transition-colors placeholder:text-[#0A1547]/35 focus:border-[#A380F6] focus:ring-2 focus:ring-[#A380F6]/20"
      />
    </label>
  );
}

function PurchaseIntentPanel({
  selectedPlan,
  form,
  status,
  error,
  result,
  onChange,
  onSubmit,
}: {
  selectedPlan: AlphaScreenPackage | null;
  form: PurchaseIntentForm;
  status: PurchaseIntentStatus;
  error: string;
  result: PurchaseIntentResult | null;
  onChange: <K extends keyof PurchaseIntentForm>(field: K, value: PurchaseIntentForm[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!selectedPlan) {
    return (
      <div className="rounded-lg border border-dashed border-[#0A1547]/18 bg-white px-6 py-8 text-center">
        <h3 className="text-xl font-black text-[#0A1547]">Choose Basic or Pro to start purchase intake.</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
          This creates a pending purchase intent for QA. Agreement signing, payment, and account activation remain separate later steps.
        </p>
      </div>
    );
  }

  const included = selectedPlan.included_interviews_per_role || selectedPlan.included_interviews;
  const duration = selectedPlan.max_interview_minutes || selectedPlan.interview_duration_minutes;
  const overage = selectedPlan.additional_interview_fee || selectedPlan.additional_interview_price || selectedPlan.overage_price;
  const options = cadenceOptions(selectedPlan);
  const planName = result?.selected_package?.display_name || selectedPlan.display_name;

  if (status === "success" && result) {
    return (
      <div className="rounded-lg border border-[#02D99D]/35 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#02D99D]/10 text-[#02D99D]">
              <CheckCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02D99D]">
              {result.duplicate ? "Pending intent found" : "Purchase intent received"}
            </p>
            <h3 className="mt-2 text-2xl font-black text-[#0A1547]">{planName} intake is pending.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
              {result.next_step_message || "Next step: membership agreement signing will be prepared in the next step."}
            </p>
          </div>
          <div className="rounded-lg bg-[#F8F9FD] px-4 py-3 text-sm font-bold text-[#0A1547]/65">
            ID: {result.purchase_intent_id}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Package</p>
            <p className="mt-2 text-sm font-black text-[#0A1547]">
              {planName} - {cadenceLabel(selectedPlan, form.billing_cadence)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">
              {included} interviews, {duration}-minute cap, {formatUsd(overage)} additional interviews
            </p>
          </div>
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Company</p>
            <p className="mt-2 text-sm font-black text-[#0A1547]">{form.company_legal_name}</p>
            {form.company_dba ? <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">DBA {form.company_dba}</p> : null}
          </div>
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Buyer</p>
            <p className="mt-2 text-sm font-black text-[#0A1547]">
              {form.buyer_first_name} {form.buyer_last_name}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">{form.buyer_email}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm" data-testid="purchase-intent-form">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Buyer intake</p>
          <h3 className="mt-2 text-2xl font-black text-[#0A1547]">Start with {selectedPlan.display_name}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
            No payment is collected here. This creates a pending purchase intent so the agreement step can be prepared later.
          </p>
        </div>
        <div className="rounded-lg bg-[#F8F9FD] px-4 py-3 text-sm font-bold text-[#0A1547]/65">
          {included} interviews per role - {duration}-minute cap - {formatUsd(overage)} overage
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PurchaseTextField
          label="Company legal name"
          required
          value={form.company_legal_name}
          onChange={(value) => onChange("company_legal_name", value)}
          placeholder="Acme Corporation, Inc."
          maxLength={120}
          autoComplete="organization"
        />
        <PurchaseTextField
          label="DBA"
          value={form.company_dba}
          onChange={(value) => onChange("company_dba", value)}
          placeholder="Optional"
          maxLength={120}
        />
        <PurchaseTextField
          label="First name"
          required
          value={form.buyer_first_name}
          onChange={(value) => onChange("buyer_first_name", value)}
          placeholder="Jane"
          maxLength={80}
          autoComplete="given-name"
        />
        <PurchaseTextField
          label="Last name"
          required
          value={form.buyer_last_name}
          onChange={(value) => onChange("buyer_last_name", value)}
          placeholder="Smith"
          maxLength={80}
          autoComplete="family-name"
        />
        <PurchaseTextField
          label="Work email"
          required
          type="email"
          value={form.buyer_email}
          onChange={(value) => onChange("buyer_email", value)}
          placeholder="jane@company.com"
          maxLength={160}
          autoComplete="email"
        />
        <PurchaseTextField
          label="Phone"
          type="tel"
          value={form.buyer_phone}
          onChange={(value) => onChange("buyer_phone", value)}
          placeholder="Optional"
          maxLength={40}
          autoComplete="tel"
        />
        <PurchaseTextField
          label="Title"
          value={form.buyer_title}
          onChange={(value) => onChange("buyer_title", value)}
          placeholder="Optional"
          maxLength={100}
          autoComplete="organization-title"
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-[#0A1547]">Billing cadence</span>
          <select
            value={form.billing_cadence}
            onChange={(event) => onChange("billing_cadence", event.target.value)}
            className="w-full rounded-lg border border-[#0A1547]/12 bg-white px-4 py-3 text-sm font-bold text-[#0A1547] outline-none transition-colors focus:border-[#A380F6] focus:ring-2 focus:ring-[#A380F6]/20"
          >
            {options.map((cadence) => (
              <option key={String(cadence.key)} value={String(cadence.key)}>
                {cadence.display_name || cadence.key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-3">
        <label className="flex items-start gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 text-sm font-semibold leading-relaxed text-[#0A1547]/70">
          <input
            type="checkbox"
            checked={form.agreement_acknowledged}
            onChange={(event) => onChange("agreement_acknowledged", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#0A1547]/25 text-[#A380F6] focus:ring-[#A380F6]"
          />
          <span>I understand signup requires membership agreement signing and payment before access is activated.</span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 text-sm font-semibold leading-relaxed text-[#0A1547]/70">
          <input
            type="checkbox"
            checked={form.contact_acknowledged}
            onChange={(event) => onChange("contact_acknowledged", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#0A1547]/25 text-[#A380F6] focus:ring-[#A380F6]"
          />
          <span>I agree to be contacted about this alphaScreen purchase.</span>
        </label>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          data-analytics-cta="Submit Purchase Intent"
          data-analytics-placement="purchase-intake"
          data-analytics-target="/alphascreen/pricing#purchase-intake"
        >
          {status === "submitting" ? "Creating pending intent..." : "Create pending purchase intent"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold leading-relaxed text-[#0A1547]/50">
          This QA step does not create an agreement, checkout session, user, client, or membership.
        </p>
      </div>
    </form>
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
  const purchaseFormStartedRef = useRef(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [purchaseForm, setPurchaseForm] = useState<PurchaseIntentForm>(EMPTY_PURCHASE_FORM);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseIntentStatus>("idle");
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseResult, setPurchaseResult] = useState<PurchaseIntentResult | null>(null);

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
  const selectedPlan = useMemo(
    () => planCards.find((plan) => plan.plan_key === selectedPlanKey) || null,
    [planCards, selectedPlanKey],
  );

  const startPurchase = (plan: AlphaScreenPackage) => {
    setSelectedPlanKey(plan.plan_key);
    setPurchaseStatus("idle");
    setPurchaseError("");
    setPurchaseResult(null);
    setPurchaseForm((prev) => ({ ...prev, billing_cadence: defaultCadence(plan) }));
    trackEvent("signup_started", { plan: plan.plan_key, step: "plan_selection" });
    window.setTimeout(() => {
      document.getElementById("purchase-intake")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const updatePurchaseField = <K extends keyof PurchaseIntentForm>(field: K, value: PurchaseIntentForm[K]) => {
    if (!purchaseFormStartedRef.current) {
      purchaseFormStartedRef.current = true;
      trackEvent("lead_form_started", {
        form_id: "alphascreen-purchase-intent",
        form_type: "purchase_intent",
        product_interest: "alphascreen",
        first_field: String(field),
      });
      trackEvent("signup_step_viewed", { plan: selectedPlanKey, step: "buyer_intake" });
    }
    setPurchaseError("");
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePurchaseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validatePurchaseForm(purchaseForm, selectedPlan);
    trackEvent("lead_form_submit_attempted", {
      form_id: "alphascreen-purchase-intent",
      form_type: "purchase_intent",
      product_interest: "alphascreen",
    });

    if (validationMessage || !selectedPlan) {
      setPurchaseError(validationMessage || "Choose Basic or Pro before submitting.");
      trackEvent("lead_form_submit_failed", {
        form_id: "alphascreen-purchase-intent",
        form_type: "purchase_intent",
        product_interest: "alphascreen",
        error_type: "validation",
      });
      return;
    }

    setPurchaseStatus("submitting");
    setPurchaseError("");

    const payload = {
      plan_key: selectedPlan.plan_key,
      billing_cadence: purchaseForm.billing_cadence || defaultCadence(selectedPlan),
      company_legal_name: cleanText(purchaseForm.company_legal_name, 120),
      company_dba: cleanText(purchaseForm.company_dba, 120),
      buyer_first_name: cleanText(purchaseForm.buyer_first_name, 80),
      buyer_last_name: cleanText(purchaseForm.buyer_last_name, 80),
      buyer_email: cleanText(purchaseForm.buyer_email, 160),
      buyer_phone: cleanText(purchaseForm.buyer_phone, 40),
      buyer_title: cleanText(purchaseForm.buyer_title, 100),
      source_path: typeof window !== "undefined" ? window.location.pathname : "/alphascreen/pricing",
      agreement_acknowledged: purchaseForm.agreement_acknowledged,
      contact_acknowledged: purchaseForm.contact_acknowledged,
    };

    try {
      const response = await fetch(purchaseIntentEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({})) as PurchaseIntentResult & {
        detail?: string;
        code?: string;
        error?: string;
      };

      if (!response.ok) {
        const detail = body.detail || (response.status === 429
          ? "Too many purchase intake attempts. Please wait a few minutes and try again."
          : "We could not create this purchase intent. Please try again.");
        setPurchaseStatus("idle");
        setPurchaseError(detail);
        trackEvent("lead_form_submit_failed", {
          form_id: "alphascreen-purchase-intent",
          form_type: "purchase_intent",
          product_interest: "alphascreen",
          error_type: response.status === 429 ? "rate_limited" : "backend",
        });
        return;
      }

      setPurchaseResult(body);
      setPurchaseStatus("success");
      trackEvent("lead_form_submit_succeeded", {
        form_id: "alphascreen-purchase-intent",
        form_type: "purchase_intent",
        product_interest: "alphascreen",
      });
      trackEvent("signup_step_completed", {
        plan: selectedPlan.plan_key,
        step: "purchase_intent",
        completion_percent: 50,
      });
    } catch (_) {
      setPurchaseStatus("idle");
      setPurchaseError("We could not reach the purchase intake service. Please try again.");
      trackEvent("lead_form_submit_failed", {
        form_id: "alphascreen-purchase-intent",
        form_type: "purchase_intent",
        product_interest: "alphascreen",
        error_type: "network",
      });
    }
  };

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
                href="#pricing-demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-base font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
                data-analytics-cta="Request a Demo"
                data-analytics-placement="pricing-hero"
                data-analytics-target="#pricing-demo"
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
              <PlanCard
                key={plan.plan_key}
                plan={plan}
                selected={selectedPlanKey === plan.plan_key}
                onStart={startPurchase}
              />
            ))}
            <EnterpriseCard />
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#0A1547]/55">
            Package details shown here are for planning. Self-serve signup, agreement generation, and Stripe checkout are not active on this page yet.
          </p>
        </div>
      </section>

      <section id="purchase-intake" className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 grid gap-5 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Purchase intake</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">
                Create a pending purchase intent.
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-[#0A1547]/60">
              Basic and Pro buyers can enter company and admin details here. This does not collect payment details or activate access.
            </p>
          </div>
          <PurchaseIntentPanel
            selectedPlan={selectedPlan}
            form={purchaseForm}
            status={purchaseStatus}
            error={purchaseError}
            result={purchaseResult}
            onChange={updatePurchaseField}
            onSubmit={handlePurchaseSubmit}
          />
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

      <section id="pricing-demo" className="bg-white py-16 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[0.9fr_1fr] lg:items-start lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Demo and contact</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">
              Need access before self-serve purchase opens?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
              Request a demo and the alphaSource team can walk through package fit, agreement timing, and current onboarding options.
            </p>
          </div>
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-6 shadow-sm">
            <LeadCaptureForm
              formId="alphascreen-pricing-demo"
              formType="demo"
              formTestId="alphascreen-pricing-demo-form"
              productInterest="alphascreen"
              successTitle="We'll be in touch!"
              successBody="Our team will reach out to discuss alphaScreen package fit."
              ctaLabel="Request pricing demo"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
