const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function rankDemo(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Invalid demo fixture.');
  const ids = new Set(), lanes = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !/^demo-[a-z0-9-]+$/.test(row.id) || ids.has(row.id) ||
        typeof row.name !== 'string' || !row.name.startsWith('Demo ') || !row.name.slice(5).trim() ||
        !Number.isSafeInteger(row.cents) || !Number.isInteger(row.lane) || row.lane < 1 || row.lane > 4 || lanes.has(row.lane)) throw new Error('Invalid demo fixture.');
    ids.add(row.id); lanes.add(row.lane);
  }
  const sorted = rows.map(row => ({ ...row })).sort((a, b) => a.cents === b.cents
    ? compareText(a.name, b.name) || compareText(a.id, b.id) : a.cents > b.cents ? -1 : 1);
  const leader = Math.max(0, sorted[0].cents);
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || row.cents !== sorted[index - 1].cents) rank = index + 1;
    return { ...row, rank, position: leader > 0 ? Math.min(.85, Math.max(0, row.cents) / leader * .85) : 0 };
  });
}
export function money(cents) {
  if (!Number.isSafeInteger(cents)) throw new Error('Invalid demo cents.');
  const amount = BigInt(cents), absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}$${(absolute / 100n).toLocaleString('en-US')}.${String(absolute % 100n).padStart(2, '0')}`;
}
export function sumCents(rows) {
  const total = rows.reduce((sum, row) => sum + BigInt(row.cents), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Invalid demo total.');
  return Number(total);
}
export function validCivilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function validRange(start, end) { return validCivilDate(start) && validCivilDate(end) && start <= end; }
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function periodLabel(start, end) {
  if (!validRange(start, end)) throw new Error('Invalid demo dates.');
  const [sy, sm, sd] = start.split('-').map(Number), [ey, em, ed] = end.split('-').map(Number);
  if (start === end) return `${months[sm - 1]} ${sd}, ${sy}`;
  if (sy === ey && sm === em) return `${months[sm - 1]} ${sd}–${ed}, ${sy}`;
  if (sy === ey) return `${months[sm - 1]} ${sd} – ${months[em - 1]} ${ed}, ${sy}`;
  return `${months[sm - 1]} ${sd}, ${sy} – ${months[em - 1]} ${ed}, ${ey}`;
}
export const identities = Object.freeze([
  Object.freeze({ id: 'demo-violet', name: 'Demo Violet', lane: 1, color: 'violet', baseline: .352 }),
  Object.freeze({ id: 'demo-mint', name: 'Demo Mint', lane: 2, color: 'mint', baseline: .496 }),
  Object.freeze({ id: 'demo-sky', name: 'Demo Sky', lane: 3, color: 'sky', baseline: .645 }),
  Object.freeze({ id: 'demo-amber', name: 'Demo Amber', lane: 4, color: 'amber', baseline: .793 }),
]);
export function fixture(amounts) {
  if (!Array.isArray(amounts) || amounts.length !== identities.length) throw new Error('Invalid demo fixture.');
  return identities.map((person, i) => ({ ...person, cents: amounts[i] }));
}
export const snapshots = Object.freeze({
  A: Object.freeze(fixture([20000, 10000, 10000, -500]).map(Object.freeze)),
  B: Object.freeze(fixture([40000, 0, -200, 40000]).map(Object.freeze)),
});
export function selectSnapshot(state, key) {
  if (!Object.hasOwn(snapshots, key)) throw new Error('Invalid demo snapshot.');
  return { ...state, snapshot: key, animate: true,
    status: key === 'A' ? 'Demo snapshot restored. Sample scores only.' : 'Alternate demo snapshot showing. Sample scores only.' };
}
export function applyDates(state, start, end) {
  return validRange(start, end)
    ? { ...state, start, end, dateError: '', status: 'Unsaved demo dates updated. Sample scores have not been filtered.' }
    : { ...state, dateError: 'Enter valid start and end dates with the end on or after the start. The previous demo dates are still showing.' };
}
export const initialState = Object.freeze({ snapshot: 'A', animate: false, start: '2026-11-01', end: '2026-11-02', status: '', dateError: '' });
