import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileSignature,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { SalesEmptyPanel, SalesPageHeading } from "@/components/SalesLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SalesApiError, salesApi } from "@/features/sales/salesApi";
import type { SalesDeal, SalesDealAction, SalesDealStatus } from "@/features/sales/types";

type FilterKey = "all" | "open" | "payment" | "activated" | "attention";

const statusTone: Record<SalesDealStatus, string> = {
  agreement_sent: "border-sky-200 bg-sky-50 text-sky-700",
  signed_payment_needed: "border-amber-200 bg-amber-50 text-amber-700",
  checkout_in_progress: "border-violet-200 bg-violet-50 text-violet-700",
  setup_in_progress: "border-cyan-200 bg-cyan-50 text-cyan-700",
  activated: "border-emerald-200 bg-emerald-50 text-emerald-700",
  needs_attention: "border-red-200 bg-red-50 text-red-700",
  expired: "border-slate-200 bg-slate-50 text-slate-600",
  canceled: "border-slate-200 bg-slate-50 text-slate-500",
};

const actionLabel: Record<SalesDealAction, string> = {
  resend_agreement: "Resend agreement",
  send_payment_reminder: "Send reminder",
  cancel: "Cancel sale",
  start_replacement: "Start replacement",
  escalate: "Escalate",
  view: "View summary",
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatRelativeDate(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function matchesFilter(deal: SalesDeal, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "open") return ["agreement_sent", "signed_payment_needed", "checkout_in_progress", "setup_in_progress"].includes(deal.status);
  if (filter === "payment") return ["signed_payment_needed", "checkout_in_progress"].includes(deal.status);
  if (filter === "activated") return deal.status === "activated";
  return ["needs_attention", "expired"].includes(deal.status);
}

export default function SalesDealsPage() {
  const [location, setLocation] = useLocation();
  const [deals, setDeals] = useState<SalesDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busyAction, setBusyAction] = useState("");

  const loadDeals = async () => {
    setLoading(true);
    setError("");
    try {
      setDeals(await salesApi.listDeals());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Deals could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDeals(); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("sent") === "1") setNotice("Agreement sent. The buyer can now review and sign from their email.");
  }, [location]);

  const counts = useMemo(() => ({
    open: deals.filter((deal) => matchesFilter(deal, "open")).length,
    agreement: deals.filter((deal) => deal.status === "agreement_sent").length,
    payment: deals.filter((deal) => matchesFilter(deal, "payment")).length,
    activated: deals.filter((deal) => deal.status === "activated").length,
  }), [deals]);

  const visibleDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (!matchesFilter(deal, filter)) return false;
      if (!term) return true;
      return [deal.company_legal_name, deal.company_dba, deal.buyer_name, deal.buyer_email, deal.plan_name]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [deals, filter, search]);

  const runAction = async (deal: SalesDeal, action: SalesDealAction) => {
    const key = `${deal.id}:${action}`;
    setBusyAction(key);
    setNotice("");
    setError("");
    try {
      if (action === "resend_agreement") {
        const result = await salesApi.resendAgreement(deal.id);
        setNotice(result.message);
      } else if (action === "send_payment_reminder") {
        const result = await salesApi.sendPaymentReminder(deal.id);
        setNotice(result.message);
      } else if (action === "cancel") {
        const result = await salesApi.cancelDeal(deal.id);
        setDeals((current) => current.map((item) => item.id === result.deal.id ? result.deal : item));
        setNotice(result.message);
      } else if (action === "start_replacement") {
        setLocation("/sales/new");
      } else {
        setLocation(`/sales/deals/${encodeURIComponent(deal.id)}`);
      }
    } catch (actionError) {
      setError(actionError instanceof SalesApiError ? actionError.message : "That action could not be completed.");
    } finally {
      setBusyAction("");
    }
  };

  const statCards = [
    { label: "Open deals", value: counts.open, icon: Clock3, color: "text-[#A380F6]", background: "bg-[#A380F6]/10" },
    { label: "Awaiting signature", value: counts.agreement, icon: FileSignature, color: "text-sky-600", background: "bg-sky-50" },
    { label: "Awaiting payment", value: counts.payment, icon: Mail, color: "text-amber-600", background: "bg-amber-50" },
    { label: "Closed won", value: counts.activated, icon: CheckCircle2, color: "text-emerald-600", background: "bg-emerald-50" },
  ];

  return (
    <div>
      <SalesPageHeading
        eyebrow="Pipeline handoff"
        title="My deals"
        description="Track agreements through signature, payment, and account activation. Closed Won is recorded only after alphaScreen confirms payment and activation."
        action={
          <Link href="/sales/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#A380F6] px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(163,128,246,0.24)] transition hover:bg-[#926dea]">
            <Plus className="h-4 w-4" /> New sale
          </Link>
        }
      />

      {notice ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><XCircle className="h-4 w-4 opacity-60" /></button>
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss"><XCircle className="h-4 w-4 opacity-60" /></button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--as-text-muted)" }}>{stat.label}</p>
                  <p className="mt-2 text-2xl font-black" style={{ color: "var(--as-text)" }}>{loading ? "—" : stat.value}</p>
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${stat.background} ${stat.color}`}><Icon className="h-5 w-5" /></div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--as-border)" }}>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--as-text-subtle)" }} />
            <input aria-label="Search deals by company or buyer" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-[10px] border bg-transparent pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Search company or buyer" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {(["all", "open", "payment", "activated", "attention"] as FilterKey[]).map((key) => (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`whitespace-nowrap rounded-[9px] px-3 py-2 text-xs font-black capitalize transition ${filter === key ? "bg-[#0A1547] text-white" : "hover:bg-[#0A1547]/5"}`} style={filter === key ? undefined : { color: "var(--as-text-muted)" }}>
                {key === "payment" ? "Payment due" : key}
              </button>
            ))}
            <button type="button" onClick={() => void loadDeals()} disabled={loading} className="rounded-[9px] border p-2 transition hover:bg-[#0A1547]/5 disabled:opacity-40" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)" }} aria-label="Refresh deals">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-[74px] animate-pulse rounded-xl bg-[#0A1547]/[0.045]" />)}
          </div>
        ) : visibleDeals.length === 0 ? (
          <div className="p-4"><SalesEmptyPanel title="No deals match this view" detail="Adjust the search or filter, or start a new Essential or Pro sale." /></div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--as-border)" }}>
            {visibleDeals.map((deal) => (
              <article key={deal.id} className="grid gap-4 p-4 transition hover:bg-[#0A1547]/[0.018] sm:p-5 lg:grid-cols-[minmax(260px,1.3fr)_minmax(150px,.65fr)_minmax(180px,.75fr)_minmax(150px,.65fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#0A1547]/[0.055] text-[#0A1547]"><span className="text-xs font-black">{deal.company_legal_name.slice(0, 2).toUpperCase()}</span></div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black" style={{ color: "var(--as-text)" }}>{deal.company_dba || deal.company_legal_name}</h2>
                      <p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{deal.buyer_name} · {deal.buyer_email}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] lg:hidden" style={{ color: "var(--as-text-subtle)" }}>Membership</p>
                  <p className="text-sm font-black" style={{ color: "var(--as-text)" }}>{deal.plan_name}</p>
                  <p className="mt-0.5 text-xs font-semibold capitalize" style={{ color: "var(--as-text-muted)" }}>{deal.billing_cadence} · {formatMoney(deal.initial_payment_cents)} initial</p>
                </div>
                <div>
                  <span className={`inline-flex rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${statusTone[deal.status]}`}>{deal.status_label}</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] lg:hidden" style={{ color: "var(--as-text-subtle)" }}>Last activity</p>
                  <p className="text-xs font-bold" style={{ color: "var(--as-text-muted)" }}>{formatRelativeDate(deal.updated_at)}</p>
                </div>
                <div className="flex items-center gap-2 lg:justify-end">
                  {deal.next_action !== "cancel" ? (
                    <button type="button" onClick={() => void runAction(deal, deal.next_action)} disabled={Boolean(busyAction)} className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] bg-[#0A1547] px-3 text-xs font-black text-white transition hover:bg-[#142365] disabled:opacity-50">
                      {busyAction === `${deal.id}:${deal.next_action}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : deal.next_action === "resend_agreement" ? <Send className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      {actionLabel[deal.next_action]}
                    </button>
                  ) : null}
                  {deal.available_actions.includes("cancel") ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button type="button" disabled={Boolean(busyAction)} className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border px-3 text-xs font-black transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)" }} aria-label={`Cancel unpaid sale for ${deal.company_legal_name}`}>
                          Cancel
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-[#0A1547]/10 bg-white font-sans text-[#0A1547] shadow-[0_24px_80px_rgba(10,21,71,0.22)] sm:rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-black">Cancel this unpaid sale?</AlertDialogTitle>
                          <AlertDialogDescription className="font-semibold leading-relaxed text-[#0A1547]/55">
                            The buyer will no longer be able to continue this agreement or checkout. Paid agreements require administrator handling.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-[9px] font-black">Keep sale</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void runAction(deal, "cancel")} className="rounded-[9px] bg-red-600 font-black text-white hover:bg-red-700">Cancel unpaid sale</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
