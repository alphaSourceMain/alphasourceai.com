import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
const compiled=buildSync({entryPoints:[new URL('../src/lib/sessionReplay.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',external:['clarity-js'],define:{'import.meta.env':'{}'}}).outputFiles[0].text;
const {createSessionReplay,replayPage,replayPayload,REPLAY_REVISION,REPLAY_PROJECT,REPLAY_SDK_VERSION}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const key='alphasource:tracking-preferences:v2';
const raw=(url='https://www.alphasourceai.com/')=>JSON.stringify({e:[REPLAY_SDK_VERSION,1,0,50,REPLAY_PROJECT,'anonymous','session',1,0,0,0,url],a:[[0,1,0,['Browser'],1,[url],2,['https://private.test/?token=secret'],3,['Private title'],8,['Secret author'],9,['en-US'],15,['Private tab']],[1,27,'buyer@private.test'],[2,24,'private custom event']],p:[[0,5,'masked layout']]});
function harness({enabled=true,choice=true,revision=true,url='https://www.alphasourceai.com/',referrer='',blocked=false,readonly=false,gpc=false,foreign=false,defer=false,failure=false}={}){
 const values=new Map(choice===null?[]:[[key,JSON.stringify({analytics:false,marketingAttribution:false,sessionReplay:choice,clarityRevision:revision?REPLAY_REVISION:undefined,updatedAt:'2026-10-21T22:00:00.000Z'})]]);
 const listeners=new Map(),documentListeners=new Map(),deliveries=[],navigations=[],cookies=[],attributes={};let reloads=0,starts=0,stops=0,loads=0,configuration,resolveLoad;
 const sdk={start:c=>{starts++;configuration=c},stop:()=>{stops++;configuration?.upload(raw())}};
 const win={location:{href:url,assign:to=>navigations.push(to),reload:()=>reloads++},navigator:{globalPrivacyControl:gpc},
  localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)||null},setItem:(k,v)=>{if(blocked||readonly)throw Error('readonly');values.set(k,v)}},
  history:{pushState:(...args)=>write(args),replaceState:(...args)=>write(args)},
  addEventListener:(n,fn,capture)=>{const v=listeners.get(n)||[];v.push({fn,capture});listeners.set(n,v)},
  fetch:(url,options)=>{deliveries.push({url,options});return Promise.resolve({ok:!failure})},
  clarity:foreign?()=>{}:undefined,
  document:{referrer,activeElement:{closest:()=>null},querySelector:()=>null,body:{setAttribute:(k,v)=>{attributes[k]=v}},
   addEventListener:(n,fn,capture)=>{documentListeners.set(n,{fn,capture})},set cookie(value){cookies.push(value)}}};
 function write(args){const destination=new URL(args[2]??win.location.href,win.location.href);if(destination.origin!==new URL(win.location.href).origin)throw new DOMException('Cross-origin','SecurityError');win.location.href=destination.href;}
 const controller=createSessionReplay(win,enabled,()=>{loads++;return defer?new Promise(resolve=>{resolveLoad=resolve}):Promise.resolve(sdk)});
 return {win,controller,values,listeners,documentListeners,deliveries,navigations,cookies,attributes,starts:()=>starts,stops:()=>stops,loads:()=>loads,reloads:()=>reloads,config:()=>configuration,resolve:()=>resolveLoad(sdk),
  fire:(n,e={})=>listeners.get(n)?.forEach(x=>x.fn(e)),interact:(n,target)=>{let prevented=false,stopped=false;documentListeners.get(n)?.fn({target,key:'Enter',type:n,preventDefault:()=>{prevented=true},stopImmediatePropagation:()=>{stopped=true}});return{prevented,stopped}}};
}
test('replay scope is stricter than GA: no query/hash, unsafe referrer or private host/path',async()=>{
 assert.ok(replayPage('https://www.alphasourceai.com/about/'));
 for(const url of ['https://www.alphasourceai.com/#contact','https://www.alphasourceai.com/?signin=client','https://www.alphasourceai.com/alphascreen/pricing/','https://www.alphasourceai.com/support/','https://www.alphasourceai.com/dashboard/','https://interview-agent-frontend-qa.onrender.com/'])assert.equal(replayPage(url),null,url);
 for(const options of [{enabled:false},{choice:null},{choice:false},{revision:false},{blocked:true},{readonly:true},{gpc:true},{foreign:true},{url:'https://qa.test/'},{referrer:'https://private.test/?token=secret'},{referrer:'https://www.alphasourceai.com/pwreset/'}]){const h=harness(options);await h.controller.start();assert.equal(h.loads(),0,JSON.stringify(options));assert.equal(h.starts(),0);assert.equal(h.listeners.size,0);}
});
test('analytics and marketing grants or an old Allow all never imply replay',async()=>{
 const h=harness({revision:false});h.values.set(key,JSON.stringify({analytics:true,marketingAttribution:true,sessionReplay:true,googleAnalyticsRevision:'ga4-20261021',updatedAt:'2026-10-21T22:00:00.000Z'}));await h.controller.start();assert.equal(h.loads(),0);assert.equal(h.controller.needsConsentRefresh(),true);
 const denied=harness({choice:false});assert.equal(denied.controller.needsConsentRefresh(),false);
 const independent=harness();await independent.controller.start();assert.equal(independent.starts(),1);assert.equal(JSON.parse(independent.values.get(key)).analytics,false);
});
test('one deferred SDK, initial strict mask and disabled secondary transports',async()=>{
 const h=harness();await h.controller.start();await h.controller.start();assert.equal(h.loads(),1);assert.equal(h.starts(),1);assert.equal(h.attributes['data-clarity-mask'],'true');
 const c=h.config();assert.equal(c.projectId,REPLAY_PROJECT);assert.equal(c.content,false);assert.deepEqual(c.mask,['body']);for(const selector of ['form','input','textarea','select','[contenteditable]','[role="dialog"]'])assert.ok(c.drop.includes(selector));
 for(const k of ['report','action','fallback'])assert.equal(c[k],null);for(const k of ['track','fraud','conversions','diagnostics'])assert.equal(c[k],false);assert.deepEqual(c.modules,[]);assert.deepEqual(c.cookies,[]);assert.equal(typeof c.upload,'function');assert.equal(h.listeners.get('popstate').length,1);
});
test('metadata is canonical and custom, input, clipboard and extraction events are dropped',()=>{
 const result=replayPayload(raw(),replayPage('https://www.alphasourceai.com/'));assert.ok(result);assert.doesNotMatch(result,/Private title|private.test|token=secret|Private tab|Secret author|private custom/);const p=JSON.parse(result);assert.deepEqual(p.a,[[0,1,0,['Browser'],1,['https://www.alphasourceai.com/'],3,['alphaSource AI'],9,['en-US']]]);
 for(const url of ['https://www.alphasourceai.com/?token=secret','https://www.alphasourceai.com/admin/','https://private.test/'])assert.equal(replayPayload(raw(url),replayPage('https://www.alphasourceai.com/')),null);
 const wrong=JSON.parse(raw());wrong.e[4]='other-project';assert.equal(replayPayload(JSON.stringify(wrong),replayPage('https://www.alphasourceai.com/')),null);
});
test('one abortable, cookie-free, no-referrer upload to the verified host; no retries',async()=>{
 const h=harness();await h.controller.start();h.config().upload(raw());assert.equal(h.deliveries.length,1);const {url,options}=h.deliveries[0];assert.equal(url,'https://g.clarity.ms/collect');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.equal(options.keepalive,undefined);assert.ok(options.signal);h.controller.hold();assert.ok(options.signal.aborted);
 for(let i=0;i<3;i++)h.config().upload(raw());assert.equal(h.deliveries.length,1,'native stop flush and later restarted uploads cannot reopen live');
 const failed=harness({failure:true});await failed.controller.start();failed.config().upload(raw());await new Promise(resolve=>setImmediate(resolve));failed.config().upload(raw());await failed.controller.start();assert.equal(failed.deliveries.length,1);assert.equal(failed.loads(),1);
});
test('pending import cannot start after withdrawal, a foreign instance or route drift',async()=>{
 for(const action of ['hold','foreign','route','deny']){const h=harness({defer:true});const pending=h.controller.start();if(action==='hold')h.controller.hold();if(action==='foreign')h.win.clarity=()=>{};if(action==='route')h.win.location.href='https://www.alphasourceai.com/pwreset/';if(action==='deny')h.values.set(key,JSON.stringify({sessionReplay:false}));h.resolve();await pending;assert.equal(h.starts(),0,action);assert.equal(h.deliveries.length,0);}
});
test('auth capture precedes an inline panel; forms keep their normal behavior',async()=>{
 for(const kind of ['client','admin']){const h=harness();await h.controller.start();const auth={getAttribute:()=>kind};const event=h.interact('click',{closest:s=>s==='[data-replay-auth]'?auth:null});assert.deepEqual(event,{prevented:true,stopped:true});assert.deepEqual(h.navigations,[`/support/?signin=${kind}`]);h.config().upload(raw());assert.equal(h.deliveries.length,0);}
 const form=harness();await form.controller.start();const event=form.interact('beforeinput',{closest:s=>s==='[data-replay-auth]'?null:{}});assert.deepEqual(event,{prevented:false,stopped:false});form.config().upload(raw());assert.equal(form.deliveries.length,0);
});
test('private history, BFCache and cross-tab denial use clean documents',async()=>{
 for(const method of ['pushState','replaceState']){const h=harness();await h.controller.start();h.win.history[method](null,'','/dashboard?client=private');assert.deepEqual(h.navigations,['https://www.alphasourceai.com/dashboard?client=private']);assert.equal(h.win.location.href,'https://www.alphasourceai.com/');h.config().upload(raw());assert.equal(h.deliveries.length,0);assert.throws(()=>h.win.history[method](null,'','https://evil.test/'),{name:'SecurityError'});}
 const cached=harness();await cached.controller.start();cached.fire('pageshow',{persisted:true});assert.equal(cached.reloads(),1);
 const cross=harness();await cross.controller.start();cross.values.set(key,JSON.stringify({sessionReplay:false}));cross.fire('storage',{key});assert.equal(cross.reloads(),1);assert.ok(cross.cookies.some(x=>x.startsWith('_clck=')));cross.config().upload(raw());assert.equal(cross.deliveries.length,0);
});
test('choice changes reload once after persistence; failed storage holds without reload',async()=>{
 const first=harness({choice:false});assert.equal(first.controller.changeChoice(true,true),true);assert.equal(first.reloads(),1);
 const off=harness({enabled:false});assert.equal(off.controller.changeChoice(true,true),false);assert.equal(off.reloads(),0);assert.equal(off.listeners.size,0);
 for(const persisted of [true,false]){const h=harness();await h.controller.start();h.controller.changeChoice(false,persisted);assert.equal(h.reloads(),Number(persisted));h.config().upload(raw());assert.equal(h.deliveries.length,0);assert.ok(h.cookies.every(c=>/^_(clck|clsk)=/.test(c)));}
});
test('first persisted opt-in cannot start in the old document while reload is pending',async()=>{
 const h=harness({choice:false});
 h.values.set(key,JSON.stringify({analytics:false,marketingAttribution:false,sessionReplay:true,clarityRevision:REPLAY_REVISION,updatedAt:'2026-10-21T22:00:00.000Z'}));
 assert.equal(h.controller.changeChoice(true,true),true);
 // The reload stub does not navigate: simulate React committing the saved choice
 // and rerunning its loader effect before the old document is discarded.
 await h.controller.start();
 assert.equal(h.reloads(),1);assert.equal(h.loads(),0);assert.equal(h.starts(),0);assert.equal(h.deliveries.length,0);
});
test('an unsafe transient URL or consent loss cannot later resume a stale recording',async()=>{
 const hash=harness();await hash.controller.start();hash.fire('hashchange',{newURL:'https://www.alphasourceai.com/#access_token=private'});assert.equal(hash.reloads(),1);hash.config().upload(raw());assert.equal(hash.deliveries.length,0);
 const restored=harness();await restored.controller.start();restored.win.location.href='https://www.alphasourceai.com/?token=private';restored.win.history.replaceState(null,'','/');assert.deepEqual(restored.navigations,['https://www.alphasourceai.com/']);assert.equal(restored.win.location.href,'https://www.alphasourceai.com/?token=private');
 const changed=harness();await changed.controller.start();const prior=changed.values.get(key);changed.values.set(key,JSON.stringify({sessionReplay:false}));changed.config().upload(raw());changed.values.set(key,prior);changed.config().upload(raw());assert.equal(changed.deliveries.length,0);
});
test('wiring adds only separate consent and presentation guards, never auth/form handlers',()=>{
 const read=p=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');const consent=read('context/TrackingConsentContext.tsx');assert.match(consent,/sessionReplay: false/);assert.match(consent,/sessionReplay: preferences.sessionReplay === true && preferences.clarityRevision === REPLAY_REVISION/);assert.match(consent,/holdSessionReplay\(\);/);assert.match(consent,/revokeGa4\(persisted && !replayReload\)/);
 assert.match(read('components/TrackingConsentNotice.tsx'),/label="Session replay"/);assert.match(read('components/Navbar.tsx'),/data-replay-auth="client"/);assert.match(read('components/Footer.tsx'),/data-replay-auth="admin"/);assert.match(read('components/PublicSignInPanel.tsx'),/if \(open\) holdSessionReplay\(\)/);
 const source=read('lib/sessionReplay.ts');assert.doesNotMatch(source,/\.consentv2\(|\.identify\(|\.consent\(|sendBeacon|XMLHttpRequest|scripts\.clarity\.ms|c\.gif/);assert.match(source,/live = false;[\s\S]*sdk\?\.stop\(\)/);assert.match(read('pages/PrivacyPage.tsx'),/Session replay is a separate choice, off by default/);
});
