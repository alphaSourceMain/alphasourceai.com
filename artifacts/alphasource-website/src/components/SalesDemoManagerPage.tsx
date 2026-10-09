import { useEffect, useState, type ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { DemoWorkspaceContent, isDemoWorkspace, demoManagerMode, type DemoManagerPage, type DemoWorkspace } from "@/components/SalesDemoManagerContent";
const titles: Record<DemoManagerPage,string>={billing:'Billing',entities:'Entities',members:'Members',automation:'Automation',profile:'Profile Settings'};
const cardStyle={backgroundColor:'var(--as-surface)',border:'1px solid var(--as-border)',boxShadow:'var(--as-shadow)'};
const muted={color:'var(--as-text-muted)'};

function SalesDemoManagerPage({page}: {page:DemoManagerPage}) {
  const {selectedClient}=useClient();
  const [data,setData]=useState<DemoWorkspace|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError('');
    async function load() {
      try {
        const base=String(import.meta.env.VITE_BACKEND_URL||import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
        if (!base) throw new Error('Demo connection unavailable.');
        const {data:{session}}=await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Please sign in again.');
        const response=await fetch(`${base}/demo/workspace?client_id=${encodeURIComponent(selectedClient.id)}`,{method:'GET',credentials:'omit',signal:controller.signal,headers:{Authorization:`Bearer ${session.access_token}`}});
        if (!response.ok) throw new Error('The synthetic manager workspace could not be loaded.');
        const payload:unknown=await response.json();
        if (!isDemoWorkspace(payload)) throw new Error('Invalid demo workspace.');
        if (!controller.signal.aborted) setData(payload);
      } catch(e) {if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Demo unavailable.');}
    }
    void load();return()=>controller.abort();
  },[selectedClient.id]);
  return <DashboardLayout title={titles[page]}>{error?<p role="alert" className="rounded-xl border p-5" style={cardStyle}>{error}</p>:data?<DemoWorkspaceContent key={page} page={page} data={data}/>:<p role="status" style={muted}>Loading synthetic manager workspace…</p>}</DashboardLayout>;
}

export default function DemoManagerRoute({page,children}: {page:DemoManagerPage;children:ReactNode}) {
  const {selectedClient,loading,error}=useClient();
  const {currentUser,clientAuthReady}=useAuth();
  // Do not mount live billing/invite/profile effects while scope is unknown.
  if (!clientAuthReady || !currentUser || loading || !selectedClient.id) return <DashboardLayout title={titles[page]}><p role="status" style={muted}>{error||'Loading client access…'}</p></DashboardLayout>;
  const mode=demoManagerMode(selectedClient,currentUser?.app_metadata?.sales_demo_client_id);
  if (mode==='blocked') return <DashboardLayout title={titles[page]}><p role="alert" style={muted}>Demo access could not be verified. No live manager actions are available.</p></DashboardLayout>;
  return mode==='demo'?<SalesDemoManagerPage page={page}/>:children;
}
