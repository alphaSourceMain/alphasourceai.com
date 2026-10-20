import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountPublicHashScroll} from './publicHashScroll.mjs';

function fixture({hash='#contact',reduced=false,present=true}={}) {
  const events={},clicks={},calls=[],frames=new Map(),timers=new Map();let next=0,observer;
  const target={isConnected:true,getBoundingClientRect:()=>({top:640})};
  const doc={body:{},fonts:{ready:Promise.resolve()},getElementById:id=>present&&id==='contact'?target:null,
    addEventListener:(n,fn)=>clicks[n]=fn,removeEventListener:n=>delete clicks[n]};
  const win={location:new URL('https://example.test/'+hash),history:{pushState:(_a,_b,url)=>win.location=new URL(url)},
    scrollY:200,getComputedStyle:()=>({scrollMarginTop:'100px'}),matchMedia:()=>({matches:reduced}),
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id),
    addEventListener:(n,fn)=>events[n]=fn,removeEventListener:n=>delete events[n],scrollTo:x=>calls.push(x),
    MutationObserver:class{constructor(fn){this.fn=fn;observer=this}observe(){}disconnect(){this.closed=true}}};
  const flush=async()=>{await Promise.resolve();for(const [id,fn] of frames){frames.delete(id);fn()}};
  const click=(href,overrides={})=>{let prevented=false;clicks.click({button:0,target:{closest:()=>({href})},preventDefault:()=>prevented=true,...overrides});return prevented};
  return {win,doc,calls,events,clicks,frames,timers,flush,click,setPresent:()=>{present=true;observer.fn()},getObserver:()=>observer};
}
test('cold public hash waits for fonts and uses header offset',async()=>{const f=fixture();const stop=mountPublicHashScroll(f.win,f.doc);assert.equal(f.calls.length,0);await f.flush();assert.deepEqual(f.calls,[{top:740,behavior:'smooth'}]);stop()});
test('reduced motion uses auto, paired with public-only root CSS reset',async()=>{const f=fixture({reduced:true});const stop=mountPublicHashScroll(f.win,f.doc);await f.flush();assert.equal(f.calls[0].behavior,'auto');stop()});
test('late mounted target is observed and observer is disconnected',async()=>{const f=fixture({present:false});const stop=mountPublicHashScroll(f.win,f.doc);assert.equal(f.timers.size,1);f.setPresent();await f.flush();assert.equal(f.calls.length,1);assert.equal(f.getObserver().closed,true);assert.equal(f.timers.size,0);stop()});
test('cleanup cancels queued work and listeners',async()=>{const f=fixture();const stop=mountPublicHashScroll(f.win,f.doc);stop();await f.flush();assert.equal(f.calls.length,0);assert.deepEqual(f.events,{});assert.deepEqual(f.clicks,{})});
test('same hash repeated clicks scroll again; different hash updates address',async()=>{const f=fixture({hash:''});const stop=mountPublicHashScroll(f.win,f.doc);assert.equal(f.click('https://example.test/#contact'),true);await f.flush();assert.equal(f.win.location.hash,'#contact');assert.equal(f.click('https://example.test/#contact'),true);await f.flush();assert.equal(f.calls.length,2);stop()});
test('modified, cross-route, cross-origin, query and malformed links keep native behavior',()=>{const f=fixture({hash:''});const stop=mountPublicHashScroll(f.win,f.doc);for(const [href,opts] of [['https://example.test/#contact',{ctrlKey:true}],['https://example.test/about/#contact',{}],['https://other.test/#contact',{}],['https://example.test/?buyer=private#contact',{}],['https://example.test/#%E0%A4%A',{}]])assert.equal(f.click(href,opts),false);stop()});
test('expired mount observation is bounded',()=>{const f=fixture({present:false});const stop=mountPublicHashScroll(f.win,f.doc);[...f.timers.values()][0]();assert.equal(f.getObserver().closed,true);stop()});
