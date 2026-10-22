import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { JSDOM, CookieJar, VirtualConsole } from 'jsdom';
import { buildSync } from 'esbuild';
const require=createRequire(import.meta.url);
const published=readFileSync(require.resolve('clarity-js'),'utf8');
const metadata=JSON.parse(readFileSync(require.resolve('clarity-js/package.json'),'utf8'));
const compiled=buildSync({entryPoints:[new URL('../src/lib/sessionReplay.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',external:['clarity-js'],define:{'import.meta.env':'{}'}}).outputFiles[0].text;
const {createSessionReplay,REPLAY_REVISION}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const key='alphasource:tracking-preferences:v2';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('pinned patched SDK masks real DOM, uses only callback transport, and cannot upload after stop/restart/denial', {timeout:8000}, async()=>{
 assert.equal(metadata.version,'0.8.72');
 const cookieJar=new CookieJar();
 const dom=new JSDOM('<!doctype html><html lang="en"><head><title>Public marketing</title></head><body><p>MASK_THIS_PUBLIC_TEXT</p><form><label>Private form<input value="buyer-private@example.invalid"></label><textarea>PRIVATE_MESSAGE_NEVER_SEND</textarea></form><div role="dialog">PRIVATE_DIALOG_NEVER_SEND</div></body></html>',{url:'https://www.alphasourceai.com/',runScripts:'outside-only',pretendToBeVisual:true,cookieJar,virtualConsole:new VirtualConsole()});
 const win=dom.window, requests=[],unwanted=[],rawPackets=[],gcmListeners=[],sdkErrors=[];
 let sdk;
 try {
  win.TextEncoder=TextEncoder;win.TextDecoder=TextDecoder;
  win.requestIdleCallback=callback=>win.setTimeout(()=>callback({didTimeout:false,timeRemaining:()=>50}),0);
  win.cancelIdleCallback=id=>win.clearTimeout(id);
  // jsdom has DOM semantics but no renderer/hit testing; geometry is synthetic.
  win.document.elementFromPoint=()=>win.document.body;
  win.document.elementsFromPoint=()=>[win.document.body];
  // All network is synthetic; any native transport or dynamic module is a failure.
  win.XMLHttpRequest=class {constructor(){unwanted.push('nativeXHR');throw Error('native transport forbidden')}};
  win.navigator.sendBeacon=()=>{unwanted.push('nativeBeacon');return false};
  const createElement=win.document.createElement.bind(win.document);
  win.document.createElement=(tag,...args)=>{if(String(tag).toLowerCase()==='script')unwanted.push('dynamicScript');return createElement(tag,...args)};
  win.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,status:204}};
  win.google_tag_data={ics:{usedUpdate:true,addListener:(_keys,listener)=>gcmListeners.push(listener),getConsentState:()=>1}};
  win.document.cookie='_clck=OLD_FOREIGN_REPLAY_ID^3^zzzz^1;Path=/;Secure';
  win.localStorage.setItem(key,JSON.stringify({analytics:false,marketingAttribution:false,sessionReplay:true,clarityRevision:REPLAY_REVISION,updatedAt:'2026-10-21T22:00:00.000Z'}));
  const context=dom.getInternalVMContext();context.exports={};
  // Match CommonJS's module wrapper; don't leak its local `var clarity` onto window.
  vm.runInContext(`(function(exports){${published}\n})(exports);`,context,{filename:'clarity-js-0.8.72.cjs'});
  sdk=context.exports.clarity;
  let requestedImports=0;
  const wrapped={start:configuration=>{try{sdk.start({...configuration,delay:20,upload:packet=>{rawPackets.push(packet);configuration.upload(packet)}})}catch(error){sdkErrors.push(error.message);throw error}},stop:()=>sdk.stop()};
  const controller=createSessionReplay(win,true,async()=>{requestedImports++;return wrapped});
  await controller.start();
  for(let i=0;i<40&&!rawPackets.length;i++)await pause(25);
  assert.equal(requestedImports,1);
  assert.deepEqual(sdkErrors,[]);
  assert.ok(requests.length>0,`real published SDK must emit a native packet through the callback (${rawPackets.length} raw packets)`);
  assert.ok(rawPackets.some(packet=>Array.isArray(JSON.parse(packet).p)&&JSON.parse(packet).p.length>0),'real layout playback, not an empty metadata fixture');
  for(const packet of rawPackets)assert.doesNotMatch(packet,/buyer-private@example\.invalid|PRIVATE_MESSAGE_NEVER_SEND|PRIVATE_DIALOG_NEVER_SEND|MASK_THIS_PUBLIC_TEXT|OLD_FOREIGN_REPLAY_ID/);
  assert.ok(requests.every(request=>request.url==='https://g.clarity.ms/collect'&&request.options.credentials==='omit'&&request.options.referrerPolicy==='no-referrer'));
  assert.deepEqual(unwanted,[]);
  // The vendor's real history proxy stops and schedules its imported start().
  win.history.pushState(null,'','/about/');
  const priorRaw=rawPackets.length;
  const priorRequests=requests.length;
  win.localStorage.setItem(key,JSON.stringify({sessionReplay:false,clarityRevision:REPLAY_REVISION,updatedAt:'2026-10-21T22:00:00.000Z'}));
  controller.changeChoice(false,false); // failed persistence fixture: don't navigate the DOM shim
  gcmListeners.forEach(listener=>listener());
  await pause(550);
  sdk.start(); // Explicitly exercise another late native restart with the retained callback.
  await pause(80);
  assert.ok(rawPackets.length>=priorRaw,'real stop/restart path exercised');
  assert.equal(requests.length,priorRequests,'flush, GCM and imported restart cannot reopen the application upload gate');
  win.dispatchEvent(new win.Event('pagehide'));
  assert.doesNotMatch(win.document.cookie,/_clck=|_clsk=/);
  assert.deepEqual(unwanted,[]);
 } finally {try{sdk?.stop()}catch{}await pause(30);dom.window.close();}
 // A clean document with replay denied never imports the SDK, even with GCM granted.
 const fresh=new JSDOM('<!doctype html><body>Clean denied document</body>',{url:'https://www.alphasourceai.com/',cookieJar});
 try {
  fresh.window.localStorage.setItem(key,JSON.stringify({sessionReplay:false,clarityRevision:REPLAY_REVISION,updatedAt:'2026-10-21T22:00:00.000Z'}));
  fresh.window.google_tag_data={ics:{usedUpdate:true,getConsentState:()=>1}};
  let imports=0;await createSessionReplay(fresh.window,true,async()=>{imports++;throw Error('must not import')}).start();assert.equal(imports,0);assert.doesNotMatch(fresh.window.document.cookie,/_clck=|_clsk=/);
 } finally {fresh.window.close();}
 assert.equal(createHash('sha256').update(published).digest('hex'),'4dc39709d4da9f9ba33146c6df0afe83b2c275b67e29ca93604f589ae08c22f8');
 const esm=readFileSync(new URL('../node_modules/clarity-js/build/clarity.module.js',import.meta.url));
 assert.equal(createHash('sha256').update(esm).digest('hex'),'7264e1989d3f81e9f51b1850d421eb87aa2aef3d157c3a6f6a0b3bf10307372e');
});

