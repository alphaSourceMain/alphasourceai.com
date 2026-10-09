import { useState, type ReactNode } from "react";
import type { Client } from "@/context/ClientContext";

export type DemoManagerPage = 'billing' | 'entities' | 'members' | 'automation' | 'profile';
const DEMO_CLIENT = 'd38ade00-2026-4000-8000-000000000001';
const cardStyle = {backgroundColor:'var(--as-surface)',border:'1px solid var(--as-border)',boxShadow:'var(--as-shadow)'};
const muted = {color:'var(--as-text-muted)'};
const text = {color:'var(--as-text)'};
export interface DemoWorkspace {
  version: number; synthetic: boolean; read_only: boolean; client_id: string;
  client: {name:string;company:string;contact:string;email:string;address:string};
  billing: {plan:string;status:string;interval:string;platform_cents:number;role_cents:number;currency:string;term_start:string;term_end:string;next_bill:string;auto_renew:boolean;payment_method:string;agreement:string;invoices:{number:string;date:string;description:string;platform_cents:number;role_cents:number;total_cents:number;status:string;paid_date:string}[];roles:{name:string;used:number;included:number}[]};
  entities: {name:string;type:string;status:string;contact:string;email:string}[];
  members: {name:string;email:string;role:string;entity:string;status:string}[];
  automation: {name:string;resume_min:number;interview_min:number;overall_min:number;frequency:string;recipient:string;action:string;queue:{candidate_id:string;name:string;role:string;score:number;status:string}[]};
  profile: {name:string;email:string;role:string;timezone:string;notifications:string;appearance:string};
}
export function usesDemoManagerPage(client: Pick<Client,'id'|'is_sales_demo'>): boolean {
  return client.is_sales_demo === true && client.id === DEMO_CLIENT;
}
export function isDemoWorkspace(value: unknown): value is DemoWorkspace {
  if (!value || typeof value !== 'object') return false;
  const d=value as Partial<DemoWorkspace>;
  return d.version===1 && d.synthetic===true && d.read_only===true && d.client_id===DEMO_CLIENT &&
    Boolean(d.client?.name && d.profile?.name && d.automation?.name) && Array.isArray(d.billing?.invoices) &&
    Array.isArray(d.billing?.roles) && Array.isArray(d.entities) && Array.isArray(d.members) && Array.isArray(d.automation?.queue);
}
function Section({title,children}: {title:string;children:ReactNode}) {
  return <section className="mb-6 rounded-2xl p-6" style={cardStyle}><h2 className="mb-5 text-base font-black" style={text}>{title}</h2>{children}</section>;
}
function Info({label,value}: {label:string;value:ReactNode}) {
  return <div className="rounded-xl border p-4" style={{backgroundColor:'var(--as-surface-muted)',borderColor:'var(--as-border)'}}><p className="mb-2 text-xs font-semibold" style={muted}>{label}</p><div className="text-sm font-bold break-words" style={text}>{value}</div></div>;
}
function PreviewFeature({children}: {children:ReactNode}) {
  return <span className="rounded-full border px-4 py-2 text-xs font-bold opacity-60" style={{...text,borderColor:'var(--as-border)'}}>{children} · preview only</span>;
}
function Table({headers,rows}: {headers:string[];rows:{key:string;cells:ReactNode[]}[]}) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr style={{...muted,borderColor:'var(--as-border)'}} className="border-b">{headers.map(h=><th key={h} scope="col" className="px-3 py-3 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.key} className="border-b last:border-0" style={{...text,borderColor:'var(--as-border)'}}>{row.cells.map((cell,i)=><td key={headers[i]} className="px-3 py-4 align-top">{cell}</td>)}</tr>)}</tbody></table></div>;
}
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const date=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));

