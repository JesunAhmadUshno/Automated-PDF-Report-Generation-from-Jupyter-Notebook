// Known-answer check, run by `npm run build` before vite. It reproduces numbers the notebook
// printed in one cell from numbers it printed in another, using the same functions the page runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { iqrBounds, imbalance } from './calc.js';
import { parseNotebook, census, reportBlocks } from './notebook.js';

const d = JSON.parse(fs.readFileSync(new URL('./generated/data.json', import.meta.url)));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1. IQR bounds: describe() quartiles (cell 6, printed to 7 significant digits) give the cell 10 bounds.
const b = iqrBounds(d.amount.before['25%'], d.amount.before['75%'], 1.5);
close(b.lo, d.amount.lower, 0.02, 'lower bound');
close(b.hi, d.amount.upper, 0.02, 'upper bound');
assert.ok(b.lo < d.amount.before.min, 'lower bound sits below the minimum, so all capping is from above');
close(d.amount.after.max, d.amount.upper, 0.01, 'post-capping max equals the upper bound');
assert.equal(d.capped, d.amount.iqrCount, 'cells 10 and 13 agree on the capped count');
close((d.capped / d.rows) * 100, d.amount.iqrPct, 5e-7, 'capped percentage');

// 2. Class imbalance: cell 13 counts reproduce cell 10's percentage and cell 6's mean.
const im = imbalance(d.launder.neg, d.launder.pos, 1000);
assert.equal(im.total, d.rows, 'class counts sum to the row count');
close(im.p * 100, d.launder.pct10, 5e-7, 'laundering percentage');
close(im.p, d.launder.mean6, 5e-10, 'Is_laundering mean');
close(im.majorityAcc, 0.998961, 1e-6, 'always-normal accuracy');

// 3. Time features: every distribution sums to the row count; weekend share recomputes.
for (const [k, obj] of [['months', d.months], ['weekdays', d.weekdays], ['periods', d.periods]])
  assert.equal(Object.values(obj).reduce((a, x) => a + x, 0), d.rows, `${k} sum`);
close((d.weekdays[5] + d.weekdays[6]) / d.rows, d.weekend, 5e-5, 'weekend share');
assert.equal(d.cols + d.newFeatures, d.featureCols, '12 + 12 = 24 columns');
assert.ok(!(9 in d.months), 'September absent');
const days = (Date.parse(d.lastDate) - Date.parse(d.firstDate)) / 864e5 + 1;
assert.equal(days, d.uniqueDates, 'every calendar day in the range appears (321 of 321)');
assert.deepEqual(d.periodHours, { Morning: 6, Afternoon: 6, Evening: 4, Night: 8 });

// 4. Recorded values the page leads with (guards against a silent regex drift).
assert.deepEqual([d.rows, d.cols, d.launder.pos, d.capped, d.dupAfter], [9504852, 12, 9873, 429848, 5]);
assert.deepEqual(d.skewness.map((s) => s.value), [0.953, -1.212, 0.058, -0.169, -0.169, 0.953]);
assert.deepEqual(d.strongPairs.map((p) => p.r), [0.811, 0.77]);
assert.ok(d.withLabel.every((x) => Math.abs(x.r) < 0.024), 'all label correlations tiny');
assert.equal(d.figures.length, 17);

// 5. Report Builder logic on the real notebooks.
const nb = parseNotebook(fs.readFileSync(new URL('../public/generated/nb/assignment2DataCleaning_final_original.ipynb', import.meta.url), 'utf8'));
const c = census(nb);
assert.deepEqual([c.cells, c.code, c.raw, c.markdown, c.images, c.executed], [35, 26, 8, 1, 17, 0]);
const full = reportBlocks(nb), noCode = reportBlocks(nb, { code: false }), bare = reportBlocks(nb, { outputs: false, code: false });
assert.equal(full.filter((x) => x.kind === 'image').length, 17);
assert.equal(noCode.filter((x) => x.kind === 'code').length, 0);
assert.ok(bare.every((x) => x.kind === 'prose'));
assert.ok(full.some((x) => x.kind === 'text' && x.text.includes('Dataset shape: (9504852, 12)')));
assert.ok(!JSON.stringify(full.filter((x) => x.kind === 'prose')).includes('<a '), 'HTML stripped from prose');
const auto = parseNotebook(fs.readFileSync(new URL('../public/generated/nb/AutoReport.ipynb', import.meta.url), 'utf8'));
assert.deepEqual([census(auto).cells, census(auto).errors], [2, 1]);
assert.ok(reportBlocks(auto).some((x) => x.kind === 'error' && x.text.startsWith('PandocMissing')));
assert.throws(() => parseNotebook('{"nope":1}'), /not a Jupyter notebook/);
assert.throws(() => parseNotebook('not json'), /not valid JSON/);

console.log('known-answer check ok', { lower: b.lo.toFixed(3), upper: b.hi.toFixed(3), prevalencePct: (im.p * 100).toFixed(6), cells: c.cells, figures: c.images });
