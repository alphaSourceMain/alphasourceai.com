import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=join(dirname(fileURLToPath(import.meta.url)),'../../..');
process.env.PORT||='4182';process.env.BASE_PATH||='/';process.env.NODE_ENV='test';
process.env.VITE_SUPABASE_URL||='https://example.supabase.co';process.env.VITE_SUPABASE_ANON_KEY||='test-anon-key';
const server=await createServer({appType:'custom',configFile:join(root,'vite.config.ts'),logLevel:'silent',optimizeDeps:{include:[],noDiscovery:true},root,server:{hmr:false,middlewareMode:true}});
const {mapRowToCandidate}=await server.ssrLoadModule('/src/pages/dashboard/CandidatesPage.tsx');
after(async()=>server.close());
function row(overrides={}){return {is_sales_demo:true,interview_score:75,interview_state:'scored',interview_analysis:{clarity:79,confidence:73,engagement:81,summary:'[SYNTHETIC DEMO] Example'},perception_scores:{unavailable:true,mode:'demo',synthetic:true},transcript_scores:{confidence:72,ai_aided_risk:'medium'},...overrides};}
test('server-confirmed synthetic demo fills three bars and both signals without claiming real media',()=>{
  const c=mapRowToCandidate(row(),0);
  assert.deepEqual(c.interviewSubs.map(x=>x.score),[79,73,81]);assert.equal(c.reliability,72);assert.equal(c.reliabilityState,'available');assert.equal(c.risk,'Medium');assert.equal(c.isSalesDemo,true);
});
test('non-demo and incomplete demo markers cannot override unavailable perception',()=>{
  for(const overrides of [{is_sales_demo:false},{is_sales_demo:undefined},{perception_scores:{unavailable:true,mode:'demo'}},{perception_scores:{unavailable:true,mode:'video',synthetic:true}}]){
    const c=mapRowToCandidate(row(overrides),0);assert.deepEqual(c.interviewSubs.map(x=>x.score),[null,null,null]);assert.equal(c.reliability,null);
  }
});
test('text interview semantics are unchanged even with synthetic flag',()=>{
  const c=mapRowToCandidate(row({perception_scores:{unavailable:true,mode:'text',synthetic:true}}),0);assert.deepEqual(c.interviewSubs.map(x=>x.score),[null,null,null]);assert.equal(c.reliabilityState,'not_applicable');
});
