import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SalesDemoBanner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function reset() {
    if (busy || !window.confirm('Restore the shared demo for Michael and Russell? Both roles and all six candidates will return to their original demo state.')) return;
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const base = String(import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/,'');
      if (!base) throw new Error('Demo connection unavailable.');
      const response = await fetch(`${base}/demo/reset`, { method:'POST', credentials:'omit', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({confirmation:'RESTORE SHARED DEMO'}) });
      if (!response.ok) throw new Error('The demo could not be safely restored. Please contact your administrator.');
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Reset failed.'); setBusy(false); }
  }
  return <section className="mb-5 rounded-xl border border-[#A380F6]/30 bg-[#A380F6]/10 px-4 py-3" aria-label="Sales demonstration">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-bold" style={{color:'var(--as-text)'}}>Sales demo · Northstar Talent Partners</p><p className="mt-1 text-xs" style={{color:'var(--as-text-muted)'}}>Fictional candidates and illustrative scores. Explore the dashboard and open or close roles. Outreach, billing, and live interviews are disabled.</p></div>
      <button type="button" disabled={busy} onClick={() => { void reset(); }} className="shrink-0 rounded-lg bg-[#0A1547] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?'Restoring…':'Reset shared demo'}</button>
    </div>
    {error ? <p role="alert" className="mt-2 text-xs text-red-600">{error}</p> : null}
  </section>;
}
