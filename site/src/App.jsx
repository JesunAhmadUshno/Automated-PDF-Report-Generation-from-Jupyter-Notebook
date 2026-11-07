import { useMemo, useState, useEffect, useCallback, useId, useRef } from 'react';
import d from './generated/data.json';
import { parseNotebook, census, reportBlocks } from './notebook.js';
import { iqrBounds, imbalance } from './calc.js';

const REPO = 'https://github.com/JesunAhmadUshno/Automated-PDF-Report-Generation-from-Jupyter-Notebook';
const blob = (p) => `${REPO}/blob/main/${p}`;
const CLEAN = 'assignment2DataCleaning_final_original.ipynb';
const AUTO = 'AutoReport.ipynb';
const COLAB = `https://colab.research.google.com/github/JesunAhmadUshno/Automated-PDF-Report-Generation-from-Jupyter-Notebook/blob/main/${CLEAN}`;
const BASE = import.meta.env.BASE_URL;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x, dp = 1) => `${(x * 100).toFixed(dp)}%`;
const money = (x) => x.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const short = (x) => (x >= 1e6 ? `${+(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${+(x / 1e3).toFixed(x >= 1e4 ? 0 : 1)}k` : `${+x.toFixed(2)}`);
// Charts switch to a narrower viewBox on phones so their text stays readable.
function useNarrow() {
  const q = '(max-width: 760px)';
  const [n, setN] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q), f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return n;
}
const nbInfo = Object.fromEntries(d.notebooks.map((n) => [n.file, n]));
const Recorded = ({ cell }) => <span className="pill warn" title="Value printed by the notebook; the dataset is not in the repo, so it cannot be rerun here">● Recorded{cell != null ? `, cell ${cell}` : ''}</span>;

const SECTIONS = [['top', 'Overview', '◎'], ['report', 'Report Builder', '▤'], ['pipeline', 'Pipeline', '⇢'], ['outliers', 'Outliers', '⇥'], ['imbalance', 'Imbalance', '⚖'], ['shapes', 'Distributions', '∿'], ['corr', 'Correlations', '⇄'], ['figures', 'Figures', '▦'], ['audit', 'Audit', '✓']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">AutoReport Lab</a>
      <a className="m" href={blob(CLEAN)}>Cleaning notebook</a>
      <a className="m" href={blob('autoreport.py')}>autoreport.py</a>
      <a className="m" href={blob('docs/research-review.md')}>Research review</a>
      <span className="spacer" />
      <span className="status"><i /> Recorded outputs, live tools</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined} aria-label={label}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl" aria-hidden="true">{label}</span>
        </a>
      ))}
    </nav>
  );
}

