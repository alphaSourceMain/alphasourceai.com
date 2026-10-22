import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function moduleAt(path){
  const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context=vm.createContext({exports:{},URL});vm.runInContext(code,context);return context.exports;
}
const {supportVoiceOrigin}=moduleAt('../src/lib/supportVoiceOrigin.ts');
const {checkoutPasswordSetupHref,CLIENT_PASSWORD_SETUP_HREF}=moduleAt('../src/lib/checkoutPasswordSetup.ts');
test('QA voice accepts only the same backend origin with zero or one trailing slash',()=>{
  const origin='https://ia-backend-qa.onrender.com';
  for(const environment of ['staging','',null,undefined])for(const raw of [origin,origin+'/'])assert.equal(supportVoiceOrigin(raw,environment),origin);
  for(const raw of [origin+'//',origin+'/path',origin+'?x=1',origin+'/#x',origin+' ',origin+'@evil.invalid',
    'https://user@ia-backend-qa.onrender.com','http://ia-backend-qa.onrender.com','https://ia-backend-qa.onrender.com.evil.invalid',
    'https://interview-agent-backend-qa.onrender.com',null,{}])assert.equal(supportVoiceOrigin(raw,'staging'),null);
  assert.equal(supportVoiceOrigin(origin,'development'),null);assert.equal(supportVoiceOrigin(origin,'production'),null);
  const dev='https://interview-agent-backend-qa.onrender.com';
  for(const raw of [dev,dev+'/'])assert.equal(supportVoiceOrigin(raw,'development'),dev);
  assert.equal(supportVoiceOrigin(dev+'//','development'),null);
});
test('password setup handoff requires the successful exact backend status and carries no checkout capability',()=>{
  assert.equal(CLIENT_PASSWORD_SETUP_HREF,'/support/?signin=client&setup=password');
  assert.equal(checkoutPasswordSetupHref(true,{status:'password_required'}),CLIENT_PASSWORD_SETUP_HREF);
  for(const status of ['ready','setup_email_sent','setup_pending','activation_pending','payment_pending','cancelled','PASSWORD_REQUIRED',null])
    assert.equal(checkoutPasswordSetupHref(true,{status}),null);
  for(const value of [null,undefined,'password_required',[],{password_setup_required:true},{status:'ready',password:'required'}])
    assert.equal(checkoutPasswordSetupHref(true,value),null);
  assert.equal(checkoutPasswordSetupHref(false,{status:'password_required'}),null);
  assert.doesNotMatch(CLIENT_PASSWORD_SETUP_HREF,/session_id|agreement_id|client_id|token|action_link/);
});
test('setup presentation reuses the existing email recovery and never sends on page load',()=>{
  const nav=fs.readFileSync(new URL('../src/components/Navbar.tsx',import.meta.url),'utf8');
  assert.match(nav,/title=\{passwordSetupMode \? "Set up your password"/);
  assert.match(nav,/!passwordSetupMode && <input\s+type="password"/);
  assert.match(nav,/event\.preventDefault\(\); void startReset\(\)/);
  assert.equal((nav.match(/resetPasswordForEmail\(/g)||[]).length,1);
  assert.match(nav,/const redirectTo = buildPwResetUrl\(\{ origin: "client" \}\)/);
  assert.match(nav,/Already have a password\? Sign in/);
  const checkout=fs.readFileSync(new URL('../src/pages/CheckoutSubscriptionSuccessPage.tsx',import.meta.url),'utf8');
  assert.match(checkout,/checkoutPasswordSetupHref\(response\.ok, data\)/);
  assert.match(checkout,/initialStatus !== "cancelled"\) void loadCheckoutStatus\(false\)/);
  assert.doesNotMatch(checkout,/auth\.admin|generateLink\(|inviteUserByEmail|resetPasswordForEmail/);
  const initial=nav.slice(nav.indexOf('useEffect(() => {'),nav.indexOf('useEffect(() => {',nav.indexOf('useEffect(() => {')+1));
  assert.doesNotMatch(initial,/startReset\(|resetPasswordForEmail\(/);
});