export function DemoWorkspaceContent({page,data}: {page:DemoManagerPage;data:DemoWorkspace}) {
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('All');
  const filter=(value:string)=>value.toLowerCase().includes(search.trim().toLowerCase());
  const b=data.billing;
  return <>
    <div role="note" className="mb-6 rounded-xl border px-4 py-3" style={{backgroundColor:'var(--as-surface-muted)',borderColor:'var(--as-border)',...muted}}>
      <p className="text-sm font-bold" style={text}>Synthetic manager workspace · preview only</p>
      <p className="mt-1 text-xs">All client, billing, staff and entity examples on this page are fictional. Payments, invitations, changes and outreach are disabled. Amounts are examples, not quotes or transactions.</p>
    </div>
    {page==='billing' && <>
      <Section title="Billing Info"><div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Info label="Plan Tier" value={b.plan}/><Info label="Billing Status" value={b.status+' (example)'}/><Info label="Billing Cycle" value={b.interval}/>
        <Info label="Platform Membership" value={money(b.platform_cents)+'/month'}/><Info label="Role Opening Fee" value={money(b.role_cents)+'/role'}/><Info label="Next Billing Date" value={date(b.next_bill)}/>
        <Info label="Contract Term" value={date(b.term_start)+' – '+date(b.term_end)}/><Info label="Auto-Renew" value={b.auto_renew?'Yes (example)':'No'}/><Info label="Payment Method" value={b.payment_method}/>
      </div><div className="mt-4 flex flex-wrap gap-3"><PreviewFeature>Manage payment methods</PreviewFeature><PreviewFeature>Change plan</PreviewFeature><PreviewFeature>Buy interviews</PreviewFeature></div></Section>
      <Section title="Billing Contact"><div className="grid md:grid-cols-2 gap-3"><Info label="Company" value={data.client.company}/><Info label="Contact" value={data.client.contact}/><Info label="Email" value={data.client.email}/><Info label="Address" value={data.client.address}/></div><p className="mt-4 text-xs" style={muted}>{b.agreement}</p></Section>
      <Section title="Included Interviews"><Table headers={['Role','Used (synthetic)','Included','Remaining']} rows={b.roles.map(r=>({key:r.name,cells:[r.name,r.used,r.included,r.included-r.used]}))}/><p className="mt-3 text-xs" style={muted}>Six authored candidate examples; no actual interviews or purchases occurred.</p></Section>
      <Section title="Invoice History"><Table headers={['Invoice','Date','Description','Amount','Status','Paid Date']} rows={b.invoices.map(i=>({key:i.number,cells:[i.number,date(i.date),i.description,money(i.total_cents),i.status,date(i.paid_date)]}))}/><p className="mt-3 text-xs" style={muted}>These invoices are fictional. No Stripe invoice, payment or signed contract exists.</p></Section>
    </>}
    {page==='entities' && <>
      <Section title="Parent Client"><div className="grid md:grid-cols-2 gap-3"><Info label="Organization" value={data.client.company}/><Info label="Billing Owner" value="Parent client (example)"/></div></Section>
      <Section title="Entities"><div className="mb-4 flex flex-wrap items-center gap-3"><input aria-label="Search entities" placeholder="Search entities" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{...text,borderColor:'var(--as-border)',backgroundColor:'var(--as-surface)'}}/><select aria-label="Entity status" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{...text,borderColor:'var(--as-border)',backgroundColor:'var(--as-surface)'}}><option>All</option><option>Active</option><option>Archived</option></select><PreviewFeature>Add entity</PreviewFeature><PreviewFeature>Import CSV</PreviewFeature></div>
        <Table headers={['Entity','Type','Contact','Email','Status','Actions']} rows={data.entities.filter(e=>filter(e.name+' '+e.contact)&&(status==='All'||e.status===status)).map(e=>({key:e.name,cells:[e.name,e.type,e.contact,e.email,e.status,<PreviewFeature>Edit entity</PreviewFeature>]}))}/>
        <p className="mt-4 text-xs" style={muted}>Organization-structure examples only, not selectable client scopes or access grants. The demo’s two roles and six candidates remain on the parent client.</p>
      </Section>
    </>}
    {page==='members' && <Section title="Team Members"><div className="mb-4 flex flex-wrap gap-3"><input aria-label="Search members" placeholder="Search members" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{...text,borderColor:'var(--as-border)',backgroundColor:'var(--as-surface)'}}/><PreviewFeature>Invite member</PreviewFeature><PreviewFeature>Import members</PreviewFeature></div><Table headers={['Name','Email','Entity','Access','Status','Actions']} rows={data.members.filter(m=>filter(m.name+' '+m.email)).map(m=>({key:m.email,cells:[m.name,m.email,m.entity,m.role,m.status,<PreviewFeature>Manage access</PreviewFeature>]}))}/><p className="mt-4 text-xs" style={muted}>These staff records have no logins or invitations. Michael and Russell’s real QA access remains restricted to this shared demo.</p></Section>}
    {page==='automation' && <>
      <Section title="Candidate Automation"><p className="mb-4 text-sm font-semibold" style={text}>{data.automation.name} · enabled in this example, not running</p><div className="grid grid-cols-2 md:grid-cols-3 gap-3"><Info label="Minimum Resume Score" value={data.automation.resume_min+'%'}/><Info label="Minimum Interview Score" value={data.automation.interview_min+'%'}/><Info label="Minimum Overall Score" value={data.automation.overall_min+'%'}/><Info label="Review Digest" value={data.automation.frequency}/><Info label="Example Recipient" value={data.automation.recipient}/><Info label="Approval Policy" value={data.automation.action}/></div><div className="mt-4 flex flex-wrap gap-3"><PreviewFeature>Save automation</PreviewFeature><PreviewFeature>Send test digest</PreviewFeature></div></Section>
      <Section title="Review Candidates"><Table headers={['Candidate','Role','Overall','Status','Action']} rows={data.automation.queue.map(c=>({key:c.candidate_id,cells:[c.name,c.role,c.score+'%',c.status,<PreviewFeature>Approve next step</PreviewFeature>]}))}/><p className="mt-4 text-xs" style={muted}>Illustrative review queue, not live automation. No digest or candidate outreach is sent.</p></Section>
    </>}
    {page==='profile' && <>
      <Section title="Profile"><div className="grid md:grid-cols-2 gap-3"><Info label="Example Name" value={data.profile.name}/><Info label="Example Email" value={data.profile.email}/><Info label="Client Role" value={data.profile.role}/><Info label="Timezone" value={data.profile.timezone}/></div><div className="mt-4"><PreviewFeature>Save changes</PreviewFeature></div></Section>
      <Section title="Preferences & Security"><div className="grid md:grid-cols-2 gap-3"><Info label="Notifications" value={data.profile.notifications}/><Info label="Appearance" value={data.profile.appearance}/></div><div className="mt-4 flex flex-wrap gap-3"><PreviewFeature>Change password</PreviewFeature><PreviewFeature>Add passkey</PreviewFeature></div><p className="mt-4 text-xs" style={muted}>Example manager preferences. Your actual login, credentials and account profile are not edited from this demo page.</p></Section>
    </>}
  </>;
}


export function demoManagerMode(client: Pick<Client, 'id'|'is_sales_demo'>, marker: unknown): 'demo'|'blocked'|'live' {
  if (marker || client.is_sales_demo===true || client.id===DEMO_CLIENT) return marker===DEMO_CLIENT && usesDemoManagerPage(client)?'demo':'blocked';
  return 'live';
}