function Range({ label, value, min, max, step, onChange, show }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span>{show}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

function Seg({ label, value, options, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <ReportBuilder />
      <Pipeline />
      <Outliers />
      <Imbalance />
      <Transforms />
      <TimePatterns />
      <Correlations />
      <Figures />
      <Audit />
      <Dock />
      <footer>
        Data: <code>SAML-D.csv</code>, not included in the repo, and the repo does not state its source. Every number on this page is read from the notebooks’ recorded outputs at build time
        (<a href={blob('site/src/extract.js')}>extract.js</a>, checked by <a href={blob('site/src/check.mjs')}>check.mjs</a>); the Report Builder and calculators run in your browser.
        <br /><a href={REPO}>Repository</a> · <a href={COLAB}>Open the cleaning notebook in Colab</a> · <a href={blob('docs/research-review.md')}>Research review</a>
      </footer>
    </div>
  );
}

function Hero() {
  const tiles = [
    [fmt(d.rows), `rows in SAML-D.csv, ${d.firstDate} to ${d.lastDate}`],
    [`${d.cols} → ${d.featureCols}`, `columns, after ${d.newFeatures} time features`],
    [fmt(d.launder.pos), `laundering rows, ${(d.launder.pct10).toFixed(3)}% of all`],
    [fmt(d.capped), `Amount values capped by the IQR rule (${d.amount.iqrPct.toFixed(2)}%)`],
    [d.missingBefore, 'missing values before and after cleaning'],
    [`${d.dupBefore} → ${d.dupAfter}`, 'duplicate rows: none before, created by capping'],
  ];
  return (
    <header className="card hero window" id="top" data-title="assignment2DataCleaning.ipynb">
      <div className="head">
        <p className="eyebrow">Notebook to report · coursework</p>
        <span className="pill info">● {nbInfo[CLEAN].census.cells} + {nbInfo[AUTO].census.cells} cells parsed at build time</span>
      </div>
      <h1>Turn a notebook into a report, shown on a <em>{(d.rows / 1e6).toFixed(1)}-million-row</em> money-laundering cleaning run.</h1>
      <p className="sub">
        This repo pairs AutoReport, a notebook-to-PDF idea, with the data-cleaning notebook it was meant to report on: the SAML-D anti-money-laundering transactions,
        loaded, checked, capped and feature-engineered in {nbInfo[CLEAN].census.code} code cells. The original AutoReport notebook does not run as committed, so this page
        rebuilds the idea in your browser, then reads the cleaning run’s recorded results, including where its methods fall short.
      </p>
      <div className="actions">
        <a className="btn primary" href="#report">Build a report from a notebook</a>
        <a className="btn ghost" href="#audit">Read the audit</a>
        <span className="hint">Or locally: <code>python autoreport.py notebook.ipynb</code></span>
      </div>
      <div className="tiles hero-tiles">
        {tiles.map(([num, cap]) => <div className="tile" key={cap}><div className="num">{num}</div><div className="cap">{cap}</div></div>)}
      </div>
    </header>
  );
}

function Block({ b }) {
  if (b.kind === 'prose') return (
    <div className="r-prose">
      {b.lines.map((l, i) => (l.h ? (l.h <= 2 ? <h3 key={i}>{l.text}</h3> : <h4 key={i}>{l.text}</h4>) : l.li ? <p key={i} className="r-li">{l.li.replace(/\*\*/g, '')}</p> : <p key={i}>{l.p.replace(/\*\*/g, '')}</p>))}
    </div>
  );
  if (b.kind === 'code') return <div className="r-cell"><span className="r-tag">In · cell {b.cell}</span><pre className="r-code">{b.text}</pre></div>;
  if (b.kind === 'image') return <img className="r-img" src={b.src} alt={`Figure output of cell ${b.cell}`} loading="lazy" />;
  return <pre className={`r-out${b.kind === 'error' ? ' r-err' : ''}`}>{b.text}</pre>;
}

function ReportBuilder() {
  const [source, setSource] = useState(CLEAN);
  const [nb, setNb] = useState(null);
  const [name, setName] = useState(CLEAN);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState({ prose: true, code: true, outputs: true });
  const [title, setTitle] = useState('');
  const [drag, setDrag] = useState(false);
  const cache = useRef({});
  const fileId = useId(), titleId = useId();

  useEffect(() => {
    if (source === 'upload') return;
    let live = true;
    setError('');
    const hit = cache.current[source];
    if (hit) { setNb(hit); setName(source); return; }
    setBusy(true);
    fetch(`${BASE}generated/nb/${source}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => { const parsed = parseNotebook(t); cache.current[source] = parsed; if (live) { setNb(parsed); setName(source); } })
      .catch((e) => live && setError(`Could not load ${source}: ${e.message}`))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [source]);

  const openFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    if (file.size > 40e6) { setError(`${file.name} is ${(file.size / 1e6).toFixed(1)} MB; the in-browser builder accepts up to 40 MB.`); return; }
    try { const parsed = parseNotebook(await file.text()); setNb(parsed); setName(file.name); setSource('upload'); }
    catch (e) { setError(`${file.name}: ${e.message}`); }
  }, []);

  const c = useMemo(() => (nb ? census(nb) : null), [nb]);
  const blocks = useMemo(() => (nb ? reportBlocks(nb, opts) : []), [nb, opts]);
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const heading = title.trim() || name.replace(/\.ipynb$/, '');

  return (
    <section id="report" className="card window reveal" data-title="AutoReport.app — runs in your browser">
      <div className="head">
        <div>
          <p className="eyebrow">Live · Report Builder</p>
          <h2>Pick a notebook, choose what to keep, print it to PDF.</h2>
          <p className="sub">
            The same job AutoReport.ipynb set out to do with nbconvert, done in your browser. It parses the <code>.ipynb</code> JSON, keeps or drops prose, code and outputs
            (nbconvert’s <code>exclude_input</code> and <code>exclude_output</code>), counts what is inside, and lays it out for print. Choose <b>Save as PDF</b> in the print dialog.
            Your own notebook never leaves your machine, and its HTML is shown as text, never run.
          </p>
        </div>
        <span className="pill good">● Live</span>
      </div>
      <div className="builder-bar">
        <Seg label="Notebook" value={source} onChange={setSource} options={[[CLEAN, 'Cleaning notebook'], [AUTO, 'AutoReport.ipynb'], ...(source === 'upload' ? [['upload', 'Your file']] : [])]} />
        <label className="btn ghost file-btn" htmlFor={fileId}>Open your own .ipynb</label>
        <input id={fileId} className="sr-only" type="file" accept=".ipynb,application/json" onChange={(e) => { openFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
      <div className="controls builder-controls">
        {[['prose', 'Markdown and raw cells'], ['code', 'Code inputs'], ['outputs', 'Outputs and figures']].map(([k, l]) => (
          <label className="check" key={k}><input type="checkbox" checked={opts[k]} onChange={() => toggle(k)} /> {l}</label>
        ))}
        <div className="field"><label htmlFor={titleId}>Report title</label><input id={titleId} type="text" placeholder={name.replace(/\.ipynb$/, '')} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      </div>
      {error && <p className="pill bad err" role="alert">{error}</p>}
      {c && (
        <div className="census" aria-live="polite">
          {[['cells', c.cells], ['code', c.code], ['markdown', c.markdown], ['raw', c.raw], ['outputs', c.outputs], ['figures', c.images], ['errors', c.errors], ['executed', `${c.executed}/${c.code}`], ['report blocks', blocks.length]].map(([k, v]) => (
            <div key={k}><b>{v}</b><span>{k}</span></div>
          ))}
        </div>
      )}
      <div className="actions" style={{ marginTop: 0, marginBottom: 14 }}>
        <button type="button" className="btn primary" onClick={() => window.print()} disabled={!nb || busy}>Save as PDF (print)</button>
        <span className="hint">{busy ? 'Loading notebook…' : c ? `${name}: ${c.cells} cells${c.executed === 0 && c.code ? ', no execution counts (outputs were stored without a recorded run)' : ''}.` : ''}</span>
      </div>
      <div className={`report-preview${drag ? ' drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); openFile(e.dataTransfer.files[0]); }} tabIndex={0} aria-label="Report preview; drop a .ipynb file here to load it">
        <article className="report">
          <header className="r-head">
            <h3 className="r-title">{heading}</h3>
            <p className="r-meta">Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} from <span className="mono">{name}</span> · {blocks.length} blocks</p>
          </header>
          {blocks.length ? blocks.map((b, i) => <Block key={b.key || `${b.kind}-${b.cell}-${i}`} b={b} />) : <p className="hint">{nb ? 'Everything is switched off. Turn a section back on.' : 'Loading…'}</p>}
        </article>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Tip: drag a notebook onto the preview. PDF export uses your browser’s print engine, not a server.</p>
    </section>
  );
}

function Pipeline() {
  const figsIn = (from, to) => d.figures.filter((f) => f.cell > from && f.cell < to).length;
  const h = d.headings;
  const facts = [
    `${fmt(d.rows)} rows × ${d.cols} columns; ${d.uniqueDates} distinct dates from ${d.firstDate} to ${d.lastDate}.`,
    `Missing values ${d.missingBefore}, duplicate rows ${d.dupBefore}; the IQR rule flags ${fmt(d.amount.iqrCount)} Amount values (${d.amount.iqrPct.toFixed(2)}%).`,
    `${fmt(d.capped)} Amount values clipped to [${money(d.amount.lower)}, ${money(d.amount.upper)}]; shape unchanged; ${d.dupAfter} duplicate rows appear after capping and are left in.`,
    `${figsIn(h[3].cell, h[4].cell)} figures: distributions, categories, a correlation heatmap and box plots.`,
    `${d.newFeatures} time features added: ${fmt(d.rows)} × ${d.featureCols}, saved as a ~${fmt(d.fileMb)} MB CSV (not in the repo).`,
    `On a ${fmt(d.sampleRows)}-row sample: skewness, Shapiro-Wilk (n = ${fmt(d.shapiroN)}), transforms and correlations; ${figsIn(h[5].cell, 99)} more figures.`,
  ];
  return (
    <section id="pipeline" className="card window reveal" data-title="pipeline.md">
      <div className="head">
        <div>
          <p className="eyebrow">What the notebook did</p>
          <h2>Six stages, read straight from the notebook’s own headings.</h2>
        </div>
        <Recorded />
      </div>
      <ol className="steps">
        {h.map((s, i) => (
          <li key={s.cell}><span className="n">{i + 1}</span><div><b>{s.title}</b> <span className="hint">cell {s.cell}</span><div className="hint">{facts[i]}</div></div></li>
        ))}
      </ol>
    </section>
  );
}

function Outliers() {
  const [k, setK] = useState(1.5);
  const a = d.amount;
  const { iqr, lo, hi } = iqrBounds(a.before['25%'], a.before['75%'], k);
  const atRecorded = Math.abs(k - 1.5) < 1e-9;
  const kFloor = (a.before['25%'] - a.before.min) / iqr; // k below which the lower bound would bite
  const narrow = useNarrow();
  const W = narrow ? 480 : 960, H = 150, L = 20, R = 20;
  const x = (v) => L + (Math.log10(Math.max(1, v)) / 8) * (W - L - R);
  const y0 = 70;
  const rows = [['Mean', 'mean'], ['Std. deviation', 'std'], ['Median', '50%'], ['Maximum', 'max']];
  return (
    <section id="outliers" className="card window reveal" data-title="iqr_capping.py">
      <div className="head">
        <div>
          <p className="eyebrow">Live calculator on recorded quartiles</p>
          <h2>Move the fence and watch where the cap lands.</h2>
          <p className="sub">
            The notebook clips Amount to Q1 − k·IQR and Q3 + k·IQR with k = 1.5. The bounds below are computed live from the recorded quartiles
            (Q1 {money(a.before['25%'])}, Q3 {money(a.before['75%'])}). How many rows each k would cap cannot be recomputed without the dataset, so only the recorded count at k = 1.5 is shown.
          </p>
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr' }}>
            <Range label="Fence multiplier k" value={k} min={0.5} max={3} step={0.05} onChange={setK} show={k.toFixed(2)} />
          </div>
          <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
            <div className="tile"><div className="num">{money(hi)}</div><div className="cap">upper cap (Q3 + {k.toFixed(2)} × IQR {money(iqr)})</div></div>
            <div className="tile"><div className="num">{money(lo)}</div><div className="cap">lower bound, below the smallest amount ({money(a.before.min)}), so it never bites for k ≥ {kFloor.toFixed(2)}</div></div>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            {atRecorded ? <>At k = 1.5 the notebook capped <b>{fmt(d.capped)}</b> values ({a.iqrPct.toFixed(2)}%), all from above. <Recorded cell={13} /></>
              : <>Count at k = {k.toFixed(2)}: needs <code>SAML-D.csv</code>, which is not in the repo. Return to k = 1.5 for the recorded count.</>}
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Amount</th><th>Before (cell 6)</th><th>After capping (cell 16)</th></tr></thead>
            <tbody>
              {rows.map(([l, key]) => <tr key={key}><td>{l}</td><td>{money(a.before[key])}</td><td>{money(a.after[key])}</td></tr>)}
            </tbody>
          </table>
          <p className="hint">Capping cut the maximum from {short(a.before.max)} to {money(a.after.max)} and the standard deviation by {pct(1 - a.after.std / a.before.std, 0)}. In money-laundering data, those large transactions may be exactly the signal; the notebook never checks how many capped rows are laundering.</p>
        </div>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Amount on a log scale: interquartile box, cap at ${money(hi)} and recorded maximum ${money(a.before.max)}`} style={{ marginTop: 8 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].filter((e) => !narrow || e % 2 === 0).map((e) => <g key={e}><line className="axis" x1={x(10 ** e)} x2={x(10 ** e)} y1={20} y2={y0 + 34} /><text x={x(10 ** e)} y={H - 8} textAnchor="middle">{e === 0 ? '1' : short(10 ** e)}</text></g>)}
        <rect x={x(hi)} y={y0 - 22} width={x(a.before.max) - x(hi)} height={44} fill="var(--bad)" opacity="0.14" rx="6" />
        <line x1={x(a.before.min)} x2={x(hi)} y1={y0} y2={y0} stroke="var(--muted)" strokeWidth="1.5" />
        <rect x={x(a.before['25%'])} y={y0 - 16} width={x(a.before['75%']) - x(a.before['25%'])} height={32} fill="var(--primary)" opacity="0.22" stroke="var(--primary)" rx="4" />
        <line x1={x(a.before['50%'])} x2={x(a.before['50%'])} y1={y0 - 16} y2={y0 + 16} stroke="var(--primary)" strokeWidth="2.5" />
        <line x1={x(hi)} x2={x(hi)} y1={y0 - 30} y2={y0 + 30} stroke="var(--bad)" strokeWidth="2.5" />
        <circle cx={x(a.before.max)} cy={y0} r="5" fill="var(--bad)" />
        <circle cx={x(a.before.min)} cy={y0} r="4" fill="var(--muted)" />
        <text x={x(a.before.min) + 6} y={y0 - 10}>min {money(a.before.min)}</text>
        <text x={(x(a.before['25%']) + x(a.before['75%'])) / 2} y={y0 + 30} textAnchor="middle">{narrow ? 'Q1–Q3' : `Q1 to Q3, median ${short(a.before['50%'])}`}</text>
        <text x={x(hi)} y={y0 - 36} textAnchor="middle" style={{ fill: 'var(--bad)' }}>cap {short(hi)} (k {k.toFixed(2)})</text>
        <text x={x(a.before.max)} y={y0 - 12} textAnchor="end">max {short(a.before.max)}</text>
        {!narrow && <text x={(x(hi) + x(a.before.max)) / 2} y={y0 + 4} textAnchor="middle" style={{ fill: 'var(--bad)' }}>clipped to the cap</text>}
      </svg>
    </section>
  );
}

function Imbalance() {
  const [e, setE] = useState(3);
  const n = Math.round(10 ** e);
  const im = imbalance(d.launder.neg, d.launder.pos, n);
  const grid = imbalance(d.launder.neg, d.launder.pos, 1000);
  const red = Math.round(grid.expected);
  const cols = 50, size = 9;
  return (
    <section id="imbalance" className="card window reveal" data-title="is_laundering.csv">
      <div className="head">
        <div>
          <p className="eyebrow">Live calculator on recorded counts</p>
          <h2>A model that never flags anything is <em>{pct(im.majorityAcc, 2)}</em> accurate.</h2>
          <p className="sub">
            {fmt(d.launder.neg)} normal and {fmt(d.launder.pos)} laundering rows (cell 13). At that rate accuracy is the wrong yardstick: always answering “normal” scores {pct(im.majorityAcc, 2)} and catches nothing.
            The notebook stops before any model, so this is the warning it should have carried: judge future models on recall, precision and the precision-recall curve.
          </p>
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr' }}>
            <Range label="Sample size you draw" value={e} min={2} max={6} step={0.05} onChange={setE} show={fmt(n)} />
          </div>
          <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
            <div className="tile"><div className="num">{im.expected < 10 ? im.expected.toFixed(2) : fmt(im.expected)}</div><div className="cap">laundering rows expected in {fmt(n)}</div></div>
            <div className="tile"><div className="num">{pct(im.atLeastOne, 1)}</div><div className="cap">chance a random sample of {fmt(n)} holds at least one</div></div>
            <div className="tile"><div className="num">1 in {fmt(im.perPositive)}</div><div className="cap">rows is laundering</div></div>
            <div className="tile"><div className="num">{(im.p * 100).toFixed(3)}%</div><div className="cap">prevalence, matching cell 10’s {d.launder.pct10}%</div></div>
          </div>
        </div>
        <div>
          <h3>1,000 transactions at the recorded rate</h3>
          <svg className="chart" viewBox={`0 0 ${cols * size} ${(1000 / cols) * size}`} role="img" aria-label={`Grid of 1,000 squares; ${red} is laundering at the recorded rate`} style={{ marginTop: 10 }}>
            {Array.from({ length: 1000 }, (_, i) => (
              <rect key={i} x={(i % cols) * size + 1} y={Math.floor(i / cols) * size + 1} width={size - 2} height={size - 2} rx="1.5" fill={i === 517 && red ? 'var(--bad)' : 'var(--primary)'} opacity={i === 517 && red ? 1 : 0.22} />
            ))}
          </svg>
          <p className="hint">Each square is one transaction. At {(grid.p * 100).toFixed(3)}%, about {grid.expected.toFixed(2)} in 1,000 is laundering: the red one. The sample-size slider shows why the notebook’s 10,000 and 100,000-row plotting samples hold only about {fmt(imbalance(d.launder.neg, d.launder.pos, 1e4).expected)} and {fmt(imbalance(d.launder.neg, d.launder.pos, 1e5).expected)} positives.</p>
        </div>
      </div>
    </section>
  );
}

function Transforms() {
  const s = d.skewness;
  const best = s.reduce((a, b) => (Math.abs(b.value) < Math.abs(a.value) ? b : a));
  const narrow = useNarrow();
  const W = narrow ? 420 : 960, rowH = 34, H = s.length * rowH + 30, L = narrow ? 100 : 150, R = 40, lim = 1.4;
  const x = (v) => L + ((v + lim) / (2 * lim)) * (W - L - R);
  return (
    <section id="shapes" className="card window reveal" data-title="skewness.json">
      <div className="head">
        <div>
          <p className="eyebrow">Transforms of capped Amount</p>
          <h2>Square root gets closest to symmetric; log overshoots.</h2>
          <p className="sub">
            Skewness of Amount after each transform, as printed by the notebook on a {fmt(d.sampleRows)}-row sample (cell 29). Closest to zero: <b>{best.label.toLowerCase()}</b> ({best.value}).
            Standardizing is a linear rescale, so it cannot change skewness, and it does not ({s.find((r) => r.key === 'std').value}).
          </p>
        </div>
        <Recorded cell={29} />
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Skewness of Amount under six transforms">
        {[-1, -0.5, 0, 0.5, 1].map((t) => <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={0} y2={H - 22} strokeWidth={t === 0 ? 2 : 1} /><text x={x(t)} y={H - 6} textAnchor="middle">{t}</text></g>)}
        {s.map((r, i) => {
          const y = i * rowH + 6, c = r === best ? 'var(--good)' : Math.abs(r.value) > 0.5 ? 'var(--bad)' : 'var(--warn)';
          return (
            <g key={r.key}>
              <text x={0} y={y + 15} style={{ fill: 'var(--text)', fontSize: 13 }}>{r.label}</text>
              <rect x={Math.min(x(0), x(r.value))} y={y + 2} width={Math.abs(x(r.value) - x(0))} height={rowH - 12} rx="5" fill={c} opacity="0.85" />
              <text x={r.value >= 0 ? x(r.value) + 6 : x(r.value) - 6} y={y + 15} textAnchor={r.value >= 0 ? 'start' : 'end'} style={{ fill: 'var(--text)' }}>{r.value}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Calendar days in the recorded date range, grouped by month and by weekday (computed live).
function calendar() {
  const byMonth = {}, byWeekday = {};
  for (let t = Date.parse(d.firstDate); t <= Date.parse(d.lastDate); t += 864e5) {
    const dt = new Date(t), m = dt.getUTCMonth() + 1, wd = (dt.getUTCDay() + 6) % 7;
    byMonth[m] = (byMonth[m] || 0) + 1;
    byWeekday[wd] = (byWeekday[wd] || 0) + 1;
  }
  return { byMonth, byWeekday };
}

function TimePatterns() {
  const [view, setView] = useState('month');
  const [metric, setMetric] = useState('count');
  const [hover, setHover] = useState(null);
  const cal = useMemo(calendar, []);
  const startM = new Date(Date.parse(d.firstDate)).getUTCMonth() + 1;
  const rows = useMemo(() => {
    if (view === 'weekday') return WEEKDAYS.map((l, i) => ({ l: l.slice(0, 3), full: l, v: d.weekdays[i], per: cal.byWeekday[i], unit: 'day' }));
    if (view === 'period') return Object.entries(d.periods).map(([l, v]) => ({ l, full: `${l} (${d.periodHours[l]} h)`, v, per: d.periodHours[l], unit: 'clock hour' }));
    return Array.from({ length: 12 }, (_, i) => ((startM - 1 + i) % 12) + 1).filter((m) => d.months[m]).map((m) => ({ l: MONTHS[m - 1], full: MONTHS[m - 1], v: d.months[m], per: cal.byMonth[m], unit: 'day' }));
  }, [view, cal, startM]);
  const val = (r) => (metric === 'count' ? r.v : metric === 'share' ? r.v / d.rows : r.v / r.per);
  const show = (r) => (metric === 'count' ? fmt(r.v) : metric === 'share' ? pct(r.v / d.rows) : `${fmt(r.v / r.per)} / ${r.unit}`);
  const max = Math.max(...rows.map(val));
  const narrow = useNarrow();
  const W = narrow ? 420 : 960, H = narrow ? 220 : 260, pad = { l: 12, r: 12, t: 26, b: 28 };
  const bw = (W - pad.l - pad.r) / rows.length;
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const rateLabel = view === 'period' ? 'Per clock hour' : 'Per calendar day';
  return (
    <section id="time" className="card window reveal" data-title="time_features.csv">
      <div className="head">
        <div>
          <p className="eyebrow">Time features, recorded counts</p>
          <h2>October and August look quiet. Per day, they are not.</h2>
          <p className="sub">
            The data runs {d.firstDate} to {d.lastDate}, so September never appears and both end months are partial. Dividing the recorded counts (cell 22) by the calendar days each month
            actually covers, computed here, levels them out. Weekend share {pct(d.weekend, 2)}, business-hours share (08:00 to 17:59) {pct(d.business, 2)}.
          </p>
        </div>
        <Recorded cell={22} />
      </div>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Seg label="Group by" value={view} onChange={setView} options={[['month', 'Month'], ['weekday', 'Weekday'], ['period', 'Time of day']]} />
        <Seg label="Metric" value={metric} onChange={setMetric} options={[['count', 'Rows'], ['share', 'Share'], ['rate', rateLabel]]} />
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Transactions by ${view}, ${metric}`} onMouseLeave={() => setHover(null)}>
        <line className="axis" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
        {rows.map((r, i) => {
          const v = val(r), on = hover === i;
          return (
            <g key={r.l} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw + bw * 0.14} width={bw * 0.72} y={y(v)} height={y(0) - y(v)} rx="6" fill="var(--primary)" opacity={hover == null || on ? 0.8 : 0.35} />
              <text x={pad.l + (i + 0.5) * bw} y={y(v) - 8} textAnchor="middle" className="bar-val" style={narrow ? { fontSize: 8 } : undefined}>{metric === 'share' ? pct(v) : short(v)}</text>
              <text x={pad.l + (i + 0.5) * bw} y={H - 8} textAnchor="middle">{r.l}</text>
            </g>
          );
        })}
      </svg>
      <div className="tip" aria-live="polite">{hover != null ? <>{rows[hover].full}: {show(rows[hover])}{metric !== 'count' && <> ({fmt(rows[hover].v)} rows over {rows[hover].per} {rows[hover].unit}s)</>}</> : 'Hover a bar for the exact figure.'}</div>
    </section>
  );
}

function Correlations() {
  const narrow = useNarrow();
  const W = narrow ? 420 : 960, rowH = 32, L = narrow ? 150 : 220, R = 50, H = d.withLabel.length * rowH + 28, lim = 0.03;
  const x = (v) => L + (v / lim) * (W - L - R);
  return (
    <section id="corr" className="card window reveal" data-title="corr_matrix.png">
      <div className="head">
        <div>
          <p className="eyebrow">Correlation, with a health warning</p>
          <h2>Nothing tracks the laundering flag, and the method can’t tell.</h2>
          <p className="sub">
            Pearson correlation with <code>Is_laundering</code> (cell 34) never exceeds |r| = {Math.max(...d.withLabel.map((r) => Math.abs(r.r))).toFixed(3)}. But most of these columns are
            nominal categories turned into integers by a label encoder (for example Time as 0 to {fmt(d.corrSummary.encodedTime)}), and Pearson on arbitrary codes measures the code order, not the association.
            Cramér’s V or mutual information would be the valid measures.
          </p>
        </div>
        <Recorded cell={34} />
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Absolute Pearson correlation of each attribute with Is_laundering">
        {[0, 0.01, 0.02, 0.03].map((t) => <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={0} y2={H - 22} /><text x={x(t)} y={H - 6} textAnchor="middle">{t}</text></g>)}
        {d.withLabel.map((r, i) => (
          <g key={r.name} transform={`translate(0 ${i * rowH + 4})`}>
            <text x={0} y={16} style={{ fill: 'var(--text)', fontSize: 13 }}>{r.name}</text>
            <rect x={L} y={4} width={Math.max(2, x(Math.abs(r.r)) - L)} height={rowH - 12} rx="5" fill={r.r < 0 ? 'var(--warn)' : 'var(--primary)'} opacity="0.85" />
            <text x={x(Math.abs(r.r)) + 6} y={16}>{r.r.toFixed(4)}</text>
          </g>
        ))}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--warn)' }} />negative r</span><span><i style={{ background: 'var(--primary)' }} />positive r</span><span>bar length is |r|</span></div>
      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="tile">
          <h3>The {d.strongPairs.length} “strong” pairs (cell 33)</h3>
          {d.strongPairs.map((p) => <p key={p.a} className="hint" style={{ margin: '6px 0 0' }}><b className="mono">{p.a}</b> ↔ <b className="mono">{p.b}</b>: r = {p.r}</p>)}
          <p className="hint" style={{ margin: '8px 0 0' }}>Plausible (a currency usually goes with its country), but the size of r depends on the alphabetical codes. Of {d.corrSummary.pairs} pairs, the mean r was {d.corrSummary.mean} and the most negative {d.corrSummary.maxNeg}.</p>
        </div>
        <div className="tile">
          <h3>Two more problems</h3>
          <p className="hint" style={{ margin: '6px 0 0' }}>The “core 12 attributes” cell ran on a dataframe without the time features: it warns that {d.missingCore.join(', ')} were not found, and used {d.coreUsed} attributes.</p>
          <p className="hint" style={{ margin: '6px 0 0' }}><code>Laundering_type</code> names normal rows <span className="mono">Normal_…</span> (for example Normal_Small_Fan_Out), so it very likely encodes the answer and would leak the label into any model.</p>
        </div>
      </div>
    </section>
  );
}

