import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Clipboard,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserRoundX,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

const env = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}) as Record<string, unknown>;
const backendBase = [env.VITE_BACKEND_URL, env.VITE_API_URL, env.VITE_PUBLIC_BACKEND_URL]
  .map((value) => String(value || "").trim().replace(/\/+$/, ""))
  .find(Boolean) || "";

type MemberStatus = "draft" | "active" | "inactive";
type JobStatus = "queued" | "running" | "synced" | "not_applicable" | "action_required" | "failed";

interface TeamMember {
  id: string;
  sales_rep_user_id: string | null;
  display_name: string;
  workspace_email: string | null;
  mobile_phone_e164: string | null;
  ghl_user_id: string | null;
  slack_user_id: string | null;
  status: MemberStatus;
  active_from: string | null;
  inactive_at: string | null;
  updated_at: string;
}

interface PhoneNumber {
  id: string;
  e164: string;
  label: string | null;
  a2p_status: string;
  active: boolean;
  xai_agent_id: string | null;
  xai_phone_number_e164: string | null;
  ghl_location_id: string | null;
  ghl_routing_workflow_id: string | null;
  ghl_notification_workflow_id: string | null;
  ghl_mobile_custom_value_id: string | null;
  ghl_mobile_custom_value_name: string | null;
  ghl_user_custom_value_id: string | null;
  ghl_user_custom_value_name: string | null;
  xai_setup_status: "pending" | "verified" | "failed";
  ghl_setup_status: "pending" | "verified" | "failed";
  xai_verified_at: string | null;
  xai_verification_reference: string | null;
  handoff_token_rotated_at: string | null;
}

interface Assignment {
  id: string;
  phone_number_id: string;
  xai_agent_id: string | null;
  xai_phone_number_e164: string | null;
  handoff_token_rotated_at: string | null;
  ghl_location_id: string | null;
  ghl_notification_workflow_id: string | null;
  ring_seconds: number;
  call_connect_required: boolean;
  transfer_enabled: boolean;
  backup_transfer_phone_e164: string | null;
  status: MemberStatus;
}

interface VoiceConfig {
  id: string;
  version: number;
  status: "draft" | "applied" | "superseded";
  voice_id: string;
  greeting_override: string | null;
  approved_context: string;
  timezone: string;
  business_hours: Record<string, unknown>;
  answer_approved_faqs: boolean;
  schedule_demos: boolean;
  notify_slack: boolean;
  notify_sms: boolean;
  notify_email: boolean;
  generated_prompt: string;
  prompt_checksum: string;
}

interface SyncJob {
  id: string;
  provider: "sales_dashboard" | "ghl" | "xai" | "slack";
  operation: string;
  status: JobStatus;
  provider_reference: string | null;
  last_error_detail: string | null;
  created_at: string;
}

interface TeamRecord {
  member: TeamMember;
  assignment: Assignment | null;
  phone: PhoneNumber | null;
  config: VoiceConfig | null;
  applied_assignment?: Assignment | null;
  applied_phone?: PhoneNumber | null;
  readiness: { ready: boolean; missing: string[] };
  sync_jobs: SyncJob[];
  pending_draft?: { updated_at: string } | null;
}

interface TeamPayload {
  items: TeamRecord[];
  phone_numbers: PhoneNumber[];
  agent_bootstrap_prompt: string;
}

interface FormState {
  display_name: string;
  workspace_email: string;
  mobile_phone_e164: string;
  sales_rep_user_id: string;
  ghl_user_id: string;
  slack_user_id: string;
  phone_number_id: string;
  xai_agent_id: string;
  xai_phone_number_e164: string;
  ghl_location_id: string;
  ghl_notification_workflow_id: string;
  ghl_routing_workflow_id: string;
  ghl_mobile_custom_value_id: string;
  ghl_mobile_custom_value_name: string;
  ghl_user_custom_value_id: string;
  ghl_user_custom_value_name: string;
  xai_setup_status: "pending" | "verified" | "failed";
  ghl_setup_status: "pending" | "verified" | "failed";
  xai_verification_reference: string;
  ring_seconds: number;
  transfer_enabled: boolean;
  backup_transfer_phone_e164: string;
  voice_id: string;
  greeting_override: string;
  approved_context: string;
  timezone: string;
  business_hours_summary: string;
  answer_approved_faqs: boolean;
  schedule_demos: boolean;
  notify_slack: boolean;
  notify_sms: boolean;
  notify_email: boolean;
}

