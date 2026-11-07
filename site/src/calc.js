// Live calculators. Inputs are recorded notebook values; the arithmetic runs in the browser.
export function iqrBounds(q1, q3, k) {
  const iqr = q3 - q1;
  return { iqr, lo: q1 - k * iqr, hi: q3 + k * iqr };
}

export function imbalance(neg, pos, n) {
  const total = neg + pos, p = pos / total;
  return { total, p, majorityAcc: neg / total, perPositive: total / pos, expected: n * p, atLeastOne: 1 - Math.pow(1 - p, n) };
}
