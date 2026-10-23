import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup() {
  const values = new Map();
  const sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const window = { sessionStorage };
  const source = fs.readFileSync(new URL('./checkoutPasswordSetup.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ exports: {}, window });
  vm.runInContext(code, context);
  return { values, window, ...context.exports };
}

test('checkout continuity is tab-only, exact-session, time-limited and consumed before any request', () => {
  const token = 'synthetic-secret-token-01234567890123456789';
  const c = setup();
  c.rememberCheckoutSetupProof('cs_test_synthetic', token);
  assert.equal(c.values.size, 1);
  assert.equal(c.consumeCheckoutSetupProof('cs_test_synthetic'), token);
  assert.equal(c.values.size, 0);
  assert.equal(c.consumeCheckoutSetupProof('cs_test_synthetic'), null);
  for (const kind of ['wrong-session', 'expired', 'future', 'malformed', 'short-token']) {
    c.rememberCheckoutSetupProof('cs_test_synthetic', token);
    const [key, raw] = [...c.values][0], proof = JSON.parse(raw);
    if (kind === 'expired') proof.savedAt = Date.now() - 3600001;
    if (kind === 'future') proof.savedAt = Date.now() + 100000;
    if (kind === 'short-token') proof.token = 'short';
    c.values.set(key, kind === 'malformed' ? '{' : JSON.stringify(proof));
    assert.equal(c.consumeCheckoutSetupProof(kind === 'wrong-session' ? 'other' : 'cs_test_synthetic'), null);
    assert.equal(c.values.size, 0);
  }
});

test('storage restrictions fail safely without blocking checkout or minting a capability', () => {
  const c = setup();
  Object.defineProperty(c.window, 'sessionStorage', { get() { throw Error('storage denied'); } });
  assert.doesNotThrow(() => c.rememberCheckoutSetupProof('cs_test_synthetic', 'synthetic-secret-token-01234567890123456789'));
  assert.equal(c.consumeCheckoutSetupProof('cs_test_synthetic'), null);
  assert.equal(c.checkoutPasswordSetupHref(true, { status: 'password_required', password_setup_token_hash: 'a'.repeat(56) }), null);
});

test('recovery capability is handed to the existing form in tab storage, never a URL, and consumed once', () => {
  const c = setup(), hash = 'a'.repeat(56);
  const href = c.checkoutPasswordSetupHref(true, { status: 'password_required', password_setup_token_hash: hash, action_link: 'https://evil.invalid' });
  assert.equal(href, '/pwreset?origin=client');assert.equal(href.includes(hash), false);
  assert.equal(c.consumeCheckoutPasswordToken(), hash);assert.equal(c.values.size, 0);
  assert.equal(c.consumeCheckoutPasswordToken(), null);
  c.checkoutPasswordSetupHref(true, { status: 'password_required', password_setup_token_hash: hash });
  const [key, raw] = [...c.values][0], item = JSON.parse(raw);item.savedAt = Date.now() - 120001;
  c.values.set(key, JSON.stringify(item));assert.equal(c.consumeCheckoutPasswordToken(), null);
});

test('Supabase SHA-224 recovery hashes are accepted; wrong-length or non-hex capabilities are refused', () => {
  const c=setup();
  for (const hash of ['a'.repeat(55), 'a'.repeat(57), 'a'.repeat(64), 'g'.repeat(56), 'https://example.invalid']) {
    assert.equal(c.checkoutPasswordSetupHref(true, {status:'password_required',password_setup_token_hash:hash}),null);
    assert.equal(c.values.size,0);
  }
  c.checkoutPasswordSetupHref(true,{status:'password_required',password_setup_token_hash:'a'.repeat(56)});
  const [key,raw]=[...c.values][0];const item=JSON.parse(raw);item.token='a'.repeat(64);c.values.set(key,JSON.stringify(item));
  assert.equal(c.consumeCheckoutPasswordToken(),null);assert.equal(c.values.size,0);
});