const emptyForm: FormState = {
  display_name: "",
  workspace_email: "",
  mobile_phone_e164: "",
  sales_rep_user_id: "",
  ghl_user_id: "",
  slack_user_id: "",
  phone_number_id: "",
  xai_agent_id: "",
  xai_phone_number_e164: "",
  ghl_location_id: "",
  ghl_notification_workflow_id: "",
  ghl_routing_workflow_id: "",
  ghl_mobile_custom_value_id: "",
  ghl_mobile_custom_value_name: "",
  ghl_user_custom_value_id: "",
  ghl_user_custom_value_name: "",
  xai_setup_status: "pending",
  ghl_setup_status: "pending",
  xai_verification_reference: "",
  ring_seconds: 20,
  transfer_enabled: false,
  backup_transfer_phone_e164: "",
  voice_id: "eve",
  greeting_override: "",
  approved_context: "",
  timezone: "America/Denver",
  business_hours_summary: "Monday-Friday, 8:00 AM-5:00 PM",
  answer_approved_faqs: true,
  schedule_demos: true,
  notify_slack: true,
  notify_sms: true,
  notify_email: true,
};

const cardStyle = {
  background: "var(--as-surface)",
  borderColor: "var(--as-border)",
  boxShadow: "0 8px 28px rgba(10, 21, 71, 0.06)",
};

function formFor(record: TeamRecord): FormState {
  const hours = record.config?.business_hours?.summary;
  return {
    display_name: record.member.display_name || "",
    workspace_email: record.member.workspace_email || "",
    mobile_phone_e164: record.member.mobile_phone_e164 || "",
    sales_rep_user_id: record.member.sales_rep_user_id || "",
    ghl_user_id: record.member.ghl_user_id || "",
    slack_user_id: record.member.slack_user_id || "",
    phone_number_id: record.assignment?.phone_number_id || "",
    xai_agent_id: record.phone?.xai_agent_id || record.assignment?.xai_agent_id || "",
    xai_phone_number_e164: record.phone?.xai_phone_number_e164 || record.assignment?.xai_phone_number_e164 || "",
    ghl_location_id: record.phone?.ghl_location_id || record.assignment?.ghl_location_id || "",
    ghl_notification_workflow_id: record.phone?.ghl_notification_workflow_id || record.assignment?.ghl_notification_workflow_id || "",
    ghl_routing_workflow_id: record.phone?.ghl_routing_workflow_id || "",
    ghl_mobile_custom_value_id: record.phone?.ghl_mobile_custom_value_id || "",
    ghl_mobile_custom_value_name: record.phone?.ghl_mobile_custom_value_name || "",
    ghl_user_custom_value_id: record.phone?.ghl_user_custom_value_id || "",
    ghl_user_custom_value_name: record.phone?.ghl_user_custom_value_name || "",
    xai_setup_status: record.phone?.xai_setup_status || "pending",
    ghl_setup_status: record.phone?.ghl_setup_status || "pending",
    xai_verification_reference: record.phone?.xai_verification_reference || "",
    ring_seconds: record.assignment?.ring_seconds || 20,
    transfer_enabled: record.assignment?.transfer_enabled === true,
    backup_transfer_phone_e164: record.assignment?.backup_transfer_phone_e164 || "",
    voice_id: record.config?.voice_id || "eve",
    greeting_override: record.config?.greeting_override || "",
    approved_context: record.config?.approved_context || "",
    timezone: record.config?.timezone || "America/Denver",
    business_hours_summary: typeof hours === "string" ? hours : "Monday-Friday, 8:00 AM-5:00 PM",
    answer_approved_faqs: record.config?.answer_approved_faqs !== false,
    schedule_demos: record.config?.schedule_demos !== false,
    notify_slack: record.config?.notify_slack !== false,
    notify_sms: record.config?.notify_sms !== false,
    notify_email: record.config?.notify_email !== false,
  };
}

function formWithPhone(current: FormState, phone: PhoneNumber | null): FormState {
  return {
    ...current,
    phone_number_id: phone?.id || "",
    xai_agent_id: phone?.xai_agent_id || "",
    xai_phone_number_e164: phone?.xai_phone_number_e164 || "",
    ghl_location_id: phone?.ghl_location_id || "",
    ghl_routing_workflow_id: phone?.ghl_routing_workflow_id || "",
    ghl_notification_workflow_id: phone?.ghl_notification_workflow_id || "",
    ghl_mobile_custom_value_id: phone?.ghl_mobile_custom_value_id || "",
    ghl_mobile_custom_value_name: phone?.ghl_mobile_custom_value_name || "",
    ghl_user_custom_value_id: phone?.ghl_user_custom_value_id || "",
    ghl_user_custom_value_name: phone?.ghl_user_custom_value_name || "",
    xai_setup_status: phone?.xai_setup_status || "pending",
    ghl_setup_status: phone?.ghl_setup_status || "pending",
    xai_verification_reference: phone?.xai_verification_reference || "",
  };
}

