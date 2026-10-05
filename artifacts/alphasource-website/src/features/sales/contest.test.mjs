import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankDemo, money, sumCents, validCivilDate, validRange, periodLabel, fixture, snapshots, initialState, selectSnapshot, applyDates } from './contest.mjs';

test('A exact ranking and positions, immutable fixture and safe total', () => {
  const input = fixture([20000,10000,10000,-500]), before = JSON.stringify(input);
  assert.deepEqual(rankDemo(input).map(({id,cents,rank,position,lane}) => ({id,cents,rank,position,lane})), [
    {id:'demo-violet',cents:20000,rank:1,position:.85,lane:1}, {id:'demo-mint',cents:10000,rank:2,position:.425,lane:2},
    {id:'demo-sky',cents:10000,rank:2,position:.425,lane:3}, {id:'demo-amber',cents:-500,rank:4,position:0,lane:4}]);
  assert.equal(sumCents(rankDemo(input)),39500); assert.equal(JSON.stringify(input),before);
  assert.ok(Object.isFrozen(snapshots.A) && Object.isFrozen(snapshots.A[0]));
});
test('B retains lane identities, equal leaders share rank1', () => {
  const rows = rankDemo(snapshots.B);
  assert.deepEqual(rows.map(r=>[r.id,r.rank,r.position,r.lane]), [['demo-amber',1,.85,4],['demo-violet',1,.85,1],['demo-mint',3,0,2],['demo-sky',4,0,3]]);
  assert.equal(sumCents(rows),79800);
});
test('zero, all-negative and mixed non-positive scores remain numeric', () => {
  assert.ok(rankDemo(fixture([0,0,0,0])).every(r=>r.rank===1 && r.position===0));
  assert.ok(rankDemo(fixture([-10,-20,-30,-40])).every(r=>r.position===0));
  assert.deepEqual(rankDemo(fixture([-4000,0,-1050,0])).map(r=>[r.id,r.rank,r.position]), [['demo-amber',1,0],['demo-mint',1,0],['demo-sky',3,0],['demo-violet',4,0]]);
});
test('single positive lane scales without implying winner', () => {
  const [row] = rankDemo([{id:'demo-sky',name:'Demo Sky',lane:1,cents:10000}]);
  assert.equal(row.rank,1); assert.equal(row.position,.85);
});
test('same-name ties use ID for display order only', () => {
  assert.deepEqual(rankDemo([{id:'demo-b',name:'Demo Shared',lane:1,cents:100},{id:'demo-a',name:'Demo Shared',lane:2,cents:100}]).map(r=>[r.id,r.rank]), [['demo-a',1],['demo-b',1]]);
});
test('bad fixtures fail closed as a whole', () => {
  for (const bad of [null,[],[null],fixture([NaN,0,0,0]),fixture([1.1,0,0,0]),fixture([Number.MAX_SAFE_INTEGER+1,0,0,0])]) assert.throws(()=>rankDemo(bad));
  for (const patch of [{id:''},{id:'demo-mint'},{id:'someone@example.com'},{name:'Michael'},{name:'Demo '},{lane:0},{lane:2},{lane:1.2},{cents:'100'}]) {
    const rows=fixture([100,100,100,100]); rows[0]={...rows[0],...patch}; assert.throws(()=>rankDemo(rows));
  }
  assert.throws(()=>fixture([])); assert.throws(()=>selectSnapshot(initialState,'C'));
});
test('exact integer currency, negative formatting and aggregate overflow', () => {
  assert.equal(money(123456),'$1,234.56'); assert.equal(money(-1050),'-$10.50'); assert.equal(money(0),'$0.00');
  assert.equal(money(Number.MAX_SAFE_INTEGER),'$90,071,992,547,409.91'); assert.throws(()=>money(1.5)); assert.throws(()=>money(Infinity));
  assert.throws(()=>sumCents([{cents:Number.MAX_SAFE_INTEGER},{cents:1}]));
});
test('civil dates validate calendar and lexical range, no timezone conversion', () => {
  for (const d of ['2026-11-01','2026-11-02','2024-02-29','2000-02-29']) assert.equal(validCivilDate(d),true);
  for (const d of ['',null,'2026-02-29','1900-02-29','2026-04-31','2026-00-01','2026-13-01','0000-01-01','2026-1-01']) assert.equal(validCivilDate(d),false);
  assert.equal(validRange('2026-11-01','2026-11-01'),true); assert.equal(validRange('2026-11-02','2026-11-01'),false);
});
test('display periods remain civil-date labels across fallback day and years', () => {
  assert.equal(periodLabel('2026-11-01','2026-11-02'),'Nov 1–2, 2026');
  assert.equal(periodLabel('2026-11-01','2026-11-01'),'Nov 1, 2026');
  assert.equal(periodLabel('2026-10-31','2026-11-02'),'Oct 31 – Nov 2, 2026');
  assert.equal(periodLabel('2026-12-31','2027-01-01'),'Dec 31, 2026 – Jan 1, 2027'); assert.throws(()=>periodLabel('',''));
});
test('valid date updates retain snapshot; invalid edits retain last valid range', () => {
  const saved=applyDates(selectSnapshot(initialState,'B'),'2026-10-01','2026-10-31');
  assert.equal(saved.snapshot,'B'); assert.equal(saved.start,'2026-10-01'); assert.equal(saved.dateError,'');
  assert.match(saved.status,/Sample scores have not been filtered/);
  for (const [start,end] of [['',''],['2026-11-02','2026-11-01'],['2026-02-29','2026-03-01']]) {
    const bad=applyDates(saved,start,end); assert.equal(bad.start,saved.start); assert.equal(bad.end,saved.end); assert.match(bad.dateError,/previous demo dates/);
  }
  const reset=selectSnapshot(saved,'A'); assert.equal(reset.start,saved.start); assert.equal(reset.end,saved.end); assert.equal(sumCents(snapshots[reset.snapshot]),39500);
});
test('source boundary, semantic table and real local assets', () => {
  const app=readFileSync(new URL('../../pages/sales/SalesRacePage.tsx',import.meta.url),'utf8'), css=readFileSync(new URL('../../pages/sales/SalesRacePage.css',import.meta.url),'utf8');
  assert.doesNotMatch(app,/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/); assert.doesNotMatch(app,/prod\.onrender|www\.alphasourceai|api\.stripe|supabase/);
  assert.match(app,/QA practice • Sample data/); assert.match(app,/Not payroll or compensation/); assert.match(app,/Unsaved date preview/);
  assert.ok(app.indexOf('<Standings rows=') < app.indexOf('<RaceBoard rows=')); assert.match(app,/aria-label="Sample demo standings"/);
  assert.match(app,/className=\{`race-board[^\n]*aria-hidden="true"/); assert.match(css,/prefers-reduced-motion: reduce/); assert.match(css,/overflow: hidden/);
  for (const name of ['race-cabinet.png','fairground-header.png','alphascreen-mark.svg','horse-violet.png','horse-mint.png','horse-sky.png','horse-amber.png']) assert.ok(existsSync(new URL(`../../../public/sales-race-assets/${name}`,import.meta.url)),name);
});
test('reviewed header refinements and native date submissions are preserved', () => {
  const app=readFileSync(new URL('../../pages/sales/SalesRacePage.tsx',import.meta.url),'utf8'), css=readFileSync(new URL('../../pages/sales/SalesRacePage.css',import.meta.url),'utf8');
  const summary=app.split('className="summary-strip"')[1].split('</section>')[0];
  assert.doesNotMatch(summary,/America\/Denver|timezone/);
  assert.match(app,/Unsaved date preview · Inclusive America\/Denver dates/);
  assert.match(app,/new FormData\(event.currentTarget\)/);
  assert.match(app,/id="start" name="start"/); assert.match(app,/id="end" name="end"/);
  assert.match(summary,/Product<\/span><strong[^>]*data-testid="contest-product">alphaScreen/);
  assert.equal((summary.match(/className="summary-item/g)||[]).length,4);
  assert.ok(summary.indexOf('contest-product') < summary.indexOf('sample-total'));
  assert.match(summary,/Participants/);
  assert.match(summary,/Contest dates/);
  assert.match(css,/grid-template-columns: repeat\(4, minmax\(0,1fr\)\)/);
  assert.match(css,/@media \(max-width: 600px\)/);
});
