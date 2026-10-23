import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as terms from './membershipTerms.ts';
import {parseMembershipQuoteCatalog,membershipCardPricing} from './membershipQuoteCatalog.ts';
import {savedPublicMembershipTerms} from './publicMembershipQuote.ts';
const require=createRequire(import.meta.url);
const backend=process.env.MEMBERSHIP_PRICING_BACKEND_ROOT || fileURLToPath(new URL('../../../../../backend-dev-20261010/',import.meta.url));
const {retailQuoteCatalog}=require(`${backend}/src/services/retailQuoteSelection.js`);
const {buildRetailPackageSnapshot}=require(`${backend}/src/services/membershipPackageCompatibility.js`);
const raw=()=>retailQuoteCatalog('public',{MEMBERSHIP_PRICING_TERMS_ENABLED:'true'});
const selectorSource=fs.readFileSync(new URL('../components/MembershipTermsSelector.tsx',import.meta.url),'utf8');
const selectorAst=ts.createSourceFile('selector.tsx',selectorSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const selectorDeclaration=selectorAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='MembershipTermsSelector');
const selectorJs=ts.transpileModule(selectorDeclaration.getText(selectorAst).replace(/^export /,''),
 {compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
const Selector=vm.runInNewContext(selectorJs+';MembershipTermsSelector;',{React,useId:React.useId,...terms});
test('current full12 public catalog, old6 rollout compatibility, and no partial/mixed schedule catalog',()=>{
 const full=raw(),catalog=parseMembershipQuoteCatalog(full,'public');assert.equal(catalog.offers.length,12);
 const old={...full,offers:full.offers.filter(o=>o.payment_option==='prepaid')};
 assert.equal(parseMembershipQuoteCatalog(old,'public').offers.length,6);
 for(const mutate of [c=>c.offers.pop(),c=>c.offers=c.offers.filter(o=>o.payment_option==='monthly_installments'),
  c=>c.offers[0].offer_version='stale',c=>c.offers[0]=c.offers[1],
  c=>c.monthly_payment_references.basic[3]++,c=>c.offers[0].installment_count=99]){
  const copy=structuredClone(full);mutate(copy);assert.throws(()=>parseMembershipQuoteCatalog(copy,'public'));
 }
 for(const offer of catalog.offers.filter(o=>o.payment_option==='monthly_installments'))
  assert.equal(membershipCardPricing(catalog,offer.plan_key,offer.commitment_months).monthlyPaymentCents,offer.platform_payment_cents);
});
test('actual retail selector renders both schedules only for complete monthly choices and keeps monthly obligations',()=>{
 const c=parseMembershipQuoteCatalog(raw(),'public');
 for(const offer of c.offers){
  const html=renderToStaticMarkup(React.createElement(Selector,{offers:c.offers,planKey:offer.plan_key,audience:'public',
   selection:{offerKey:offer.offer_key,offerVersion:offer.offer_version},onChange:()=>{}}));
  assert.match(html,/Pay upfront/);assert.match(html,/Pay monthly/);
  assert.ok(html.includes(terms.membershipMoney(offer.platform_payment_cents)));
  if(offer.payment_option==='monthly_installments'){
   assert.match(html,new RegExp(`All ${offer.commitment_months} monthly payments remain due`));
   assert.ok(html.includes(terms.membershipMoney(offer.platform_commitment_total_cents)));
   assert.doesNotMatch(html,/Your membership stays active for the full prepaid term/);
  }
 }
 for(const offers of [c.offers.filter(o=>o.payment_option==='prepaid'),c.offers.filter(o=>o.offer_key!=='basic-6-monthly_installments')]){
  const html=renderToStaticMarkup(React.createElement(Selector,{offers,planKey:'basic',audience:'public',selection:null,onChange:()=>{}}));
  assert.doesNotMatch(html,/Pay monthly/);
 }
});
// Execute the ACTUAL panel's pre-render calculations, not a copied copy helper.
const page=fs.readFileSync(new URL('../pages/AlphaScreenPricingPage.tsx',import.meta.url),'utf8');
const pageAst=ts.createSourceFile('pricing.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const panel=pageAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='PurchaseIntentPanel');
const start=panel.body.statements.findIndex(n=>ts.isVariableStatement(n)&&n.declarationList.declarations[0]?.name?.getText(pageAst)==='savedPackage');
const stop=panel.body.statements.findIndex((n,i)=>i>start&&ts.isIfStatement(n)&&n.expression.getText(pageAst).includes('status === "success"'));
const prelude=panel.body.statements.slice(start,stop).map(n=>n.getText(pageAst)).join('\n');
const js=ts.transpileModule('(()=>{'+prelude+';return {termLabel,renewalCopy,totalDueToday};})();',
 {fileName:'panel.tsx',compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
test('actual fresh and saved monthly panel calculations show monthly commitment, no prepaid claim, no live repricing',()=>{
 const c=parseMembershipQuoteCatalog(raw(),'public');
 for(const offer of c.offers.filter(o=>o.payment_option==='monthly_installments'))for(const saved of [false,true]){
  const pkg=buildRetailPackageSnapshot({channel:'public',planKey:offer.plan_key,commitmentMonths:offer.commitment_months,
   paymentOption:offer.payment_option,offerVersion:offer.offer_version,firstRolePrepaySelected:true});
  const summary={...pkg,billing_model:pkg.membership_terms.billing_model,rollover_days:pkg.membership_terms.rollover_days};
  delete summary.membership_terms;delete summary.pricing_protocol;
  const selectedPlan={...pkg};
  const result=saved?{purchase_intent_id:'synthetic',selected_package:summary}:null;
  const value=vm.runInNewContext(js,{React,agreementResult:null,result,selectedPlan,form:{first_role_prepay_selected:true},
   catalog:saved?null:c,selection:{offerKey:offer.offer_key,offerVersion:offer.offer_version},
   savedPublicMembershipTerms,...terms,cadenceOptions:()=>[],firstRoleDiscountPercent:()=>10,
   firstRolePrepayFee:()=>0,formatUsd:n=>'$'+n,platformFeeForCadence:()=>0,cadenceLabel:()=>''});
  assert.match(value.termLabel,/monthly payments/);assert.doesNotMatch(value.termLabel,/prepaid/);
  assert.match(value.renewalCopy,new RegExp(`All ${offer.commitment_months} monthly payments remain due`));
  assert.ok(value.renewalCopy.includes(terms.membershipMoney(offer.platform_commitment_total_cents)));
  assert.doesNotMatch(value.renewalCopy,/Access lasts the full prepaid term/);
  assert.equal(Math.round(value.totalDueToday*100),pkg.platform_fee_cents+pkg.first_role_prepay.discounted_credit_amount_cents);
 }
});