function Figures() {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => { if (open != null) ref.current?.showModal?.(); else ref.current?.close?.(); }, [open]);
  const f = open != null ? d.figures[open] : null;
  return (
    <section id="figures" className="card window reveal" data-title="Preview — 17 figures">
      <div className="head">
        <div>
          <p className="eyebrow">Recorded matplotlib output</p>
          <h2>All {d.figures.length} figures, lifted out of the notebook at build time.</h2>
          <p className="sub">Decoded from the base64 <code>image/png</code> outputs, captioned with the first comment of the cell that drew them. Click one to enlarge.</p>
        </div>
        <Recorded />
      </div>
      <div className="gallery">
        {d.figures.map((g, i) => (
          <button type="button" key={g.file} onClick={() => setOpen(i)} aria-label={`Enlarge figure from cell ${g.cell}: ${g.caption}`}>
            <img src={`${BASE}generated/fig/${g.file}`} alt="" />
            <span><b>cell {g.cell}</b> {g.caption}</span>
          </button>
        ))}
      </div>
      <dialog ref={ref} className="lightbox" onClose={() => setOpen(null)} onClick={(e) => e.target === ref.current && setOpen(null)}>
        {f && <>
          <img src={`${BASE}generated/fig/${f.file}`} alt={`Figure from cell ${f.cell}: ${f.caption}`} />
          <div className="lb-bar"><span><b>cell {f.cell}</b> · {f.caption}</span><button type="button" className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
        </>}
      </dialog>
    </section>
  );
}

