import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/components/RetailSalesControl.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('RetailSalesControl.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let confirm;
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='confirm')confirm=n;ts.forEachChild(n,visit)}visit(ast);
assert.ok(confirm);
const js=ts.transpileModule(confirm.getText(ast)+';confirm;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function harness(request,{policy={enabled:false,version:5},pending=true,saving=false}={}){
 const calls=[],context={request,policy,pending,saving,retailPolicyQueryKey:['retail-sales-policy'],queryClient:{invalidateQueries:async()=>calls.push(['invalidate'])}};
 for(const key of ['setSaving','setError','setNotice','setPolicy','setPending'])context[key]=value=>calls.push([key,value]);
 return{calls,run:vm.runInNewContext(js,context)};
}
test('actual admin confirmation sends exactly one explicit CAS save and refreshes shared content',async()=>{
 let count=0;const h=harness(async body=>{count++;assert.equal(body.enabled,true);assert.equal(body.confirmed,true);assert.equal(body.expected_version,5);assert.deepEqual(Object.keys(body).sort(),['confirmed','enabled','expected_version']);return{enabled:true,version:6}});
 await h.run();assert.equal(count,1);assert.ok(h.calls.some(([key,p])=>key==='setPolicy'&&p.enabled===true));assert.ok(h.calls.some(([key])=>key==='invalidate'));
});
test('actual failed or stale save disables control, reports refresh, never retries or claims saved',async()=>{
 let count=0;const h=harness(async()=>{count++;throw Error('Synthetic uncertain response')});await h.run();
 assert.equal(count,1);assert.ok(h.calls.some(([key,v])=>key==='setPolicy'&&v===null));
 assert.ok(h.calls.some(([key,v])=>key==='setError'&&v.includes('Refresh to read the saved setting')));
 assert.ok(!h.calls.some(([key,v])=>key==='setNotice'&&v));
});
test('no pending confirmation or concurrent save performs no request; cancel remains non-mutating',async()=>{
 for(const input of [{pending:null},{policy:null},{saving:true}]){let count=0;const h=harness(async()=>{count++},input);await h.run();assert.equal(count,0)}
 assert.match(source,/<AlertDialogCancel disabled=\{saving\}>Cancel<\/AlertDialogCancel>/);
 assert.match(source,/if \(!open && !saving\) setPending\(null\)/);
});
