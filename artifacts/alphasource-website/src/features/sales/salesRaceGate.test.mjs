import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { salesRaceAvailable } from './salesRaceGate.mjs';

test('race route is QA host or development only, never production aliases', () => {
  assert.equal(salesRaceAvailable('alphasourceai-com.onrender.com'), true);
  assert.equal(salesRaceAvailable('127.0.0.1', true), true);
  for (const hostname of ['', '127.0.0.1', 'www.alphasourceai.com', 'app.alphasourceai.com', 'ia-frontend-prod.onrender.com', 'alphasourceai-com.onrender.com.attacker.example']) {
    assert.equal(salesRaceAvailable(hostname), false);
    assert.equal(salesRaceAvailable(hostname, 'true'), false);
  }
});
test('native race is after verified sales access, lazy and consistently gated', () => {
  const app=readFileSync(new URL('../../pages/sales/SalesApp.tsx',import.meta.url),'utf8');
  const layout=readFileSync(new URL('../../components/SalesLayout.tsx',import.meta.url),'utf8');
  assert.match(app,/lazy\(\(\) => import\("@\/pages\/sales\/SalesRacePage"\)\)/);
  assert.ok(app.indexOf('if (!rep) return') < app.indexOf('if (location === "/sales/race"'));
  assert.ok(app.indexOf('if (!salesRaceAvailable') < app.indexOf('<SalesRacePage />'));
  assert.match(layout,/salesRaceAvailable[^\n]+Sales race · QA[^\n]+\/sales\/race/);
  const css=readFileSync(new URL('../../pages/sales/SalesRacePage.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/(?:^|\n)(?:body|:root|\*)\s*\{/);
  assert.match(css,/font-family: RaceInter/);
  assert.match(css,/font-family: 'RaceDisplay'/);
  const page=readFileSync(new URL('../../pages/sales/SalesRacePage.tsx',import.meta.url),'utf8');
  assert.match(page,/Link className="brand" href="\/sales\/home"/);
  assert.doesNotMatch(page,/dangerouslySetInnerHTML|localStorage|fetch\(|iframe/);
});