test('native asynchronous upload must remain safe when stop resets its envelope',async()=>{
 const dom=new JSDOM('<!doctype html><body>Public layout</body>',{url:'https://www.alphasourceai.com/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 let sdk;
 try{
  dom.window.document.elementFromPoint=()=>dom.window.document.body;
  // Transport-only fixture: layout idle work is covered by the full DOM test above.
  dom.window.requestIdleCallback=()=>1;dom.window.cancelIdleCallback=()=>{};
  const context=dom.getInternalVMContext();context.exports={};
  // Expose an existing closure only to await its real promise; no native logic is replaced.
  vm.runInContext(`(function(exports){${published}\nexports.fixtureUpload=upload;})(exports);`,context);
  sdk=context.exports.clarity;
  sdk.start({projectId:'z1ekxf8e7y',upload:()=>{},track:false,content:false,report:null,modules:[],cookies:[],fraud:false,conversions:false});
  const pending=context.exports.fixtureUpload(false);
  sdk.stop();
  await assert.doesNotReject(pending);
 }finally{try{sdk?.stop()}catch{}await pause(30);dom.window.close();}
});

test('patched string transport still awaits compression and uses its original XHR branch',async()=>{
 const dom=new JSDOM('<!doctype html><body>Public fixture</body>',{url:'https://www.alphasourceai.com/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 let sdk;
 try{
  const sends=[];
  dom.window.document.elementFromPoint=()=>dom.window.document.body;
  dom.window.requestIdleCallback=()=>1;dom.window.cancelIdleCallback=()=>{};
  dom.window.XMLHttpRequest=class{open(method,url){this.method=method;this.url=url}send(body){sends.push({method:this.method,url:this.url,body})}setRequestHeader(){}};
  const context=dom.getInternalVMContext();context.exports={};
  vm.runInContext(`(function(exports){${published}\nexports.fixtureUpload=upload;})(exports);`,context);
  sdk=context.exports.clarity;
  sdk.start({projectId:'z1ekxf8e7y',upload:'https://g.clarity.ms/collect',track:false,content:false,report:null,modules:[],cookies:[],fraud:false,conversions:false});
  const pending=context.exports.fixtureUpload(false);
  assert.equal(sends.length,0,'string branch retains its asynchronous compression boundary');
  await pending;
  assert.equal(sends.length,1);assert.equal(sends[0].url,'https://g.clarity.ms/collect');assert.equal(sends[0].method,'POST');assert.equal(JSON.parse(sends[0].body).e[4],'z1ekxf8e7y');
 }finally{try{sdk?.stop()}catch{}await pause(30);dom.window.close();}
});
