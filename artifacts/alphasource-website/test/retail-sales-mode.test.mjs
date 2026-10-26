import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const compiled=await build({stdin:{contents:`export * from './src/content/retailSalesContent.ts';export * from './src/lib/publicContent.ts';export * from './src/content/dashboardSupportContent.ts';`,resolveDir:root.pathname,loader:'ts'},alias:{'@':new URL('src',root).pathname},bundle:true,write:false,platform:'node',format:'esm'});
const content=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
test('ON returns exact original content; OFF switches public/client/voice-copy pricing together without mutation',()=>{
  for(const original of [content.publicFaqSections,content.faqSections,content.publicSupportQuestions,content.publicSupportTopics,content.productUpdates,content.publicProductUpdates]){
    const before=JSON.stringify(original);assert.equal(content.retailContentForMode(original,true),original);
    const off=content.retailContentForMode(original,false);assert.equal(JSON.stringify(original),before);
    assert.doesNotMatch(JSON.stringify(off),/\$1,200 for 3 months|\$1,950 for 6 months|offer 3-, 6-, and 12-month terms online|Choose a 3-, 6-, or 12-month/);
  }
  for(const sections of [content.publicFaqSections,content.faqSections]){
    const off=content.retailContentForMode(sections,false).flatMap(s=>s.items);
    const pricing=off.find(q=>q.question==='How does pricing work?').answer;
    for(const amount of ['$349','$649','$3,300','$6,500','$4,188','$7,788'])assert.ok(pricing.includes(amount));
    assert.match(pricing,/12 months/);assert.match(pricing,/new online retail signup is currently unavailable/);
  }
});
test('static and loading commercial guidance has no stale numbers or offer metadata',()=>{
  const neutral=JSON.stringify(content.neutralRetailContent([content.publicFaqSections,content.publicSupportTopics,content.productUpdates,{offers:[{price:'1200'}]}]));
  assert.doesNotMatch(neutral,/\$[\d,]|3-,|"offers"/);
  assert.match(neutral,/current membership pricing/);
  const structured=content.retailContentForMode({'@type':'Question',name:'How does pricing work?',acceptedAnswer:{'@type':'Answer',text:'old'}},false);
  assert.match(structured.acceptedAnswer.text,/\$349 monthly for 12 months/);
});
test('all support surfaces select shared mode; original exports and accepted billing source remain separate',()=>{
  for(const file of ['src/pages/FaqPage.tsx','src/pages/SupportPage.tsx','src/pages/dashboard/FaqPage.tsx'])assert.match(read(file),/useRetailContent/);
  assert.match(read('src/components/Seo.tsx'),/withoutOfferMetadata/);
  assert.match(read('src/pages/admin/AdminOverviewPage.tsx'),/<RetailSalesControl \/>/);
  const control=read('src/components/RetailSalesControl.tsx');
  for(const expected of ['AlertDialogCancel','confirmed: true','expected_version: policy.version','setPolicy(null)','Refresh to read the saved setting'])assert.ok(control.includes(expected));
  const provider=read('src/context/RetailSalesContext.tsx');
  assert.match(provider,/enabled: !query.isError && query.data\?\.enabled === true/);
  assert.match(provider,/cache: "no-store"/);assert.match(provider,/retry: false/);
  assert.match(provider,/if \(!verifiedPublicCatalog\(body\).catalog\) throw/);
  assert.match(read('src/pages/AlphaScreenPricingPage.tsx'),/retailEnabled && presentationReady && <button/);
});
