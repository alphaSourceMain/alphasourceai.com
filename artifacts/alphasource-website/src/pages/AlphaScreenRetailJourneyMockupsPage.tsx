import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  LogIn,
  MousePointerClick,
  ShieldCheck,
  X,
} from "lucide-react";

const PRICING_HREF = "/alphascreen/pricing";
const CHECKOUT_START_HREF = "/alphascreen/pricing#packages";
const HOW_IT_WORKS_HREF = "/alphascreen/how-it-works";
const CANDIDATE_EXPERIENCE_HREF = "/alphascreen/candidate-experience";

const journeySteps = [
  {
    label: "Choose a plan",
    body: "Compare Basic, Pro, or Enterprise before starting membership signup.",
    icon: CreditCard,
  },
  {
    label: "Sign agreement",
    body: "Review terms before payment is collected.",
    icon: FileSignature,
  },
  {
    label: "Checkout",
    body: "Continue through secure Stripe Checkout after signing.",
    icon: ShieldCheck,
  },
  {
    label: "Create your first role",
    body: "Finish setup, sign in, and configure the first hiring workflow.",
    icon: LayoutDashboard,
  },
];

function QaBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-[#02ABE0]/25 bg-[#02ABE0]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]">
      QA mockup only
    </span>
  );
}

function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
}) {
  const classes = {
    primary:
      "bg-[#0A1547] text-white hover:bg-[#152569] focus-visible:ring-[#A380F6]",
    secondary:
      "border border-[#0A1547]/12 bg-white text-[#0A1547] hover:border-[#A380F6] hover:text-[#A380F6] focus-visible:ring-[#A380F6]",
    quiet:
      "border border-[#0A1547]/10 bg-[#F8F9FD] text-[#0A1547]/70 hover:border-[#02ABE0] hover:text-[#02ABE0] focus-visible:ring-[#02ABE0]",
  }[variant];

  return (
    <a
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${classes}`}
    >
      {children}
    </a>
  );
}

function MockupShell({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-[#0A1547]/10 bg-white shadow-sm">
      <div className="border-b border-[#0A1547]/8 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#02ABE0]">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-black leading-tight text-[#0A1547]">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#0A1547]/60">{summary}</p>
      </div>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </article>
  );
}

function PersistentCtaBarMockup() {
  return (
    <MockupShell
      eyebrow="Option 1"
      title="Persistent alphaScreen CTA bar"
      summary="A slim buyer path that stays visible on alphaScreen public pages without competing with page content."
    >
      <div className="overflow-hidden rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD]">
        <div className="flex items-center justify-between gap-3 border-b border-[#0A1547]/8 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/alpha-symbol.png" alt="" className="h-7 w-7" />
            <span className="text-sm font-black text-[#0A1547]">alphaScreen</span>
          </div>
          <span className="rounded-full border border-[#0A1547]/10 px-3 py-1 text-xs font-black text-[#0A1547]/55">
            Public page
          </span>
        </div>

        <div className="border-b border-[#0A1547]/8 bg-white/95 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#0A1547]">alphaScreen for dental hiring</p>
              <p className="text-xs font-semibold text-[#0A1547]/55">Compare memberships or start the signup path.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={PRICING_HREF}
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#0A1547]/10 bg-white px-4 py-2 text-xs font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
              >
                View pricing
              </a>
              <a
                href={CHECKOUT_START_HREF}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#0A1547] px-4 py-2 text-xs font-black text-white transition-opacity hover:opacity-90"
              >
                Start checkout
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="h-5 w-1/2 rounded bg-[#0A1547]/12" />
          <div className="h-3 w-full rounded bg-[#0A1547]/8" />
          <div className="h-3 w-5/6 rounded bg-[#0A1547]/8" />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="h-20 rounded-lg bg-white" />
            <div className="h-20 rounded-lg bg-white" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#02D99D]/25 bg-[#02D99D]/10 p-4">
        <p className="text-sm font-semibold leading-relaxed text-[#0A1547]/70">
          Later implementation path: render below the global header only on alphaScreen public routes,
          hide on pricing/checkout steps if it duplicates the active path, and keep it compact on mobile.
        </p>
      </div>
    </MockupShell>
  );
}

function StrongHeroCtaMockup() {
  return (
    <MockupShell
      eyebrow="Option 2"
      title="Stronger hero CTA treatment"
      summary="Make the above-the-fold buyer action obvious while preserving a learning path for evaluators."
    >
      <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-5">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#A380F6]/25 bg-white px-3 py-1.5 text-xs font-black text-[#A380F6]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#02D99D]" />
          AI screening for hiring teams
        </div>
        <h3 className="max-w-xl text-3xl font-black leading-[1.05] text-[#0A1547]">
          alphaScreen for dental hiring, from pricing to first role.
        </h3>
        <p className="mt-4 max-w-xl text-sm font-semibold leading-relaxed text-[#0A1547]/65">
          Compare memberships, sign the agreement, complete checkout, and create a role from one clear public path.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LinkButton href={PRICING_HREF}>
            View pricing
            <ArrowRight className="h-4 w-4" />
          </LinkButton>
          <LinkButton href={HOW_IT_WORKS_HREF} variant="secondary">
            See how it works
          </LinkButton>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={CANDIDATE_EXPERIENCE_HREF}
            className="text-xs font-black text-[#0A1547]/55 underline decoration-[#A380F6]/35 underline-offset-4 transition-colors hover:text-[#A380F6]"
          >
            Review candidate experience
          </a>
          <span className="text-xs font-semibold text-[#0A1547]/35">Basic and Pro self-serve signup starts on pricing.</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {["Pricing first", "Learning second", "No below-fold hunt"].map((label) => (
          <div key={label} className="rounded-lg border border-[#0A1547]/10 bg-white p-3">
            <CheckCircle className="h-4 w-4 text-[#02D99D]" />
            <p className="mt-2 text-xs font-black text-[#0A1547]">{label}</p>
          </div>
        ))}
      </div>
    </MockupShell>
  );
}

function PurchaseJourneyCardMockup() {
  return (
    <MockupShell
      eyebrow="Option 3"
      title="Compact journey card"
      summary="A reusable readiness card for the landing page and supporting pages."
    >
      <div className="rounded-lg border border-[#0A1547]/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A380F6]">Ready to get started?</p>
        <h3 className="mt-2 text-2xl font-black leading-tight text-[#0A1547]">
          From plan selection to first role in four steps.
        </h3>
        <div className="mt-5 grid gap-3">
          {journeySteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="grid grid-cols-[auto_1fr] gap-3 rounded-lg bg-[#F8F9FD] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1547] text-xs font-black text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#02ABE0]" />
                    <p className="text-sm font-black text-[#0A1547]">{step.label}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#0A1547]/55">{step.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5">
          <LinkButton href={PRICING_HREF}>
            View pricing and start
            <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </div>
      </div>
    </MockupShell>
  );
}

function SignInSpotlightMockup() {
  const tooltipId = useId();
  const [visible, setVisible] = useState(true);
  const [signInClicked, setSignInClicked] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;

    const timer = window.setTimeout(() => setVisible(false), 3000);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible]);

  const replay = () => {
    setSignInClicked(false);
    setVisible(false);
    window.setTimeout(() => setVisible(true), 20);
  };

  return (
    <section className="mt-8 rounded-lg border border-[#0A1547]/10 bg-white p-5 shadow-sm lg:p-6">
      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#02ABE0]">Option 4</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-[#0A1547]">
            Post-password sign-in spotlight
          </h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
            Concept trigger: <span className="font-black text-[#0A1547]">/?setup=complete</span>. The demo dims the page,
            points at Sign In, auto-dismisses after about 3 seconds, dismisses on click or Escape,
            and keeps the Sign In button clickable.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#0A1547] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#152569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6] focus-visible:ring-offset-2"
            >
              <MousePointerClick className="h-4 w-4" />
              Replay spotlight
            </button>
            <span
              aria-live="polite"
              className="inline-flex min-h-10 items-center rounded-full border border-[#0A1547]/10 bg-[#F8F9FD] px-4 py-2 text-xs font-black text-[#0A1547]/65"
            >
              {signInClicked ? "Sign In remained clickable" : visible ? "Spotlight visible" : "Spotlight dismissed"}
            </span>
          </div>
        </div>

        <div
          className="relative min-h-[360px] overflow-hidden rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD]"
          onClick={() => {
            if (visible) setVisible(false);
          }}
        >
          <div className="relative z-10 flex items-center justify-between border-b border-[#0A1547]/8 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <img src="/alpha-symbol.png" alt="" className="h-8 w-8" />
              <span className="text-sm font-black text-[#0A1547]">alphaSource AI</span>
            </div>
            <button
              type="button"
              aria-describedby={visible ? tooltipId : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setSignInClicked(true);
                setVisible(false);
              }}
              className={`relative z-30 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6] focus-visible:ring-offset-2 ${
                visible
                  ? "border-[#A380F6] text-[#0A1547] shadow-[0_0_0_6px_rgba(163,128,246,0.20)]"
                  : "border-[#0A1547]/12 text-[#0A1547]"
              }`}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="h-8 w-3/4 rounded bg-[#0A1547]/15" />
              <div className="mt-4 h-3 w-full rounded bg-[#0A1547]/10" />
              <div className="mt-2 h-3 w-5/6 rounded bg-[#0A1547]/10" />
              <div className="mt-6 flex gap-2">
                <div className="h-10 w-32 rounded-full bg-[#0A1547]/15" />
                <div className="h-10 w-28 rounded-full bg-white" />
              </div>
            </div>
            <div className="rounded-lg border border-[#0A1547]/8 bg-white p-4">
              <div className="h-4 w-1/2 rounded bg-[#0A1547]/12" />
              <div className="mt-4 grid gap-2">
                <div className="h-12 rounded bg-[#F8F9FD]" />
                <div className="h-12 rounded bg-[#F8F9FD]" />
                <div className="h-12 rounded bg-[#F8F9FD]" />
              </div>
            </div>
          </div>

          {visible ? (
            <>
              <div className="absolute inset-0 z-20 bg-[#0A1547]/25 backdrop-blur-[1px] pointer-events-none" aria-hidden="true" />
              <div
                id={tooltipId}
                role="status"
                className="absolute right-4 top-[4.7rem] z-40 max-w-[19rem] rounded-lg border border-[#A380F6]/35 bg-white p-4 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#02D99D]" />
                  <div>
                    <p className="text-sm font-black leading-snug text-[#0A1547]">
                      Your password is set.
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-[#0A1547]/65">
                      Use Sign In to access your alphaScreen dashboard.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisible(false)}
                    className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#0A1547]/10 text-[#0A1547]/55 transition-colors hover:border-[#A380F6] hover:text-[#A380F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]"
                    aria-label="Dismiss sign-in spotlight"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function AlphaScreenRetailJourneyMockupsPage() {
  return (
    <div className="bg-[#F8F9FD]">
      <section className="border-b border-[#0A1547]/8 bg-white px-6 pt-28 pb-10 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <QaBadge />
          <div className="mt-5 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-black leading-tight text-[#0A1547] lg:text-5xl">
                alphaScreen retail purchase journey mockups
              </h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-relaxed text-[#0A1547]/65">
                Isolated QA concepts for clearer purchase CTAs and post-password sign-in guidance.
                These screens do not change checkout, Stripe, backend behavior, password setup, navigation, or production page content.
              </p>
            </div>
            <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A380F6]">Later implementation target</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#0A1547]/65">
                Keep one buyer path consistently visible: pricing as the primary public destination,
                agreement as the next step, checkout after signing, then Sign In after password setup.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 xl:grid-cols-3">
            <PersistentCtaBarMockup />
            <StrongHeroCtaMockup />
            <PurchaseJourneyCardMockup />
          </div>
          <SignInSpotlightMockup />
        </div>
      </section>
    </div>
  );
}
