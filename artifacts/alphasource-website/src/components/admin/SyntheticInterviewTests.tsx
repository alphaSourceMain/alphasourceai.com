import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Play, Square, X } from "lucide-react";

type Run = {
  id: string;
  scenario: string;
  status: "running" | "passed" | "failed" | "cancelled";
  phase: string;
  created_at: string;
  error: string | null;
  cleanup_confirmed: boolean;
  audio_available: boolean;
  checks: { name: string; passed: boolean }[];
  transcript: { role: string; speech: string }[];
};
type Payload = {
  enabled: boolean;
  can_start: boolean;
  unavailable_reason: string | null;
  scenarios: { id: string; label: string }[];
  runs: Run[];
};

export default function SyntheticInterviewTests({ backendBase, getToken }: {
  backendBase: string;
  getToken: () => Promise<string>;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [scenario, setScenario] = useState("closing_next_steps");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioRunId, setAudioRunId] = useState("");
  const pendingKey = useRef("");
  const mounted = useRef(true);
  const qaHost = typeof window !== "undefined" && window.location.hostname === "alphasourceai-com.onrender.com";

  const request = useCallback(async (path: string, method = "GET", body?: object) => {
    const token = await getToken();
    const response = await fetch(`${backendBase}/admin/synthetic-interviews${path}`, {
      method, credentials: "omit", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(result?.error || "synthetic_tests_unavailable");
    }
    return response;
  }, [backendBase, getToken]);

  const refresh = useCallback(async () => {
    try {
      const response = await request("");
      const next = await response.json() as Payload;
      if (!Array.isArray(next.runs) || !Array.isArray(next.scenarios)) throw new Error("synthetic_tests_unavailable");
      if (mounted.current) setPayload(next);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "synthetic_tests_unavailable");
    }
  }, [request]);

  useEffect(() => {
    mounted.current = true;
    if (!qaHost || !backendBase) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 4000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [backendBase, qaHost, refresh]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const start = async () => {
    if (busy || !payload?.enabled || !payload.can_start || payload.runs.some((run) => run.status === "running")) return;
    if (!window.confirm("Run one synthetic QA interview? This uses Tavus and OpenAI services, lasts at most five minutes, and creates no applicant records.")) return;
    setBusy(true);
    setError("");
    pendingKey.current ||= crypto.randomUUID();
    try {
      await request("/runs", "POST", { scenario, request_key: pendingKey.current });
      pendingKey.current = "";
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "synthetic_test_start_failed");
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    setBusy(true);
    try { await request(`/runs/${id}/cancel`, "POST", {}); await refresh(); }
    catch { setError("Could not confirm cancellation. Refresh the run status."); }
    finally { setBusy(false); }
  };

  const loadAudio = async (id: string) => {
    setBusy(true);
    try {
      const response = await request(`/runs/${id}/audio`);
      setAudioUrl(URL.createObjectURL(await response.blob()));
      setAudioRunId(id);
    } catch { setError("Audio is unavailable or has expired."); }
    finally { setBusy(false); }
  };

  if (!qaHost || !payload?.enabled) return null;
  const active = payload.runs.find((run) => run.status === "running");
  const latest = active || payload.runs[0];
  return (
    <section aria-label="Synthetic interview tests" className="border-y py-4" style={{ borderColor: "var(--as-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--as-text)" }}>Synthetic Interviews · QA</h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select aria-label="Synthetic interview scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); pendingKey.current = ""; }}
            disabled={busy || Boolean(active)} className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm sm:flex-none" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}>
            {payload.scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <button type="button" onClick={() => void start()} disabled={busy || Boolean(active) || !payload.can_start}
            className="inline-flex items-center gap-2 rounded-md bg-[#00886A] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:ring-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Test Interview
          </button>
          {active && <button type="button" title="Stop synthetic interview" aria-label="Stop synthetic interview" disabled={busy}
            onClick={() => void cancel(active.id)} className="rounded-md border p-2 disabled:opacity-50"><Square className="h-4 w-4" /></button>}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 break-words text-sm text-red-600">{error}</p>}
      {latest && <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
          <span className={latest.status === "passed" ? "font-semibold text-[#00886A]" : latest.status === "failed" ? "font-semibold text-red-600" : "font-semibold"}>
            {latest.status === "running" ? latest.phase : latest.status.charAt(0).toUpperCase() + latest.status.slice(1)}
          </span>
          <span style={{ color: "var(--as-text-muted)" }}>{payload.scenarios.find((item) => item.id === latest.scenario)?.label}</span>
          <time className="text-xs" dateTime={latest.created_at}>{new Date(latest.created_at).toLocaleString()}</time>
          {latest.audio_available && <button type="button" title="Load interviewer audio" aria-label="Load interviewer audio" disabled={busy}
            onClick={() => void loadAudio(latest.id)} className="rounded-md border p-2"><Play className="h-4 w-4" /></button>}
        </div>
        {latest.error && <p className="break-words text-xs text-red-600">{latest.error}</p>}
        {latest.status !== "running" && !latest.cleanup_confirmed && <p role="alert" className="text-sm text-red-600">Vendor shutdown could not be confirmed. Do not start another test until reviewed.</p>}
        {latest.checks.length > 0 && <ul className="grid gap-1 text-xs sm:grid-cols-2">
          {latest.checks.map((check) => <li key={check.name} className="flex items-start gap-2">
            {check.passed ? <Check className="h-3.5 w-3.5 shrink-0 text-[#00886A]" /> : <X className="h-3.5 w-3.5 shrink-0 text-red-600" />}{check.name}
          </li>)}
        </ul>}
        {latest.transcript.length > 0 && <details className="text-xs">
          <summary className="cursor-pointer font-semibold">Synthetic transcript</summary>
          <ol className="mt-2 max-h-64 space-y-2 overflow-auto">
            {latest.transcript.map((turn, index) => <li key={index} className="break-words"><strong>{turn.role}:</strong> {turn.speech}</li>)}
          </ol>
        </details>}
        {audioUrl && audioRunId === latest.id && <div className="flex flex-wrap items-center gap-2">
          <audio controls src={audioUrl} aria-label="Synthetic interviewer recording" className="max-w-full" />
          <a href={audioUrl} download={`qa-interviewer-${latest.id}.webm`} title="Download interviewer audio" aria-label="Download interviewer audio" className="rounded-md border p-2"><Download className="h-4 w-4" /></a>
        </div>}
      </div>}
      <p className="mt-3 text-xs" style={{ color: "var(--as-text-muted)" }}>Coverage: live browser audio and closing. Not tested: submission, OTP, scoring, reports, real devices or reconnect. Results expire when the QA server restarts.</p>
    </section>
  );
}
