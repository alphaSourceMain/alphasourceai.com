import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Execute the existing page and its actual effect with authored Auth responses.
// This is local component verification, not a hosted recovery/session claim.
function pageCase({ direct = true, hash = '', authError = false } = {}) {
  const states = [], refs = [], effects = [], history = [], calls = [];
  let stateIndex = 0, refIndex = 0, reads = 0;
  const hooks = { ...React,
    useState(initial) { const n = stateIndex++;if (!(n in states)) states[n] = initial;
      return [states[n], value => states[n] = typeof value === 'function' ? value(states[n]) : value]; },
    useRef(initial) { const n = refIndex++;return refs[n] ||= { current: initial }; },
    useMemo: fn => fn(), useEffect: fn => effects.push(fn),
  };
  const auth = {
    verifyOtp: async args => { calls.push({ method: 'verifyOtp', args, cleaned: history.at(-1) });return { error: authError ? Error('synthetic expired') : null }; },
    getSession: async () => ({ data: { session: authError ? null : { user: { id: 'SYNTHETIC' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    updateUser: () => { throw Error('No password write authorized by this local component test'); },
  };
  const code = ts.transpileModule(fs.readFileSync(new URL('./PwResetPage.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  const context = vm.createContext({ exports: {}, React: hooks, URL, URLSearchParams, crypto: { randomUUID: () => 'SYNTHETIC' },
    window: { location: { href: 'https://synthetic.invalid/pwreset?origin=client' + hash },
      history: { state: null, replaceState: (_state, _title, value) => history.push(value) },
      localStorage: { setItem() {}, getItem: () => 'admin' } },
    require(name) { if (name === 'react') return hooks;
      if (name === '@/lib/supabaseClient') return { supabase: { auth } };
      if (name === '@/lib/checkoutPasswordSetup') return { consumeCheckoutPasswordToken: () => { reads++;return direct ? 'a'.repeat(64) : null; } };
      throw Error('Unexpected module ' + name);
    },
  });
  vm.runInContext(code, context);
  const render = () => { stateIndex = 0;refIndex = 0;return context.exports.default(); };
  render();return { render, effects, history, calls, reads: () => reads };
}

test('paid checkout goes straight to existing password fields, no email entry, one exchange even across effect replay', async () => {
  const c = pageCase();
  const cleanup = c.effects[0]();cleanup();c.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.calls.length, 1);assert.equal(c.reads(), 1);
  assert.equal(c.calls[0].method, 'verifyOtp');assert.equal(c.calls[0].args.type, 'recovery');
  assert.equal(c.calls[0].cleaned, '/pwreset?origin=client');
  const html = renderToStaticMarkup(c.render());
  assert.match(html, /Set Your Password/);assert.equal((html.match(/type="password"/g) || []).length, 2);
  assert.doesNotMatch(html, /type="email"|Waiting for recovery session|Invalid or expired/);
});

test('emailed recovery fragment is removed before verification and expired recovery cannot show password fields', async () => {
  const c = pageCase({ direct: false, hash: '#token_hash=' + 'b'.repeat(64) + '&type=recovery', authError: true });
  c.effects[0]();await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.calls[0].cleaned, '/pwreset?origin=client');
  const html = renderToStaticMarkup(c.render());assert.match(html, /Invalid or expired reset link/);
  assert.doesNotMatch(html, /type="password"|type="email"/);
});
