import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import type { RankedDemoRow, ContestState } from '@/features/sales/contest.d.mts';
import './SalesRacePage.css';
import { CalendarDays as CalendarBlank, ChartColumn as ChartBar, Coins, Settings as GearSix, Info, Play, RotateCcw as ArrowCounterClockwise, LayoutDashboard as SquaresFour, Users, ChevronDown as CaretDown, Star } from 'lucide-react';
import { rankDemo, money, sumCents, periodLabel, snapshots, identities, initialState, selectSnapshot, applyDates } from '@/features/sales/contest.mjs';
const asset = (name: string) => `/sales-race-assets/${name}`;

function Standings({ rows }: { rows: RankedDemoRow[] }) {
  return <section className="standings" aria-labelledby="standings-title">
    <h2 id="standings-title">Standings</h2>
    <div className="standings-trim" aria-hidden="true"><Star size={10} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={10} fill="currentColor" /></div>
    <table aria-label="Sample demo standings">
      <caption className="sr-only">Sample demo standings. Rank, participant and sample net US dollars.</caption>
      <thead className="sr-only"><tr><th scope="col">Rank</th><th scope="col">Participant</th><th scope="col">Sample net USD</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} data-id={row.id}>
        <td><span className={`rank-badge ${row.color}`}>{row.rank}</span></td>
        <th scope="row"><span className={`lane-dot ${row.color}`} aria-hidden="true" />{row.name}</th>
        <td className="net-value">{money(row.cents)}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
function RaceBoard({ rows, animate }: { rows: RankedDemoRow[]; animate: boolean }) {
  const byId = new Map(rows.map(row => [row.id, row]));
  return <div className={`race-board ${animate ? 'motion-ready' : ''}`} aria-hidden="true">
    <img className="cabinet" src={asset('race-cabinet.png')} width="1918" height="820" alt="" draggable="false" />
    {identities.map(person => {
      const row = byId.get(person.id)!;
      return <div key={person.id} className="horse-runway" data-lane={person.lane} style={{ top: `${person.baseline * 100}%` }}>
        <div className="horse-mover" data-position={row.position} style={{ transform: `translateX(${row.position * 100}%)` }}>
          <img src={asset(`horse-${person.color}.png`)} alt="" draggable="false" />
        </div>
      </div>;
    })}
  </div>;
}
export default function SalesRacePage() {
  const [state, setState] = useState<ContestState>(initialState);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [artError, setArtError] = useState(false);
  let rows: RankedDemoRow[], total: number;
  try { rows = rankDemo(snapshots[state.snapshot]); total = sumCents(rows); }
  catch { return <main className="unavailable" role="alert"><h1>Demo unavailable</h1><p>The sample scores could not be validated. No partial standings are shown.</p></main>; }
  const submitDates = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setState(previous => applyDates(previous, fields.get('start'), fields.get('end')));
  };
  return <div className="sales-race-page">
    <a className="skip-link" href="#race-content">Skip to sales race</a>
    <aside className="sidebar">
      <Link className="brand" href="/sales/home" aria-label="alphaScreen QA sales hub"><img src={asset('alphascreen-mark.svg')} alt="" /><span>alphaScreen</span></Link>
      <nav aria-label="Sales workspace">
        <Link href="/sales/home"><SquaresFour size={22} aria-hidden="true" />Sales hub</Link>
        <a href="#race-content" aria-current="page"><ChartBar size={22} aria-hidden="true" />Sales race</a>
      </nav>
    </aside>
    <main className="shell" id="race-content" tabIndex={-1}>
      <header className="hero"><span className="qa-pill">QA practice • Sample data</span><p className="eyebrow">A little friendly competition</p><h1>The sales race</h1></header>
      <div className="content">
        <section className="summary-strip" aria-label="Sample contest overview">
          <div className="summary-item product"><span className="icon-disc product-mark"><img src={asset('alphascreen-mark.svg')} alt="" /></span><div><span className="summary-label">Product</span><strong className="product-name" data-testid="contest-product">alphaScreen</strong></div></div>
          <div className="summary-item"><span className="icon-disc revenue"><Coins size={24} aria-hidden="true" /></span><div><span className="summary-label">Sample net revenue</span><strong data-testid="sample-total">{money(total)}</strong></div></div>
          <div className="summary-item"><span className="icon-disc participants"><Users size={25} aria-hidden="true" /></span><div><span className="summary-label">Participants</span><strong>{rows.length}</strong></div></div>
          <div className="summary-item period"><span className="icon-disc dates"><CalendarBlank size={24} aria-hidden="true" /></span><div><span className="summary-label">Contest dates</span><strong className="period-value" data-testid="period-label">{periodLabel(state.start, state.end)}</strong></div></div>
        </section>
        <section className="race-panel" aria-label="Sample race board" onError={event => { if (event.target instanceof HTMLImageElement) setArtError(true); }}>
          <Standings rows={rows} />
          {artError ? <p className="art-error" role="status">Race artwork unavailable. The complete standings are still shown.</p> : <RaceBoard rows={rows} animate={state.animate} />}
        </section>
        <div className="utility-row">
          <button className="primary" onClick={() => setState(previous => selectSnapshot(previous, 'B'))}><Play size={21} fill="currentColor" aria-hidden="true" />Try demo</button>
          <button className="secondary" onClick={() => setState(previous => selectSnapshot(previous, 'A'))}><ArrowCounterClockwise size={23} aria-hidden="true" />Reset</button>
          <button className="scoring-button" aria-expanded={scoringOpen} aria-controls="scoring-details" onClick={() => setScoringOpen(value => !value)}><Info size={22} aria-hidden="true" />How scoring works</button>
        </div>
        <div id="scoring-details" className="scoring-details" hidden={!scoringOpen}>
          <h2>A little progress, a little friendly competition.</h2>
          <p>This preview uses fictional sample scores. The intended live metric is net platform revenue received—not booked sales, role fees or commission dollars.</p>
          <p>Ties share a rank. Horse distance is relative to the current positive leader, not a target or a final result. Zero and negative scores stay at the starting edge; negative dollars remain in the standings. Saddle numbers identify lanes, not rank.</p>
          <p>No live payments are connected, and changing the preview dates does not filter these sample scores.</p>
        </div>
        <details className="contest-setup">
          <summary><GearSix size={28} aria-hidden="true" /><span>Contest setup</span><CaretDown className="disclosure-caret" size={24} aria-hidden="true" /></summary>
          <div className="setup-body">
            <p className="setup-note">Unsaved date preview · Inclusive America/Denver dates. These controls do not save a contest or filter the sample scores.</p>
            <form onSubmit={submitDates} noValidate>
              <label htmlFor="start">Start date<input id="start" name="start" type="date" required defaultValue={initialState.start} aria-invalid={Boolean(state.dateError)} aria-describedby="date-error" /></label>
              <label htmlFor="end">End date<input id="end" name="end" type="date" required defaultValue={initialState.end} aria-invalid={Boolean(state.dateError)} aria-describedby="date-error" /></label>
              <button className="primary" type="submit">Apply demo dates</button>
            </form>
            <p className="range-readback">Showing unsaved demo dates: {state.start} → {state.end}</p>
            <p id="date-error" className="date-error" role="status">{state.dateError}</p>
          </div>
        </details>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{state.status}</p>
        <footer>QA practice • Sample scores only. Not payroll or compensation.</footer>
      </div>
    </main>
  </div>;
}
