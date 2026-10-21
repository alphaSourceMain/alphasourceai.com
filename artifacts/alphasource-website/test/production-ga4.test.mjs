import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source=readFileSync(new URL('../src/lib/ga4.ts',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'ts',format:'esm',define:{'import.meta.env':'{}'}}).code;
const {createGa4,ga4Page,ga4Event,GA4_MEASUREMENT_ID}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const key='alphasource:tracking-preferences:v2';
function harness({url='https://www.alphasourceai.com/',choice=true,enabled=true,blocked=false,readonly=false}={}){
 const values=new Map(choice===null?[]:[[key,JSON.stringify({analytics:choice,updatedAt:'2026-10-21T22:00:00.000Z'})]]);
 const scripts=[],listeners=new Map(),writes=[],navigations=[]; let reloads=0;
 const win={location:{href:url,assign:to=>navigations.push(to),reload:()=>reloads++},
  localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)||null},setItem:(k,v)=>{if(blocked||readonly)throw Error('blocked');values.set(k,v)}},
  history:{pushState:(...args)=>writeHistory(args),replaceState:(...args)=>writeHistory(args)},
  addEventListener:(name,fn,capture)=>{const list=listeners.get(name)||[];list.push({fn,capture});listeners.set(name,list)},
  document:{querySelector:()=>null,createElement:()=>({remove(){this.removed=true}}),head:{appendChild:s=>scripts.push(s)}}};
 function writeHistory(args){const next=new URL(args[2]??win.location.href,win.location.href);if(next.origin!==new URL(win.location.href).origin)throw new DOMException('Cross-origin history rejected','SecurityError');writes.push(args);win.location.href=next.href;}
 const ga=createGa4(win,enabled);ga.installGuard();ga.installGuard();
 return {win,ga,scripts,values,writes,navigations,listeners,reloads:()=>reloads,load:()=>scripts[0]?.onload?.(),commands:()=>Array.from(win.dataLayer||[],x=>Array.from(x)),fire:(name,event={})=>listeners.get(name)?.forEach(x=>x.fn(event))};
}
test('production host/public path allowlist excludes tokens and private workflows',()=>{
 for(const url of ['https://www.alphasourceai.com','https://alphasourceai.com/about/','https://www.alphasourceai.com/#contact'])assert.ok(ga4Page(new URL(url)),url);
 for(const suffix of ['/dashboard','/admin','/sales','/interview','/pwreset','/membership-agreement/sign/a','/checkout','/support','/alphascreen/pricing','/alphascreen/roi','/?signin=admin','/?utm_source=campaign','/#access_token=secret','/missing'])assert.equal(ga4Page(new URL(`https://www.alphasourceai.com${suffix}`)),null,suffix);
 for(const origin of ['http://www.alphasourceai.com','https://www.alphasourceai.com:444','https://evil.test','https://interview-agent-frontend-qa.onrender.com','http://localhost:5173'])assert.equal(ga4Page(new URL(origin)),null,origin);
});
test('unknown, rejected, disabled, blocked and read-only preferences load no provider',()=>{
 for(const options of [{choice:null},{choice:false},{enabled:false},{blocked:true},{readonly:true},{url:'https://qa.example/'}]){
  const h=harness(options);h.ga.track('page_viewed');h.ga.track('lead_form_started',{form_id:'home-contact'});assert.equal(h.scripts.length,0,JSON.stringify(options));assert.equal(h.win.dataLayer,undefined);
 }
});
test('one loader and one manual pageview under repeated React events; sanitized config',()=>{
 const h=harness();for(let i=0;i<3;i++)h.ga.track('page_viewed');assert.equal(h.scripts.length,1);assert.equal(h.win[`ga-disable-${GA4_MEASUREMENT_ID}`],true);
 h.load();h.ga.track('page_viewed');const commands=h.commands();
 assert.equal(commands.filter(x=>x[0]==='config').length,1);assert.equal(commands.filter(x=>x[0]==='event'&&x[1]==='page_view').length,1);
 const config=commands.find(x=>x[0]==='config')[2];assert.equal(config.send_page_view,false);assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);assert.equal(config.page_referrer,'');assert.equal(config.page_location,'https://www.alphasourceai.com/');assert.equal(h.scripts[0].referrerPolicy,'no-referrer');
 const consent=commands.find(x=>x[0]==='consent')[2];assert.deepEqual(consent,{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 h.win.history.pushState(null,'','/about/');h.ga.track('page_viewed');h.ga.track('page_viewed');assert.equal(h.commands().filter(x=>x[0]==='event'&&x[1]==='page_view').length,2);
});
test('enumerated event adapter never forwards field values or arbitrary metadata',()=>{
 const pii={email:'buyer@private.test',phone:'5551234567',name:'Secret Person',message:'confidential',form_id:'home-contact',path:'/admin?token=secret'};
 assert.deepEqual(ga4Event('lead_form_submit_succeeded',pii),{name:'lead_form_submit_succeeded',properties:{form_id:'home-contact'}});
 assert.deepEqual(ga4Event('cta_clicked',pii),{name:'cta_clicked',properties:{}});
 assert.equal(ga4Event('unknown',pii),null);assert.equal(ga4Event('lead_form_started',{form_id:'private-client'}),null);assert.equal(ga4Event('lead_form_field_completed',pii),null);
 const h=harness();h.ga.track('page_viewed');h.load();h.ga.track('lead_form_submit_succeeded',pii);assert.doesNotMatch(JSON.stringify(h.commands()),/Secret Person|private.test|confidential|5551234567|token=secret/);
});
test('private push/replace navigate cleanly before changing SPA history; guard installed once',()=>{
 for(const method of ['pushState','replaceState']){
 const h=harness();h.ga.track('page_viewed');const late=h.scripts[0].onload;h.win.history[method](null,'','/dashboard?client=private');assert.equal(h.writes.length,0);assert.deepEqual(h.navigations,['https://www.alphasourceai.com/dashboard?client=private']);late();assert.equal(h.commands().length,0);assert.equal(h.win[`ga-disable-${GA4_MEASUREMENT_ID}`],true);assert.equal(h.listeners.get('popstate').length,1);
 }
});
test('popstate, cross-tab withdrawal and BFCache cannot retain an active tag',()=>{
 const pop=harness();pop.ga.track('page_viewed');pop.load();pop.win.location.href='https://www.alphasourceai.com/admin';let stopped=false;pop.fire('popstate',{stopImmediatePropagation:()=>{stopped=true}});assert.ok(stopped);assert.equal(pop.reloads(),1);assert.equal(pop.commands().length,0);
 const tab=harness();tab.ga.track('page_viewed');tab.load();tab.values.set(key,JSON.stringify({analytics:false}));tab.fire('storage',{key});assert.equal(tab.reloads(),1);
 const cached=harness();cached.ga.track('page_viewed');cached.load();cached.fire('pageshow',{persisted:true});assert.equal(cached.reloads(),1);
});
test('cross-origin history still throws instead of introducing an external redirect',()=>{
 for(const method of ['pushState','replaceState']){const h=harness();h.ga.track('page_viewed');h.load();assert.throws(()=>h.win.history[method](null,'','https://evil.test/'),{name:'SecurityError'});assert.equal(h.navigations.length,0);assert.equal(h.writes.length,0);}
 assert.equal(ga4Page(new URL('https://user:secret@www.alphasourceai.com/')),null);
});
test('withdrawal cancels raced load; failed persistence holds current document without reload',()=>{
 for(const persisted of [true,false]){const h=harness();h.ga.track('page_viewed');const late=h.scripts[0].onload;h.ga.revoke(persisted);late();assert.equal(h.commands().length,0);assert.equal(h.reloads(),Number(persisted));h.ga.track('page_viewed');assert.equal(h.scripts.length,1);}
});
test('sign-in hold works both before and during loader; failure never retries',()=>{
 const before=harness();before.ga.hold();before.ga.track('page_viewed');assert.equal(before.scripts.length,0);
 const during=harness();during.ga.track('page_viewed');const late=during.scripts[0].onload;during.ga.hold();late();assert.equal(during.commands().length,0);
 const failed=harness();failed.ga.track('page_viewed');failed.scripts[0].onerror();failed.ga.track('page_viewed');assert.equal(failed.scripts.length,1);
});
test('no foreign tag, dataLayer or script is overwritten',()=>{
 for(const field of ['gtag','dataLayer','script']){const h=harness();if(field==='gtag')h.win.gtag=()=>{};if(field==='dataLayer')h.win.dataLayer=['existing'];if(field==='script')h.win.document.querySelector=()=>({});h.ga.track('page_viewed');assert.equal(h.scripts.length,0);if(field==='dataLayer')assert.deepEqual(h.win.dataLayer,['existing']);}
});
test('wiring preserves existing first-party submission and gates only the provider',()=>{
 const read=path=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8');
 const events=read('lib/analytics.ts');assert.match(events,/fetch\(endpoint/);assert.match(events,/trackGa4\(eventName, payload.properties\)/);assert.doesNotMatch(events,/window.gtag\?\./);
 const consent=read('context/TrackingConsentContext.tsx');assert.ok(consent.indexOf('revokeGa4(persisted)')<consent.indexOf('setPreferences(nextPreferences)'));
 assert.match(read('main.tsx'),/installGa4NavigationGuard\(\)/);assert.match(read('components/PublicSignInPanel.tsx'),/useLayoutEffect\(\(\) => \{ if \(open\) holdGa4ForDocument\(\)/);
 assert.doesNotMatch(source,/clarity\.ms|clarity\.microsoft|clarity\(/);
 const policy=read('pages/PrivacyPage.tsx');assert.match(policy,/Google Analytics 4/);assert.match(policy,/policies.google.com\/technologies\/partner-sites/);assert.match(policy,/We do not use session replay/);
});