function Audit() {
  const bugs = [
    ['subprocess is never imported', 'The final pandoc step would raise NameError.'],
    ['Missing inputs', <>It reads <code>file.ipynb</code> and <code>template.html</code>; neither is in the repo.</>],
    ['Outputs would be stripped', <><code>ClearOutputPreprocessor</code> is assigned to an attribute nbconvert ignores. Registered properly, it would delete the outputs the report needs.</>],
    ['Heavy toolchain', 'PDFExporter needs LaTeX; the pandoc step needs a PDF engine and overwrites the first PDF.'],
    ['Recorded run failed', <>The one stored output is <code>PandocMissing</code>.</>],
  ];
  const method = [
    ['Capping erases the signal', `${fmt(d.capped)} large amounts clipped, maximum ${short(d.amount.before.max)} down to ${money(d.amount.after.max)}, with no check of how many were laundering.`],
    ['Duplicates created, not handled', `Capping produced ${d.dupAfter} duplicate rows; they are reported and kept.`],
    ['IDs treated as numbers', 'Account IDs get skewness, Shapiro-Wilk and a “no transformation needed” verdict. Identifiers have no distribution to analyse.'],
    ['Contradictory normality reading', `Shapiro-Wilk rejects normality in all ${d.rejects} tests (n = ${fmt(d.shapiroN)} makes rejection near certain), yet ${d.noTransform} variables are then called approximately normal.`],
    ['Invalid association measure', 'Pearson on label-encoded nominal columns, and Laundering_type very likely leaks the label.'],
    ['Summary contradicts output', `The markdown summary says ${d.summary25.cols} columns (12 + ${d.summary25.added}) and “removed duplicates”; the code printed ${d.featureCols} columns (12 + ${d.newFeatures}) and removed 0.`],
    ['No run to reproduce', `0 of ${nbInfo[CLEAN].census.code} code cells carry an execution count, and the dataset is not in the repo, so every number is a stored output.`],
    ['No model, no baseline', `At ${(d.launder.pct10).toFixed(3)}% positives there is no split, no baseline and no metric; the notebook ends at a CSV export.`],
  ];
  return (
    <section id="audit" className="card window reveal" data-title="review.txt">
      <p className="eyebrow">Audit · limitations</p>
      <h2>What doesn’t hold up, said plainly.</h2>
      <p className="sub">The full grading against a research rubric, with what each gap would need, is in <a href={blob('docs/research-review.md')}>docs/research-review.md</a>.</p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <h3>AutoReport.ipynb, as committed <span className="pill bad">Does not run</span></h3>
          <ul className="audit">{bugs.map(([t, x]) => <li key={t}><b>{t}.</b> <span className="hint">{x}</span></li>)}</ul>
          <h3 style={{ marginTop: 16 }}>Fixed in this branch <span className="pill good">Tested</span></h3>
          <ul className="audit">
            <li><b>autoreport.py.</b> <span className="hint">Takes the notebook path, keeps outputs, needs only nbconvert; <code>--no-code</code>, <code>--no-outputs</code>, optional <code>--pdf</code>.</span></li>
            <li><b>tests/test_autoreport.py.</b> <span className="hint">Converts the cleaning notebook and checks {nbInfo[CLEAN].census.cells} cells and {d.figures.length} figures survive.</span></li>
          </ul>
        </div>
        <div>
          <h3>Cleaning notebook, method <span className="pill warn">Caveats</span></h3>
          <ul className="audit">{method.map(([t, x]) => <li key={t}><b>{t}.</b> <span className="hint">{x}</span></li>)}</ul>
        </div>
      </div>
    </section>
  );
}
