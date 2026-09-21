import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileText,
  Percent,
  Plus,
  RefreshCw,
  Upload,
  WalletCards,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

interface Representative {
  user_id: string;
  email: string;
  display_name: string;
  active: boolean;
}

interface PayrollTotals {
  closed_won_count: number;
  gross_membership_cents: number;
  discounts_cents: number;
  net_membership_cents: number;
  deductions_cents: number;
  credits_cents: number;
  adjusted_net_membership_cents: number;
  commission_cents: number;
}

interface PayrollSale {
  id: string;
  activated_at: string | null;
  label: string;
  company_name: string;
  buyer_name: string;
  buyer_email: string;
  plan_key: string;
  billing_cadence: string;
  representative: Representative;
  annualization_multiplier: number;
  gross_membership_cents: number;
  discount_cents: number;
  net_membership_cents: number;
  commission_eligible: boolean;
  commission_cents: number;
}

interface PayrollAdjustment {
  id: string;
  effective_at: string | null;
  adjustment_type: string;
  direction: "deduction" | "credit";
  amount_cents: number;
  signed_membership_cents: number;
  commission_impact_cents: number;
  reason: string;
  representative: Representative;
  related_sale: { id: string; label: string } | null;
  document: { available: boolean; filename: string; content_type: string; size_bytes: number } | null;
  created_by_email: string;
  created_at: string | null;
}

interface PayrollPayload {
  generated_at: string;
  commission_rate: number;
  policy: {
    basis: string;
    monthly_annualization_multiplier: number;
    excluded: string[];
    adjustment_period_basis: string;
    time_zone: string;
    rounding_basis: string;
  };
  filters: { date_from: string; date_to: string; representative_user_id: string | null };
  summary: PayrollTotals;
  representatives: Representative[];
  by_representative: Array<PayrollTotals & { representative: Representative }>;
  sales: PayrollSale[];
  related_sales: Array<{ id: string; label: string; activated_at: string | null; representative: Representative }>;
  adjustments: PayrollAdjustment[];
}

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value || "").trim().replace(/\/+$/, "");
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);
const PAYROLL_TIME_ZONE = "America/Denver";

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const fieldStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};

