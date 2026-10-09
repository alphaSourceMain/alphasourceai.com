import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=join(dirname(fileURLToPath(import.meta.url)),'../../..');
process.env.PORT||='4183';process.env.BASE_PATH||='/';process.env.NODE_ENV='test';
process.env.VITE_SUPABASE_URL||='https://example.supabase.co';process.env.VITE_SUPABASE_ANON_KEY||='test-anon-key';
const server=await createServer({appType:'custom',configFile:join(root,'vite.config.ts'),logLevel:'silent',optimizeDeps:{include:[],noDiscovery:true},root,server:{hmr:false,middlewareMode:true}});
const {usesDemoManagerPage,isDemoWorkspace,DemoWorkspaceContent,demoManagerMode}=await server.ssrLoadModule('/src/components/SalesDemoManagerContent.tsx');
after(async()=>server.close());
const req=createRequire('/Users/jasongardner/Desktop/ai-interview-final/QA/tmp/sales-demo-20261008-backend/package.json');
const data=req('./demo/workspace').buildWorkspace();
test('demo adapters require the server flag and exact client, normal clients remain on live pages',()=>{
  assert.equal(usesDemoManagerPage({id:data.client_id,is_sales_demo:true}),true);
  for(const c of [{id:data.client_id,is_sales_demo:false},{id:'other',is_sales_demo:true},{id:data.client_id}])assert.equal(usesDemoManagerPage(c),false);
  assert.equal(isDemoWorkspace(data),true);assert.equal(isDemoWorkspace({...data,client_id:'other'}),false);assert.equal(isDemoWorkspace({...data,synthetic:false}),false);assert.equal(isDemoWorkspace({...data,read_only:false}),false);
  assert.equal(isDemoWorkspace({...data,version:99}),false);
  assert.equal(demoManagerMode({id:data.client_id,is_sales_demo:true},data.client_id),'demo');
  assert.equal(demoManagerMode({id:'real-client'},undefined),'live');
  for(const client of [{id:data.client_id},{id:'wrong',is_sales_demo:true},{id:'real-client',is_sales_demo:false}])assert.equal(demoManagerMode(client,data.client_id),'blocked');
  assert.equal(demoManagerMode({id:data.client_id,is_sales_demo:true},undefined),'blocked');
});
test('all five manager previews display synthetic data with no consequential controls',()=>{
  for(const page of ['billing','entities','members','automation','profile']){
    const html=renderToStaticMarkup(React.createElement(DemoWorkspaceContent,{page,data}));
    assert.match(html,/Synthetic manager workspace/);assert.match(html,/fictional/);
    assert.ok(!/<button\b/.test(html));assert.match(html,/preview only/);
    assert.ok(!/href=|<form\b|type="submit"/.test(html));
    if(page==='billing'){assert.match(html,/DEMO-INV-1003/);assert.match(html,/\$1,997\.00/);assert.match(html,/Invoice History/);}
    if(page==='entities'){assert.match(html,/Northstar Coastal Branch/);assert.match(html,/not selectable client scopes/);}
    if(page==='automation')assert.match(html,/Avery Morgan/);
  }
});