function formatPhone(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11 || digits[0] !== "1") return value || "Not assigned";
  return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
}

function formatDateTime(value: string | null | undefined): string {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return "Never";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function labelProvider(provider: SyncJob["provider"]): string {
  return provider === "sales_dashboard" ? "Sales dashboard" : provider === "xai" ? "Grok Voice" : provider === "ghl" ? "GHL" : "Slack";
}

function latestJobs(jobs: SyncJob[]): SyncJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.provider)) return false;
    seen.add(job.provider);
    return true;
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!backendBase) throw new Error("The backend URL is not configured.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your admin session has expired.");
  const response = await fetch(`${backendBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    credentials: "omit",
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch {}
  if (!response.ok) {
    const fields = payload.fields && typeof payload.fields === "object" ? payload.fields as { missing?: unknown } : {};
    const missing = Array.isArray(fields.missing) ? ` Missing: ${fields.missing.join(", ")}.` : "";
    throw new Error(`${String(payload.detail || payload.message || payload.error || "The request could not be completed.")}${missing}`);
  }
  return payload as T;
}

function StatusPill({ status }: { status: MemberStatus }) {
  const styles = status === "active"
    ? { color: "#116149", background: "#DFF8ED" }
    : status === "inactive"
      ? { color: "#8A2A2A", background: "#FDE8E8" }
      : { color: "#765A00", background: "#FFF4CC" };
  return <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={styles}>{status}</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-[var(--as-text)]">{label}</span>
      {hint && <span className="ml-2 text-[11px] font-semibold text-[var(--as-muted)]">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const inputClass = "w-full rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--as-text)] outline-none transition focus:border-[#A380F6] focus:ring-2 focus:ring-[#A380F6]/15";

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string }) {
  return (
    <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] p-3 text-left">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-[#A380F6] bg-[#A380F6] text-white" : "border-[var(--as-border)] text-transparent"}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
      <span><strong className="block text-xs text-[var(--as-text)]">{label}</strong>{detail && <small className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-[var(--as-muted)]">{detail}</small>}</span>
    </button>
  );
}

export default function AdminSalesTeamPage() {
  const [payload, setPayload] = useState<TeamPayload>({ items: [], phone_numbers: [], agent_bootstrap_prompt: "" });
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [oneTimeToken, setOneTimeToken] = useState("");

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError("");
    try {
      const next = await request<TeamPayload>("/admin/sales-team");
      setPayload(next);
      const nextId = preferredId || selectedId || next.items[0]?.member.id || "";
      const selected = next.items.find((item) => item.member.id === nextId) || next.items[0] || null;
      if (selected) {
        setSelectedId(selected.member.id);
        setForm(formFor(selected));
        setCreating(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the sales team.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => payload.items.find((item) => item.member.id === selectedId) || null, [payload.items, selectedId]);
  const selectedLine = useMemo(() => payload.phone_numbers.find((phone) => phone.id === form.phone_number_id) || null, [payload.phone_numbers, form.phone_number_id]);
  const activeOccupants = useMemo(() => new Map(payload.items
    .filter((item) => item.member.status === "active" && item.applied_phone?.id)
    .map((item) => [item.applied_phone!.id, item])), [payload.items]);
  const selectedLineOccupant = selectedLine ? activeOccupants.get(selectedLine.id) || null : null;
  const replacement = selectedLineOccupant && selectedLineOccupant.member.id !== selectedId ? selectedLineOccupant : null;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return payload.items;
    return payload.items.filter((item) => [item.member.display_name, item.member.workspace_email, item.member.mobile_phone_e164, item.phone?.e164, item.member.status].join(" ").toLowerCase().includes(term));
  }, [payload.items, search]);

  const choose = (record: TeamRecord) => {
    setSelectedId(record.member.id);
    setForm(formFor(record));
    setCreating(false);
    setError("");
    setNotice("");
    setOneTimeToken("");
  };

  const chooseSlot = (phone: PhoneNumber) => {
    const occupant = activeOccupants.get(phone.id);
    if (occupant) {
      choose(occupant);
      return;
    }
    setCreating(true);
    setSelectedId("");
    setForm(formWithPhone(emptyForm, phone));
    setError("");
    setNotice("");
    setOneTimeToken("");
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        ...form,
        business_hours: { summary: form.business_hours_summary },
      };
      const result = await request<{ item: TeamRecord }>(creating ? "/admin/sales-team/members" : `/admin/sales-team/members/${selectedId}`, {
        method: creating ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      setNotice("Draft saved. The active call route has not changed.");
      await load(result.item.member.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this salesperson.");
    } finally {
      setSaving(false);
    }
  };

  const action = async (name: "apply" | "deactivate" | "reactivate" | "rotate-agent-token" | "sync") => {
    if (!selectedId) return;
    if (name === "deactivate" && !window.confirm(`Deactivate ${selected?.member.display_name || "this salesperson"}? Their historical sales and commissions will be preserved.`)) return;
    if (name === "apply" && replacement && !window.confirm(`Replace ${replacement.member.display_name} on ${formatPhone(selectedLine?.e164)} with ${form.display_name}? The former salesperson will become inactive and stop receiving calls and messages. Their account and history will remain intact.`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    setOneTimeToken("");
    try {
      if (name === "apply") {
        await request(`/admin/sales-team/members/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, business_hours: { summary: form.business_hours_summary } }),
        });
      }
      const actionBody = name === "rotate-agent-token"
        ? { phone_id: selectedLine?.id || null }
        : name === "apply" && replacement
          ? { replace_team_member_id: replacement.member.id }
          : {};
      const result = await request<{ item: TeamRecord; token?: string }>(`/admin/sales-team/members/${selectedId}/${name}`, { method: "POST", body: JSON.stringify(actionBody) });
      if (result.token) setOneTimeToken(result.token);
      setNotice(name === "apply" ? "Configuration applied and provider synchronization checked." : name === "sync" ? "Provider synchronization checked. Review the current statuses below." : name === "deactivate" ? "Salesperson deactivated and historical attribution preserved." : name === "reactivate" ? "Salesperson restored as a draft. Review and apply the routing configuration before use." : "New one-time line token created. Copy it into both fixed Grok tools now; it will not be shown again.");
      await load(result.item.member.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  };

  const saveLineSetup = async () => {
    if (!selectedLine) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request(`/admin/sales-team/lines/${selectedLine.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          xai_agent_id: form.xai_agent_id,
          xai_phone_number_e164: form.xai_phone_number_e164,
          ghl_location_id: form.ghl_location_id,
          ghl_routing_workflow_id: form.ghl_routing_workflow_id,
          ghl_notification_workflow_id: form.ghl_notification_workflow_id,
          ghl_mobile_custom_value_id: form.ghl_mobile_custom_value_id,
          ghl_mobile_custom_value_name: form.ghl_mobile_custom_value_name,
          ghl_user_custom_value_id: form.ghl_user_custom_value_id,
          ghl_user_custom_value_name: form.ghl_user_custom_value_name,
          xai_setup_status: form.xai_setup_status,
          ghl_setup_status: form.ghl_setup_status,
          xai_verification_reference: form.xai_verification_reference,
        }),
      });
      setNotice("Reusable company-line setup saved.");
      await load(selectedId);
    } catch (lineError) {
      setError(lineError instanceof Error ? lineError.message : "Could not save the company-line setup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Sales Team & Call Routing">
      <div className="mx-auto max-w-[1500px] space-y-5 pb-12">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A380F6]">Sales operations</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--as-text)] sm:text-3xl">Sales Team & Call Routing</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-[var(--as-muted)]">Manage each salesperson’s dashboard identity, GHL number, mobile forwarding, Grok Voice configuration, and notification destinations from one place.</p>
          </div>
          <button type="button" onClick={() => { setCreating(true); setSelectedId(""); setForm(emptyForm); setError(""); setNotice(""); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A1547] px-4 py-2.5 text-sm font-black text-white">
            <Plus className="h-4 w-4" /> Add salesperson
          </button>
        </header>

        {(error || notice) && <div role={error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || notice}</div>}
        {oneTimeToken && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="text-sm font-black">One-time Grok line token</p>
            <p className="mt-1 text-xs font-semibold">Paste this into the line’s fixed context and message tools. The token stays with the company phone line when personnel change.</p>
            <div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs">{oneTimeToken}</code><button type="button" aria-label="Copy one-time Grok line token" onClick={() => void copy(oneTimeToken, "Line token copied.")} className="rounded-lg bg-amber-900 px-3 text-white"><Clipboard className="h-4 w-4" /></button></div>
          </section>
        )}

        <section aria-labelledby="sales-line-slots-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><h2 id="sales-line-slots-title" className="text-sm font-black text-[var(--as-text)]">Four permanent sales line slots</h2><p className="mt-1 text-xs font-semibold text-[var(--as-muted)]">The GHL number, workflows, Grok agent, and secure tools stay with each slot when personnel change.</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {payload.phone_numbers.filter((phone) => phone.active).slice(0, 4).map((phone, index) => {
              const occupant = activeOccupants.get(phone.id);
              const selectedSlot = form.phone_number_id === phone.id;
              const ready = phone.ghl_setup_status === "verified" && phone.xai_setup_status === "verified";
              return (
                <button key={phone.id} type="button" onClick={() => chooseSlot(phone)} className={`rounded-xl border p-4 text-left transition ${selectedSlot ? "border-[#A380F6] bg-[#A380F6]/10" : "border-[var(--as-border)] bg-[var(--as-surface)] hover:border-[#A380F6]/50"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A380F6]">Line {index + 1}</p><span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{ready ? "Prepared" : "Setup pending"}</span></div>
                  <p className="mt-2 text-sm font-black text-[var(--as-text)]">{formatPhone(phone.e164)}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--as-muted)]">{occupant?.member.display_name || "Available for a new salesperson"}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border" style={cardStyle}>
            <div className="border-b border-[var(--as-border)] p-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--as-muted)]" /><input aria-label="Search sales team" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team" className={`${inputClass} pl-9`} /></div>
            </div>
            <div className="max-h-[760px] divide-y divide-[var(--as-border)] overflow-y-auto">
              {loading && <p className="p-5 text-sm font-semibold text-[var(--as-muted)]">Loading sales team…</p>}
              {!loading && filtered.length === 0 && <p className="p-5 text-sm font-semibold text-[var(--as-muted)]">No salespeople match this search.</p>}
              {filtered.map((record) => (
                <button key={record.member.id} type="button" onClick={() => choose(record)} className={`w-full p-4 text-left transition ${selectedId === record.member.id && !creating ? "bg-[#A380F6]/10" : "hover:bg-[var(--as-soft)]"}`}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-[var(--as-text)]">{record.member.display_name}</p><p className="mt-1 truncate text-xs font-semibold text-[var(--as-muted)]">{record.member.workspace_email || "Workspace email needed"}</p></div><StatusPill status={record.member.status} /></div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-[var(--as-muted)]"><span>{formatPhone(record.applied_phone?.e164 || record.phone?.e164)}</span><span className={record.readiness.ready ? "text-emerald-700" : "text-amber-700"}>{record.pending_draft ? "Draft changes" : record.readiness.ready ? "Ready" : `${record.readiness.missing.length} needed`}</span></div>
                </button>
              ))}
            </div>
          </aside>

          <form onSubmit={save} className="space-y-5">
            <section className="rounded-xl border border-[#A380F6]/30 bg-[#A380F6]/8 p-4 text-xs font-semibold leading-relaxed text-[var(--as-text)]"><strong className="font-black">Normal onboarding:</strong> enter the person’s name, Workspace email, mobile, sales dashboard user ID, GHL user ID, Slack member ID, and choose a prepared company line. Then use Apply routing. Open the reusable line sections only when setting up or replacing company-owned infrastructure.</section>
            <section className="rounded-xl border p-5" style={cardStyle}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A380F6]">{creating ? "New salesperson" : "Team member"}</p><h2 className="mt-1 text-xl font-black text-[var(--as-text)]">{creating ? "Create a sales team record" : selected?.member.display_name}</h2></div>{selected && !creating && <StatusPill status={selected.member.status} />}</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Name"><input className={inputClass} value={form.display_name} onChange={(e) => update("display_name", e.target.value)} required /></Field>
                <Field label="Workspace email" hint="Required to activate"><input className={inputClass} type="email" value={form.workspace_email} onChange={(e) => update("workspace_email", e.target.value)} placeholder="name@alphasourceai.com" /></Field>
                <Field label="Mobile number" hint="Required · use +1XXXXXXXXXX"><input className={inputClass} value={form.mobile_phone_e164} onChange={(e) => update("mobile_phone_e164", e.target.value)} placeholder="+17205551212" /></Field>
                <Field label="Sales dashboard user ID" hint="Required · Supabase auth UUID"><input className={inputClass} value={form.sales_rep_user_id} onChange={(e) => update("sales_rep_user_id", e.target.value)} /></Field>
                <Field label="GHL user ID" hint="Required to activate"><input className={inputClass} value={form.ghl_user_id} onChange={(e) => update("ghl_user_id", e.target.value)} /></Field>
                <Field label="Slack member ID" hint="Required to activate"><input className={inputClass} value={form.slack_user_id} onChange={(e) => update("slack_user_id", e.target.value)} placeholder="U…" /></Field>
              </div>
            </section>

            <section className="rounded-xl border p-5" style={cardStyle}>
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A1547]/8 text-[#0A1547]"><Phone className="h-5 w-5" /></span><div><h2 className="text-base font-black text-[var(--as-text)]">GHL call routing</h2><p className="text-xs font-semibold text-[var(--as-muted)]">One active number per salesperson, with Call Connect always required.</p>{selected?.pending_draft && selected.applied_phone && <p className="mt-1 text-[11px] font-bold text-amber-700">Active number: {formatPhone(selected.applied_phone.e164)} · draft changes are not live</p>}</div></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="GHL phone number" hint="Required to activate"><select className={inputClass} value={form.phone_number_id} onChange={(e) => { const phone = payload.phone_numbers.find((item) => item.id === e.target.value) || null; setForm((current) => formWithPhone(current, phone)); }}><option value="">Select a number</option>{payload.phone_numbers.filter((phone) => phone.active).map((phone) => <option key={phone.id} value={phone.id}>{formatPhone(phone.e164)} · {activeOccupants.get(phone.id)?.member.display_name || "available"}</option>)}</select></Field>
                <Field label="Mobile ring time" hint="10-25 seconds"><input className={inputClass} type="number" min={10} max={25} value={form.ring_seconds} onChange={(e) => update("ring_seconds", Number(e.target.value))} /></Field>
                <Field label="GHL line setup" hint="Managed once per company number"><div className={`${inputClass} bg-[var(--as-soft)]`}>{selectedLine?.ghl_setup_status === "verified" ? "Verified and reusable" : "Setup pending"}</div></Field>
                <Field label="GHL workflow" hint="Managed line resource"><div className={`${inputClass} bg-[var(--as-soft)]`}>{selectedLine?.ghl_routing_workflow_id || "Not configured"}</div></Field>
              </div>
              {replacement && <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-950">This line is currently assigned to {replacement.member.display_name}. Applying will atomically move calls and notifications to {form.display_name || "this salesperson"}, deactivate the former routing assignment, and preserve the former account, sales, and commission history.</div>}
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-relaxed text-emerald-900"><ShieldCheck className="mr-2 inline h-4 w-4" />Call Connect is locked on. GHL must time out before the mobile carrier’s voicemail answers, then route to the assigned Grok Voice number.</div>
              {selectedLine && <details className="mt-4 rounded-lg border border-[var(--as-border)] p-4"><summary className="cursor-pointer text-xs font-black text-[var(--as-text)]">Reusable company-line setup</summary><p className="mt-2 text-xs font-semibold text-[var(--as-muted)]">Configure these once for the company number. Changing an identifier returns that provider to pending until it is tested again.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="GHL routing workflow ID"><input className={inputClass} value={form.ghl_routing_workflow_id} onChange={(e) => update("ghl_routing_workflow_id", e.target.value)} /></Field><Field label="GHL notification workflow ID"><input className={inputClass} value={form.ghl_notification_workflow_id} onChange={(e) => update("ghl_notification_workflow_id", e.target.value)} /></Field><Field label="GHL mobile custom value ID"><input className={inputClass} value={form.ghl_mobile_custom_value_id} onChange={(e) => update("ghl_mobile_custom_value_id", e.target.value)} /></Field><Field label="GHL mobile custom value name"><input className={inputClass} value={form.ghl_mobile_custom_value_name} onChange={(e) => update("ghl_mobile_custom_value_name", e.target.value)} /></Field><Field label="GHL user custom value ID"><input className={inputClass} value={form.ghl_user_custom_value_id} onChange={(e) => update("ghl_user_custom_value_id", e.target.value)} /></Field><Field label="GHL user custom value name"><input className={inputClass} value={form.ghl_user_custom_value_name} onChange={(e) => update("ghl_user_custom_value_name", e.target.value)} /></Field><Field label="GHL setup status"><select className={inputClass} value={form.ghl_setup_status} onChange={(e) => update("ghl_setup_status", e.target.value as FormState["ghl_setup_status"])}><option value="pending">Pending</option><option value="verified">Verified after line test</option><option value="failed">Failed</option></select></Field></div><button type="button" aria-label="Save GHL company-line setup" disabled={saving} onClick={() => void saveLineSetup()} className="mt-4 rounded-lg border border-[var(--as-border)] px-3 py-2 text-xs font-black text-[var(--as-text)]">Save GHL line setup</button></details>}
            </section>

            <section className="rounded-xl border p-5" style={cardStyle}>
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#A380F6]/15 text-[#7655CC]"><Bot className="h-5 w-5" /></span><div><h2 className="text-base font-black text-[var(--as-text)]">Grok Voice agent</h2><p className="text-xs font-semibold text-[var(--as-muted)]">Edit approved context and capabilities while the consent and data-safety rules stay locked.</p></div></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Grok agent" hint="Managed once per company number"><div className={`${inputClass} bg-[var(--as-soft)]`}>{form.xai_agent_id || "Not configured"}</div></Field>
                <Field label="Grok fallback number" hint="Managed line resource"><div className={`${inputClass} bg-[var(--as-soft)]`}>{formatPhone(form.xai_phone_number_e164)}</div></Field>
                <Field label="Voice"><input className={inputClass} value={form.voice_id} onChange={(e) => update("voice_id", e.target.value)} /></Field>
                <Field label="Timezone"><input className={inputClass} value={form.timezone} onChange={(e) => update("timezone", e.target.value)} /></Field>
                <Field label="Business hours"><input className={inputClass} value={form.business_hours_summary} onChange={(e) => update("business_hours_summary", e.target.value)} /></Field>
                <Field label="Greeting override" hint="Optional"><input className={inputClass} value={form.greeting_override} onChange={(e) => update("greeting_override", e.target.value)} placeholder={`Hi, you've reached ${form.display_name || "the salesperson"}'s alphaScreen line…`} /></Field>
              </div>
              <div className="mt-4"><Field label="Approved product context" hint="Only information the agent may use to answer questions"><textarea className={`${inputClass} min-h-36 resize-y`} value={form.approved_context} onChange={(e) => update("approved_context", e.target.value)} /></Field></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Toggle checked={form.answer_approved_faqs} onChange={(value) => update("answer_approved_faqs", value)} label="Answer approved FAQs" detail="Unknown answers are handed back to the sales team." />
                <Toggle checked={form.schedule_demos} onChange={(value) => update("schedule_demos", value)} label="Schedule demos" detail="Uses only the configured demo calendar capability." />
                <Toggle checked={form.transfer_enabled} onChange={(value) => update("transfer_enabled", value)} label="Allow live transfer" detail="The destination must be separate from this salesperson’s mobile." />
                {form.transfer_enabled && <Field label="Backup transfer number"><input className={inputClass} value={form.backup_transfer_phone_e164} onChange={(e) => update("backup_transfer_phone_e164", e.target.value)} placeholder="+17205551212" /></Field>}
              </div>
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-relaxed text-emerald-900"><Check className="mr-2 inline h-4 w-4" />Caller-approved follow-up messages always go to this salesperson by Slack DM, GHL text, and Workspace email.</div>
              {selectedLine && <details className="mt-4 rounded-lg border border-[var(--as-border)] p-4"><summary className="cursor-pointer text-xs font-black text-[var(--as-text)]">Reusable Grok line setup</summary><p className="mt-2 text-xs font-semibold text-[var(--as-muted)]">Use the same stable line token for the context and message tools. Record the completed QA call before marking the line verified.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Grok agent ID"><input className={inputClass} value={form.xai_agent_id} onChange={(e) => update("xai_agent_id", e.target.value)} /></Field><Field label="Grok phone number"><input className={inputClass} value={form.xai_phone_number_e164} onChange={(e) => update("xai_phone_number_e164", e.target.value)} placeholder="+17205551212" /></Field><Field label="Grok QA call reference"><input className={inputClass} value={form.xai_verification_reference} onChange={(e) => update("xai_verification_reference", e.target.value)} placeholder="Call or test reference" /></Field><Field label="Grok setup status"><select className={inputClass} value={form.xai_setup_status} onChange={(e) => update("xai_setup_status", e.target.value as FormState["xai_setup_status"])}><option value="pending">Pending</option><option value="verified">Verified after line test</option><option value="failed">Failed</option></select></Field></div>{payload.agent_bootstrap_prompt && <div className="mt-4"><p className="text-xs font-black text-[var(--as-text)]">Fixed agent instructions</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--as-soft)] p-3 text-xs leading-relaxed text-[var(--as-text)]">{payload.agent_bootstrap_prompt}</pre><button type="button" onClick={() => void copy(payload.agent_bootstrap_prompt, "Fixed Grok instructions copied.")} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--as-border)] px-3 py-2 text-xs font-black text-[var(--as-text)]"><Clipboard className="h-3.5 w-3.5" /> Copy fixed instructions</button></div>}<button type="button" aria-label="Save Grok company-line setup" disabled={saving} onClick={() => void saveLineSetup()} className="mt-4 rounded-lg border border-[var(--as-border)] px-3 py-2 text-xs font-black text-[var(--as-text)]">Save Grok line setup</button></details>}
            </section>

            {selected && !creating && (
              <section className="rounded-xl border p-5" style={cardStyle}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-black text-[var(--as-text)]">Readiness and provider status</h2><p className="mt-1 text-xs font-semibold text-[var(--as-muted)]">The page reports a provider as synchronized only after its configured step completes.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${selected.readiness.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{selected.readiness.ready ? "Ready to apply" : `${selected.readiness.missing.length} items needed`}</span></div>
                {!selected.readiness.ready && <div className="mt-4 flex flex-wrap gap-2">{selected.readiness.missing.map((item) => <span key={item} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">{item}</span>)}</div>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {latestJobs(selected.sync_jobs).map((job) => <div key={job.provider} className="rounded-lg border border-[var(--as-border)] p-3"><p className="text-xs font-black text-[var(--as-text)]">{labelProvider(job.provider)}</p><p className={`mt-1 text-[11px] font-black uppercase tracking-wide ${job.status === "synced" ? "text-emerald-700" : job.status === "not_applicable" ? "text-[var(--as-muted)]" : job.status === "failed" ? "text-red-700" : "text-amber-700"}`}>{job.status.replaceAll("_", " ")}</p>{job.provider_reference && <p className="mt-1 break-all text-[10px] font-semibold text-[var(--as-muted)]">{job.provider_reference}</p>}{job.last_error_detail && <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[var(--as-muted)]">{job.last_error_detail}</p>}</div>)}
                  {selected.sync_jobs.length === 0 && <p className="col-span-full text-xs font-semibold text-[var(--as-muted)]">No provider sync has been requested yet.</p>}
                </div>
                {selected.config?.generated_prompt && <details className="mt-4 rounded-lg border border-[var(--as-border)] p-3"><summary className="cursor-pointer text-xs font-black text-[var(--as-text)]">Applied context snapshot · version {selected.config.version}</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--as-soft)] p-3 text-xs leading-relaxed text-[var(--as-text)]">{selected.config.generated_prompt}</pre></details>}
              </section>
            )}

            <div className="sticky bottom-3 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)]/95 p-3 shadow-lg backdrop-blur">
              {selected && !creating && selected.member.status !== "inactive" && <button type="button" disabled={saving} onClick={() => void action("deactivate")} className="mr-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-xs font-black text-red-700 disabled:opacity-50"><UserRoundX className="h-4 w-4" /> Deactivate</button>}
              {selected && !creating && selected.member.status === "inactive" && <button type="button" disabled={saving} onClick={() => void action("reactivate")} className="mr-auto inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2.5 text-xs font-black text-emerald-700 disabled:opacity-50"><UserRound className="h-4 w-4" /> Reactivate as draft</button>}
              {selected && !creating && selected.member.status === "active" && <button type="button" disabled={saving} onClick={() => void action("sync")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--as-border)] px-3 py-2.5 text-xs font-black text-[var(--as-text)] disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Sync providers</button>}
              {selected && !creating && selected.member.status !== "inactive" && <button type="button" disabled={saving || !selected.phone?.id} onClick={() => void action("rotate-agent-token")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--as-border)] px-3 py-2.5 text-xs font-black text-[var(--as-text)] disabled:opacity-50"><RefreshCw className="h-4 w-4" /> {selected.phone?.handoff_token_rotated_at ? "Rotate line token" : "Prepare line token"}</button>}
              <button type="submit" disabled={saving || selected?.member.status === "inactive"} className="inline-flex items-center gap-2 rounded-lg border border-[var(--as-border)] px-4 py-2.5 text-xs font-black text-[var(--as-text)] disabled:opacity-50"><UserRound className="h-4 w-4" /> {saving ? "Saving…" : "Save draft"}</button>
              {selected && !creating && selected.member.status !== "inactive" && <button type="button" disabled={saving} onClick={() => void action("apply")} className="inline-flex items-center gap-2 rounded-lg bg-[#0A1547] px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck className="h-4 w-4" /> {replacement ? `Replace ${replacement.member.display_name} & apply routing` : "Apply routing"}</button>}
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