function localDateString(date = new Date(), timeZone = PAYROLL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function currentMonthStart(): string {
  return `${localDateString().slice(0, 8)}01`;
}

function formatMoney(cents: unknown): string {
  const numeric = Number(cents);
  if (!Number.isFinite(numeric)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric / 100);
}

function formatDate(value: unknown, timeZone = PAYROLL_TIME_ZONE): string {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", { timeZone, year: "numeric", month: "short", day: "numeric" });
}

function titleCase(value: unknown): string {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractErrorMessage(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    return String(parsed.detail || parsed.message || parsed.error || fallback);
  } catch {
    return fallback;
  }
}

function dollarsToCents(value: string): number | null {
  const normalized = value.trim().replace(/[$,]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function SummaryCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof WalletCards;
  tone: string;
}) {
  return (
    <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={subtleTextStyle}>{label}</p>
          <p className="mt-2 text-2xl font-black" style={primaryTextStyle}>{value}</p>
          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{detail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${tone}18`, color: tone }}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

export default function AdminSalesPayrollPage() {
  const [dateFrom, setDateFrom] = useState(currentMonthStart);
  const [dateTo, setDateTo] = useState(localDateString);
  const [representativeId, setRepresentativeId] = useState("");
  const [payload, setPayload] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentRepId, setAdjustmentRepId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("manual_adjustment");
  const [direction, setDirection] = useState<"deduction" | "credit">("deduction");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(localDateString);
  const [relatedSaleId, setRelatedSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [openingDocumentId, setOpeningDocumentId] = useState("");

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  }, []);

  const loadPayroll = useCallback(async () => {
    if (!backendBase) {
      setError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (representativeId) params.set("representative_user_id", representativeId);
      const response = await fetch(`${backendBase}/admin/sales-payroll?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not load sales payroll."));
      const nextPayload = JSON.parse(text) as PayrollPayload;
      setPayload(nextPayload);
      setAdjustmentRepId((current) => current || nextPayload.representatives.find((rep) => rep.active)?.user_id || "");
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load sales payroll.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, getToken, representativeId]);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll]);

  const relatedSales = useMemo(
    () => (payload?.related_sales || []).filter((sale) => !adjustmentRepId || sale.representative.user_id === adjustmentRepId),
    [adjustmentRepId, payload?.related_sales],
  );

  const resetAdjustmentForm = useCallback(() => {
    setAdjustmentType("manual_adjustment");
    setDirection("deduction");
    setAmount("");
    setEffectiveDate(localDateString());
    setRelatedSaleId("");
    setReason("");
    setDocumentFile(null);
    setFileInputKey((value) => value + 1);
  }, []);

  const submitAdjustment = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");
    const amountCents = dollarsToCents(amount);
    if (amountCents == null) {
      setFormError("Enter an amount greater than zero with no more than two decimal places.");
      return;
    }
    if (!adjustmentRepId) {
      setFormError("Select a sales representative.");
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.set("sales_rep_user_id", adjustmentRepId);
      form.set("adjustment_type", adjustmentType);
      form.set("direction", direction);
      form.set("amount_cents", String(amountCents));
      form.set("effective_date", effectiveDate);
      form.set("reason", reason);
      if (relatedSaleId) form.set("purchase_intent_id", relatedSaleId);
      if (documentFile) form.set("documentation", documentFile);
      const response = await fetch(`${backendBase}/admin/sales-payroll/adjustments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not save the payroll adjustment."));
      resetAdjustmentForm();
      setFormSuccess("Adjustment saved and included in the selected period when its effective date falls within the range.");
      await loadPayroll();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Could not save the payroll adjustment.");
    } finally {
      setSaving(false);
    }
  }, [adjustmentRepId, adjustmentType, amount, direction, documentFile, effectiveDate, getToken, loadPayroll, reason, relatedSaleId, resetAdjustmentForm]);

  const openDocument = useCallback(async (adjustmentId: string) => {
    setOpeningDocumentId(adjustmentId);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`${backendBase}/admin/sales-payroll/adjustments/${encodeURIComponent(adjustmentId)}/document`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not open the supporting document."));
      const result = JSON.parse(text) as { document?: { url?: string } };
      if (!result.document?.url) throw new Error("The document link was not returned.");
      window.open(result.document.url, "_blank", "noopener,noreferrer");
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : "Could not open the supporting document.");
    } finally {
      setOpeningDocumentId("");
    }
  }, [getToken]);

  const exportCsv = useCallback(() => {
    if (!payload) return;
    const header = ["Record type", "Effective date", "Representative", "Company or reason", "Plan", "Cadence", "Gross membership", "Discount", "Credit", "Deduction", "Net membership", "Commission"];
    const rows: unknown[][] = [];
    for (const sale of payload.sales) {
      rows.push(["Sale", sale.activated_at ? localDateString(new Date(sale.activated_at), payload.policy.time_zone) : "", sale.representative.display_name, sale.label, titleCase(sale.plan_key), titleCase(sale.billing_cadence), sale.gross_membership_cents / 100, sale.discount_cents / 100, 0, 0, sale.net_membership_cents / 100, sale.commission_cents / 100]);
    }
    for (const adjustment of payload.adjustments) {
      rows.push([titleCase(adjustment.adjustment_type), adjustment.effective_at ? localDateString(new Date(adjustment.effective_at), payload.policy.time_zone) : "", adjustment.representative.display_name, adjustment.reason, "", "", 0, 0, adjustment.direction === "credit" ? adjustment.amount_cents / 100 : 0, adjustment.direction === "deduction" ? adjustment.amount_cents / 100 : 0, adjustment.signed_membership_cents / 100, adjustment.commission_impact_cents / 100]);
    }
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `alphascreen-sales-payroll-${dateFrom}-to-${dateTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [dateFrom, dateTo, payload]);

  const summary = payload?.summary;

  return (
    <AdminLayout title="Sales Payroll">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={subtleTextStyle}>Admin only</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={primaryTextStyle}>Sales Payroll</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              Calculate contractor commission from activated alphaScreen memberships and record later credits or deductions in the period when they occur.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} disabled={!payload || loading} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black disabled:opacity-50" style={fieldStyle}>
              <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
            </button>
            <button type="button" onClick={() => setShowAdjustment((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#0A1547] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#111f5c]">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add adjustment
            </button>
          </div>
        </section>

        <section className="rounded-2xl border p-4" style={surfaceCardStyle} aria-label="Payroll filters">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
            <label className="block text-xs font-black" style={primaryTextStyle}>
              Start date
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]" style={fieldStyle} />
            </label>
            <label className="block text-xs font-black" style={primaryTextStyle}>
              End date
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]" style={fieldStyle} />
            </label>
            <label className="block text-xs font-black" style={primaryTextStyle}>
              Sales representative
              <select value={representativeId} onChange={(event) => setRepresentativeId(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]" style={fieldStyle}>
                <option value="">All representatives</option>
                {(payload?.representatives || []).map((rep) => <option key={rep.user_id} value={rep.user_id}>{rep.display_name}{rep.active ? "" : " (inactive)"}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void loadPayroll()} disabled={loading} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black disabled:opacity-50" style={fieldStyle}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold" style={mutedTextStyle}>Period boundaries use {payload?.policy.time_zone || "America/Denver"}.</p>
        </section>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" /> {error}
          </div>
        ) : null}

        {showAdjustment ? (
          <form onSubmit={submitAdjustment} className="rounded-2xl border p-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black" style={primaryTextStyle}>Add payroll adjustment</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>Enter the adjustment amount. The report applies the 50% commission impact automatically. Records remain in the audit history; correct an error with an offsetting entry.</p>
              </div>
              <button type="button" onClick={() => setShowAdjustment(false)} className="self-start text-xs font-black text-[#7C5FCC]">Close</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-black" style={primaryTextStyle}>Representative
                <select required value={adjustmentRepId} onChange={(event) => { setAdjustmentRepId(event.target.value); setRelatedSaleId(""); }} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold" style={fieldStyle}>
                  <option value="">Select representative</option>
                  {(payload?.representatives || []).map((rep) => <option key={rep.user_id} value={rep.user_id}>{rep.display_name}{rep.active ? "" : " (inactive)"}</option>)}
                </select>
              </label>
              <label className="text-xs font-black" style={primaryTextStyle}>Type
                <select required value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold" style={fieldStyle}>
                  <option value="cancellation">Cancellation</option>
                  <option value="refund">Refund</option>
                  <option value="chargeback">Chargeback</option>
                  <option value="manual_adjustment">Manual adjustment</option>
                </select>
              </label>
              <label className="text-xs font-black" style={primaryTextStyle}>Effect
                <select required value={direction} onChange={(event) => setDirection(event.target.value as "deduction" | "credit")} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold" style={fieldStyle}>
                  <option value="deduction">Deduction</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
              <label className="text-xs font-black" style={primaryTextStyle}>Adjustment amount
                <div className="mt-1.5 flex rounded-xl border" style={fieldStyle}><span className="px-3 py-2.5 text-sm font-black" style={mutedTextStyle}>$</span><input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm font-semibold outline-none" /></div>
              </label>
              <label className="text-xs font-black" style={primaryTextStyle}>Effective date
                <input required type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold" style={fieldStyle} />
              </label>
              <label className="text-xs font-black md:col-span-1 xl:col-span-2" style={primaryTextStyle}>Related sale <span className="font-semibold" style={mutedTextStyle}>(optional, 500 most recent)</span>
                <select value={relatedSaleId} onChange={(event) => setRelatedSaleId(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold" style={fieldStyle}>
                  <option value="">No linked sale</option>
                  {relatedSales.map((sale) => <option key={sale.id} value={sale.id}>{sale.label} · {formatDate(sale.activated_at)}</option>)}
                </select>
              </label>
              <label className="text-xs font-black" style={primaryTextStyle}>Supporting file <span className="font-semibold" style={mutedTextStyle}>(optional)</span>
                <input key={fileInputKey} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.doc,.docx" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-xs font-semibold file:mr-3 file:rounded-lg file:border-0 file:bg-[#A380F6]/10 file:px-3 file:py-2 file:font-black file:text-[#7C5FCC]" style={mutedTextStyle} />
              </label>
              <label className="text-xs font-black md:col-span-2 xl:col-span-4" style={primaryTextStyle}>Reason
                <textarea required minLength={3} maxLength={2000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the cancellation, refund, chargeback, or other correction." className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]" style={fieldStyle} />
              </label>
            </div>
            {formError ? <p className="mt-4 text-sm font-bold text-rose-600" role="alert">{formError}</p> : null}
            {formSuccess ? <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-600" role="status"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{formSuccess}</p> : null}
            <div className="mt-5 flex justify-end">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#02D99D] px-5 py-2.5 text-sm font-black text-[#071033] disabled:opacity-50">
                <Upload className="h-4 w-4" aria-hidden="true" /> {saving ? "Saving…" : "Save adjustment"}
              </button>
            </div>
          </form>
        ) : null}

        {loading && !payload ? <p className="flex items-center gap-2 text-sm font-bold" style={mutedTextStyle} role="status"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />Loading payroll report…</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-busy={loading && !payload}>
          <SummaryCard label="Closed memberships" value={!payload ? "—" : String(summary?.closed_won_count || 0)} detail={!payload ? (loading ? "Loading report…" : "Report unavailable") : "Activated in this period"} icon={CheckCircle2} tone="#02A77E" />
          <SummaryCard label="Annual membership" value={!payload ? "—" : formatMoney(summary?.gross_membership_cents || 0)} detail={!payload ? (loading ? "Loading report…" : "Report unavailable") : "Platform fees before discounts"} icon={WalletCards} tone="#0A1547" />
          <SummaryCard label="Discounts" value={!payload ? "—" : formatMoney(summary?.discounts_cents || 0)} detail={!payload ? (loading ? "Loading report…" : "Report unavailable") : "Annualized membership discounts"} icon={Percent} tone="#D97706" />
          <SummaryCard label="Net adjustments" value={!payload ? "—" : formatMoney((summary?.credits_cents || 0) - (summary?.deductions_cents || 0))} detail={!payload ? (loading ? "Loading report…" : "Report unavailable") : `${formatMoney(summary?.credits_cents || 0)} credits · ${formatMoney(summary?.deductions_cents || 0)} deductions`} icon={(summary?.credits_cents || 0) >= (summary?.deductions_cents || 0) ? ArrowUpRight : ArrowDownRight} tone="#7C5FCC" />
          <SummaryCard label="Commission due" value={!payload ? "—" : formatMoney(summary?.commission_cents || 0)} detail={!payload ? (loading ? "Loading report…" : "Report unavailable") : "Sum of each record’s 50% commission"} icon={WalletCards} tone="#02A77E" />
        </div>

        <section className="overflow-hidden rounded-2xl border" style={surfaceCardStyle}>
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--as-border)" }}>
            <h2 className="text-lg font-black" style={primaryTextStyle}>Commission by representative</h2>
            <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Role fees, interview fees, and first-role prepayment are excluded.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="text-[10px] font-black uppercase tracking-wider" style={subtleTextStyle}>
                <th className="px-5 py-3">Representative</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Discounts</th><th className="px-4 py-3 text-right">Adjustments</th><th className="px-5 py-3 text-right">Commission</th>
              </tr></thead>
              <tbody>
                {(payload?.by_representative || []).map((row) => (
                  <tr key={row.representative.user_id} className="border-t" style={{ borderColor: "var(--as-border)" }}>
                    <td className="px-5 py-4"><p className="font-black" style={primaryTextStyle}>{row.representative.display_name}</p><p className="mt-0.5 text-xs font-semibold" style={mutedTextStyle}>{row.representative.email}</p></td>
                    <td className="px-4 py-4 text-right font-bold" style={primaryTextStyle}>{row.closed_won_count}</td>
                    <td className="px-4 py-4 text-right font-bold" style={primaryTextStyle}>{formatMoney(row.gross_membership_cents)}</td>
                    <td className="px-4 py-4 text-right font-bold text-amber-700 dark:text-amber-300">{formatMoney(row.discounts_cents)}</td>
                    <td className="px-4 py-4 text-right font-bold" style={primaryTextStyle}>{formatMoney(row.credits_cents - row.deductions_cents)}</td>
                    <td className="px-5 py-4 text-right text-base font-black text-emerald-700 dark:text-emerald-300">{formatMoney(row.commission_cents)}</td>
                  </tr>
                ))}
                {!loading && (payload?.by_representative || []).length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-sm font-semibold" style={mutedTextStyle}>No sales or adjustments in this period.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border" style={surfaceCardStyle}>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--as-border)" }}><h2 className="text-lg font-black" style={primaryTextStyle}>Membership sales</h2></div>
            <div className="divide-y" style={{ borderColor: "var(--as-border)" }}>
              {(payload?.sales || []).map((sale) => (
                <article key={sale.id} className="p-5">
                  <div className="flex items-start justify-between gap-4"><div><p className="font-black" style={primaryTextStyle}>{sale.label}</p><p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{sale.representative.display_name} · {titleCase(sale.plan_key)} {titleCase(sale.billing_cadence)} · {formatDate(sale.activated_at)}</p></div><div className="text-right"><p className="font-black text-emerald-700 dark:text-emerald-300">{formatMoney(sale.commission_cents)}</p>{!sale.commission_eligible ? <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em]" style={subtleTextStyle}>Not commissionable</p> : null}</div></div>
                  <p className="mt-3 text-xs font-semibold" style={mutedTextStyle}>{formatMoney(sale.gross_membership_cents)} gross − {formatMoney(sale.discount_cents)} discount = {formatMoney(sale.net_membership_cents)} net</p>
                </article>
              ))}
              {!loading && (payload?.sales || []).length === 0 ? <p className="p-8 text-center text-sm font-semibold" style={mutedTextStyle}>No activated memberships in this period.</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border" style={surfaceCardStyle}>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--as-border)" }}><h2 className="text-lg font-black" style={primaryTextStyle}>Adjustments</h2></div>
            <div className="divide-y" style={{ borderColor: "var(--as-border)" }}>
              {(payload?.adjustments || []).map((adjustment) => (
                <article key={adjustment.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="font-black" style={primaryTextStyle}>{titleCase(adjustment.adjustment_type)}</p><p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{adjustment.representative.display_name} · {formatDate(adjustment.effective_at)}</p></div>
                    <p className={`text-right font-black ${adjustment.direction === "credit" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{adjustment.direction === "credit" ? "+" : "−"}{formatMoney(adjustment.amount_cents)}<span className="block text-[10px] font-bold">{adjustment.direction === "credit" ? "+" : "−"}{formatMoney(Math.abs(adjustment.commission_impact_cents))} commission</span></p>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-relaxed" style={primaryTextStyle}>{adjustment.reason}</p>
                  {adjustment.document ? <button type="button" onClick={() => void openDocument(adjustment.id)} disabled={openingDocumentId === adjustment.id} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#7C5FCC] disabled:opacity-50"><FileText className="h-4 w-4" aria-hidden="true" />{openingDocumentId === adjustment.id ? "Opening…" : adjustment.document.filename}</button> : null}
                </article>
              ))}
              {!loading && (payload?.adjustments || []).length === 0 ? <p className="p-8 text-center text-sm font-semibold" style={mutedTextStyle}>No adjustments in this period.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
