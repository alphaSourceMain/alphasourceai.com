import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";
import { parseRetailSalesPolicy, retailPolicyQueryKey, type RetailSalesPolicy } from "@/context/RetailSalesContext";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function RetailSalesControl() {
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState<RetailSalesPolicy | null>(null);
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useCallback(async (body?: object) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sign in as an administrator to change retail sales.");
    const response = await fetch(joinUrl(getPublicBackendBase(), "/admin/public-purchases/retail-sales"), {
      method: body ? "POST" : "GET", cache: "no-store",
      headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(response.status === 409 ? "The setting changed. Refresh before confirming again." : "Retail sales settings could not be saved or verified.");
    return parseRetailSalesPolicy(await response.json());
  }, []);
  useEffect(() => {
    let current = true;
    void request().then(p => { if (current) setPolicy(p); }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [request]);
  async function confirm() {
    if (!policy || pending === null || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const p = await request({ enabled: pending, confirmed: true, expected_version: policy.version });
      setPolicy(p); setPending(null);
      setNotice(`Retail sales are ${p.enabled ? "on" : "off"}. Existing agreements and client billing are unchanged.`);
      await queryClient.invalidateQueries({ queryKey: retailPolicyQueryKey });
    } catch (e) {
      setPolicy(null); setPending(null);
      setError(`${e instanceof Error ? e.message : "Save could not be confirmed."} Refresh to read the saved setting before trying again.`);
      await queryClient.invalidateQueries({ queryKey: retailPolicyQueryKey });
    } finally { setSaving(false); }
  }
  return <section className="mb-5 rounded-2xl border p-5" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }}>
    <div className="flex items-start justify-between gap-4"><div>
      <h2 id="retail-sales-label" className="font-bold">Retail sales enabled</h2>
      <p id="retail-sales-description" className="mt-1 text-sm" style={{ color: "var(--as-text-muted)" }}>
        {policy ? policy.enabled ? "On — online signup with 3-, 6-, and 12-month terms." : "Off — demo requests only, with 12-month memberships paid monthly or annually." : "Loading retail sales settings…"}
      </p><p className="mt-2 text-xs" style={{ color: "var(--as-text-muted)" }}>Switches pricing, new retail signup availability, and membership guidance together. Existing agreements, saved signups, payments, renewals, and client access stay unchanged.</p>
    </div><Switch checked={policy?.enabled ?? false} disabled={!policy || saving} aria-labelledby="retail-sales-label" aria-describedby="retail-sales-description" onCheckedChange={setPending} /></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !saving) setPending(null); }}><AlertDialogContent><AlertDialogHeader>
      <AlertDialogTitle>Turn retail sales {pending ? "on" : "off"}?</AlertDialogTitle>
      <AlertDialogDescription>{pending ? "Restore the current 3/6/12-month retail pricing and online signup, plus matching FAQ and support guidance." : "Hide new online signup and show demo requests with Monthly/Annual payment options for a 12-month commitment, plus matching FAQ and support guidance."} Existing agreements, saved signups, billing, renewals, and access will not change.</AlertDialogDescription>
    </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
      <AlertDialogAction disabled={saving} onClick={e => { e.preventDefault(); void confirm(); }}>{saving ? "Saving…" : `Confirm ${pending ? "on" : "off"}`}</AlertDialogAction>
    </AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
