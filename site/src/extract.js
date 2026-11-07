// Reads every number the dashboard shows out of the recorded outputs of
// assignment2DataCleaning_final_original.ipynb. Each lookup throws if its pattern is missing,
// so a changed notebook fails the build instead of showing a stale or invented number.
import { join, census, caption } from './notebook.js';

const outText = (cell) => (cell.outputs || []).map((o) => (o.output_type === 'stream' ? join(o.text) : join(o.data?.['text/plain']))).join('\n');
const n = (s) => Number(String(s).replace(/,/g, ''));

export function extract(nb) {
  const cell = (i) => outText(nb.cells[i]);
  const need = (i, re, label) => {
    const m = cell(i).match(re);
    if (!m) throw new Error(`extract: "${label}" not found in cell ${i}`);
    return m;
  };
  const all = (i, re, label, min = 1) => {
    const m = [...cell(i).matchAll(re)];
    if (m.length < min) throw new Error(`extract: "${label}" found ${m.length} times in cell ${i}, expected ${min}+`);
    return m;
  };
  const dict = (s) => Object.fromEntries([...s.matchAll(/(\d+): (\d+)/g)].map((m) => [+m[1], +m[2]]));
  // describe() tables: the row label followed by four numbers (Sender, Receiver, Amount, Is_laundering)
  const describeRow = (label) => need(6, new RegExp(`^${label}\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s*$`, 'm'), `describe ${label}`).slice(1).map(Number);

  const shape = need(4, /Dataset shape: \((\d+), (\d+)\)/, 'shape');
  const before = Object.fromEntries(['mean', 'std', 'min', '25%', '50%', '75%', 'max'].map((k) => [k, describeRow(k)[2]]));
  const launderMean = describeRow('mean')[3];

  const out10 = need(10, /0\s+Amount\s+(\d+)\s+([\d.]+)\s+(-?[\d.]+)/, 'Amount outliers');
  const upper10 = need(10, /Upper_Bound\s*\n0\s+([\d.]+)/, 'Amount upper bound');
  const lab10 = need(10, /1\s+Is_laundering\s+(\d+)\s+([\d.]+)/, 'Is_laundering outlier pct');

  const capped = need(13, /Column 'Amount' processed (\d+) outliers/, 'capped count');
  const dist = need(13, /Is_laundering distribution: \{0: (\d+), 1: (\d+)\}/, 'class split');
  const missingAfter = need(13, /Missing values: (\d+)/, 'missing after');
  const dupAfter = need(13, /Duplicate values: (\d+)/, 'duplicates after');
  const dupBefore = need(9, /Number of duplicate rows: (\d+)/, 'duplicates before');
  need(8, /No missing values in the dataset/, 'no missing');

  // cell 16 prints the post-capping summary in three wrapped blocks; take the Amount line of each
  const am = all(16, /^Amount\s+(.+)$/gm, 'Amount summary', 3).map((m) => m[1].trim().split(/\s+/).map(Number));
  const after = { mean: am[0][3], std: am[1][0], min: am[1][1], '25%': am[1][2], '50%': am[1][3], '75%': am[2][0], max: am[2][1], skew: am[2][2], kurt: am[2][3] };

  const shape22 = need(22, /After adding time features: \((\d+), (\d+)\)/, 'feature shape');
  const newFeatures = need(22, /Number of new features: (\d+)/, 'new features');
  const months = dict(need(22, /Month distribution: (\{[^}]*\})/, 'months')[1]);
  const weekdays = dict(need(22, /Weekday distribution: (\{[^}]*\})/, 'weekdays')[1]);
  const weekend = +need(22, /Weekend transaction ratio: ([\d.]+)/, 'weekend')[1];
  const business = +need(22, /Business hour transaction ratio: ([\d.]+)/, 'business')[1];
  const periods = Object.fromEntries(all(22, /^(Morning|Afternoon|Evening|Night)\s+(\d+)$/gm, 'time periods', 4).map((m) => [m[1], +m[2]]));
  // hours per time period, read from categorize_hour() in the cell 22 source; Night is the remainder
  const periodHours = Object.fromEntries([...join(nb.cells[22].source).matchAll(/if (\d+) <= hour < (\d+):\s*return '(\w+)'/g)].map((m) => [m[3], m[2] - m[1]]));
  if (Object.keys(periodHours).length !== 3) throw new Error('extract: categorize_hour bounds not found in cell 22');
  periodHours.Night = 24 - Object.values(periodHours).reduce((a, x) => a + x, 0);
  const firstDate = need(5, /^0\s+\S+\s+(\d{4}-\d\d-\d\d)/m, 'first date')[1];
  const lastDate = need(5, new RegExp(`^${+shape[1] - 1}\\s+\\S+\\s+(\\d{4}-\\d\\d-\\d\\d)`, 'm'), 'last date')[1];
  const uniqueDates = +need(24, /^1\s+Date\s+\S+\s+\d+\s+(\d+)/m, 'unique dates')[1];
  const fileMb = +need(24, /approximately ([\d.]+) MB/, 'file size')[1];

  const sampleRows = n(need(27, /sampling ([\d,]+) rows for analysis/, 'analysis sample')[1]);
  const shapiroN = +need(27, /Shapiro-Wilk, n=(\d+)/, 'Shapiro n')[1];
  const rejects = all(27, /Reject normality hypothesis/g, 'Shapiro rejections').length;
  const noTransform = all(27, /approximately normal, no transformation needed/g, 'no-transform verdicts').length;

  const skewLabels = [['original', 'Original'], ['log', 'Log'], ['sqrt', 'Square root'], ['boxcox', 'Box-Cox'], ['yeo', 'Yeo-Johnson'], ['std', 'Standardization']];
  const skewRe = { original: /Original distribution skewness: (-?[\d.]+)/, log: /Log transformation skewness: (-?[\d.]+)/, sqrt: /Square root transformation skewness: (-?[\d.]+)/, boxcox: /Box-Cox transformation skewness: (-?[\d.]+)/, yeo: /Yeo-Johnson transformation skewness: (-?[\d.]+)/, std: /Standardization skewness: (-?[\d.]+)/ };
  const skewness = skewLabels.map(([k, label]) => ({ key: k, label, value: +need(29, skewRe[k], `skew ${k}`)[1] }));

  const pairNames = all(33, /^(\d)\s+(\w+)_encoded\s+(\w+)_encoded/gm, 'strong pair names', 2);
  const pairR = Object.fromEntries(all(33, /^(\d)\s+(0\.\d+)\s*$/gm, 'strong pair r', 2).map((m) => [m[1], +m[2]]));
  const strongPairs = pairNames.map((m) => ({ a: m[2], b: m[3], r: pairR[m[1]] }));
  const corrSummary = {
    pairs: +need(33, /Total correlation coefficient pairs: (\d+)/, 'pairs')[1],
    mean: +need(33, /Average correlation coefficient: (-?[\d.]+)/, 'avg r')[1],
    maxPos: +need(33, /Highest positive correlation: (-?[\d.]+)/, 'max r')[1],
    maxNeg: +need(33, /Highest negative correlation: (-?[\d.]+)/, 'min r')[1],
    encodedTime: +need(33, /Time: (\d+) unique values -> encoded as 0-(\d+)/, 'time encoding')[2],
  };
  const missingCore = all(34, /Warning: (\w+) not found/g, 'missing core attributes').map((m) => m[1]);
  const coreUsed = +need(34, /Available core attributes \((\d+)\)/, 'core used')[1];
  const withLabel = all(34, /^\d\s+(\w+)\s+(-?[\d.]+)\s+([\d.]+)$/gm, 'label correlations', 6).map((m) => ({ name: m[1].replace(/_encoded$/, ''), r: +m[2] }));

  const headings = nb.cells.map((c, i) => [i, join(c.source).trim()]).filter(([, s]) => /^## \d\. /.test(s)).map(([i, s]) => ({ cell: i, title: s.replace(/^## \d\. /, '').split('\n')[0] }));
  const summary25 = need25(nb);

  const figures = [];
  nb.cells.forEach((c, i) => (c.outputs || []).forEach((o, k) => { if (o.data?.['image/png']) figures.push({ cell: i, k, file: `cell${i}_${k}.png`, caption: caption(c) }); }));

  return {
    rows: +shape[1], cols: +shape[2], firstDate, lastDate, uniqueDates,
    amount: { before, after, iqrCount: +out10[1], iqrPct: +out10[2], lower: +out10[3], upper: +upper10[1] },
    launder: { neg: +dist[1], pos: +dist[2], pct10: +lab10[2], mean6: launderMean },
    capped: +capped[1], missingBefore: 0, missingAfter: +missingAfter[1], dupBefore: +dupBefore[1], dupAfter: +dupAfter[1],
    featureCols: +shape22[2], newFeatures: +newFeatures[1], fileMb,
    months, weekdays, periods, periodHours, weekend, business,
    sampleRows, shapiroN, rejects, noTransform, skewness,
    strongPairs, corrSummary, missingCore, coreUsed, withLabel,
    headings, summary25, figures, census: census(nb),
  };
}

// The markdown summary (cell 25) claims a column count that the code output contradicts.
function need25(nb) {
  const s = join(nb.cells[25].source);
  const m = s.match(/\*\*Total Columns\*\*: (\d+) \(original 12 columns \+ (\d+) time features\)/);
  if (!m) throw new Error('extract: summary column claim not found in cell 25');
  return { cols: +m[1], added: +m[2] };
}
