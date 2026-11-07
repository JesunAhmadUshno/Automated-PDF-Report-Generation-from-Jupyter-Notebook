# Research and engineering review

Scope: everything in this repo as of the `site/live-dashboard` branch: `AutoReport.ipynb` (notebook-to-PDF tool), `assignment2DataCleaning_final_original.ipynb` (SAML-D cleaning coursework), and the additions made on this branch (`autoreport.py`, `tests/`, `site/`).

Grades use a PhD-style rubric (A = publishable standard, C = acceptable coursework, F = absent). The repo is two different things: a small engineering tool and an exploratory data-cleaning exercise. Each is graded on the criteria that apply to it. All numbers below come from the notebooks' recorded outputs (cell numbers are 0-based, as in the dashboard).

## Summary

| Area | Before this branch | Now | What it would take to raise it |
| --- | --- | --- | --- |
| Engineering: does the tool run? | F | B | Add a CLI test for `--pdf` in CI (needs Chromium in the runner, about 150 MB download). |
| Engineering: docs match the code | F | B+ | Add a LICENSE (Owner's decision). |
| Engineering: tests and CI | F | B | Test on a second, small notebook with markdown attachments and errors. |
| Research question | D | D | Write one down (see below). Documentation only. |
| Hypotheses | F | F | Needs a modelling stage; see "Baselines". |
| Method (cleaning) | D | D (documented) | Rerun with the fixes listed under "Method"; needs `SAML-D.csv`. |
| Baselines | F | F | Needs the dataset and a modelling notebook. |
| Statistics and uncertainty | D | D | Needs the dataset to compute intervals. |
| Reproducibility | F | D | Needs the dataset's source, licence and SHA-256 committed, then one top-to-bottom run. |
| Threats to validity | F | C | Listed in README and on the dashboard; quantifying them needs the data. |
| Related work | F | F | A literature pass; no compute. Not done here to avoid unverified citations. |
| Limitations | F | B | Written in README, here and on the dashboard. |

## Engineering rigor (AutoReport)

**What was wrong.** `AutoReport.ipynb` cannot run as committed:

- `subprocess.run(...)` is called but `subprocess` is never imported.
- It reads `file.ipynb` and a Jinja template `template.html`; neither exists in the repo.
- `html_exporter.preprocessor = ClearOutputPreprocessor()` sets an attribute nbconvert never reads. Registered properly it would strip every output, the opposite of what a report needs.
- `PDFExporter` needs a LaTeX installation; the pandoc step needs a PDF engine and overwrites the PDF from the step before. The notebook's one stored output is `PandocMissing: Pandoc wasn't found`.
- The old README described `autoreport.py`, `config.py`, `requirements.txt`, `input/` and `output/` directories, a LICENSE and a contact address, none of which existed.

**Fixed on this branch (cheap, done).**

- `autoreport.py`: the input path is an argument; uses `HTMLExporter` only, so outputs and figures are kept and embedded; `--no-code` and `--no-outputs` map to nbconvert's `exclude_input` and `exclude_output`; optional `--pdf` via WebPDF with a clear error when Chromium is missing. No LaTeX, pandoc or template needed.
- `requirements.txt` with exact pins (nbformat 5.11.1, nbconvert 7.17.2, jinja2 3.1.6).
- `tests/test_autoreport.py`: converts the cleaning notebook and asserts 35 cells, exactly 17 embedded figures, a known text output, that `--no-code` hides code, and that the CLI writes a file. Runs in about 1.5 s.
- CI: `.github/workflows/pages.yml` runs the tests, then builds the dashboard, whose build fails if any number cannot be re-extracted from the notebook (`site/src/check.mjs`).
- README rewritten to describe the files that exist.
- The original notebook is kept unchanged as a record.

**Remaining gaps.**

- PDF path untested in CI: needs Chromium in the runner (`pip install "nbconvert[webpdf]" && playwright install chromium`, about 150 MB, about 1 minute per run).
- No LICENSE file. The old README claimed MIT; adding one is the Owner's call, not assumed here.

## Research rigor (cleaning notebook)

### Question and hypotheses

The notebook states tasks (load, clean, visualise, save), not a question. Its own summary suggests money-laundering detection as a next step. A testable framing would be: *Which transaction features separate laundering from normal transactions in SAML-D, and does IQR capping of Amount remove that signal?* No hypothesis is stated or tested. **Needed:** a modelling notebook on `SAML-D.csv` (minutes of CPU, no GPU).

### Method

Recorded problems, each visible in the outputs:

1. **Capping may erase the signal.** 429,848 Amount values (4.52%) were clipped to [−10,328.475, 22,930.625]; the maximum fell from 12,618,500 to 22,930.62 and the standard deviation from 25,614.95 to 6,150.59 (cells 6, 10, 13, 16). The lower bound sits below the smallest amount (3.73), so every cap was from above. The laundering share among capped rows is never checked. **Needed:** one groupby on `SAML-D.csv`: laundering rate among rows above the cap versus below.
2. **Capping created duplicates.** 0 duplicates before, 5 after (cells 9, 13); reported, not handled. **Needed:** rerun with deduplication after capping.
3. **Identifiers treated as numbers.** `Sender_account` and `Receiver_account` get skewness, kurtosis, Shapiro-Wilk and "no transformation needed" (cell 27). Identifiers have no meaningful distribution. **Fix:** drop them from numeric analysis; use them only for graph or frequency features.
4. **Contradictory normality reading.** Shapiro-Wilk (n = 5,000) rejects normality for all 3 variables, then 2 are called "approximately normal" (cell 27). At this n, rejection is near certain; the test answers the wrong question. **Fix:** use skewness and Q-Q plots, and drop the test.
5. **Invalid association measure.** Pearson correlation on label-encoded nominal columns (Time encoded 0 to 86,399; currencies, locations, payment type, laundering type) measures alphabetical code order (cell 33). The two "strong" pairs (0.811 and 0.770, currency with location) are plausible, but their size is an artefact of the encoding. **Needed:** Cramér's V or mutual information on the full data.
6. **Label leakage.** `Laundering_type` names normal rows `Normal_…`, so it very likely encodes `Is_laundering` and must be excluded from any model.
7. **Wrong dataframe.** The "core 12 attributes" cell warns that `hour`, `is_weekend`, `is_business_hour`, `dayofweek` and `month` were not found and uses 7 attributes (cell 34).
8. **Internal contradictions.** The markdown summary says 21 columns (12 + 9) and "removed duplicates"; the code printed 24 columns (12 + 12) and removed 0 (cells 22 to 25). A Gini coefficient of 1.000 is labelled "relatively concentrated" (cell 30). The `Outlier_Percentage(%)` column holds booleans (cell 32). Matplotlib fonts are set to SimHei and Arial Unicode MS (cell 2).

### Baselines

None. With laundering rows at 0.104% (9,873 of 9,504,852), always predicting "normal" is 99.90% accurate, which the dashboard computes from the recorded counts. Any future model must be judged by recall, precision and PR-AUC against that baseline and a simple logistic regression. **Needed:** the dataset, a time-ordered train/test split, minutes of CPU.

### Statistics and uncertainty

Every figure is a point estimate. Distribution statistics come from 10,000, 50,000 and 100,000-row samples with no stated seed, so they cannot be reproduced exactly. The 10,000-row plotting samples would contain about 10 laundering rows (computed on the dashboard from the recorded prevalence), too few to show anything about the positive class. **Needed:** fixed seeds and bootstrap intervals on the full data.

### Reproducibility

- `SAML-D.csv` is not in the repo, and its source, version and licence are not recorded.
- No code cell has an execution count (0 of 26), so the outputs cannot be tied to a recorded top-to-bottom run.
- No environment file for the cleaning notebook (pandas, scipy, seaborn, scikit-learn versions unknown).

**Done cheaply:** the dashboard re-extracts every number from the stored outputs at build time and cross-checks them (IQR bounds from the quartiles, prevalence from the class counts, distribution sums against the row count, 321 calendar days in the range against 321 unique dates). That proves the outputs are internally consistent, not that they can be regenerated. **Needed:** the dataset's source and SHA-256 in the repo, a pinned environment, and one clean run (the notebook reports about 870 MB in memory and a cleaned export of about 1,487 MB).

### Threats to validity

Written down (README, dashboard audit): capping bias, the encoding artefacts in correlation, label leakage, sampling without seeds, the wrong-dataframe cell. None is quantified, because that needs the data.

### Related work

None cited. No citations are added here, because none were verified for this review. **Needed:** a short literature pass on AML transaction monitoring and on the dataset's original publication (no compute).

### Limitations

Now stated in README, here, and on the dashboard. The dashboard labels every recorded value as recorded, and its only live computations are arithmetic on recorded inputs (IQR bounds, imbalance rates, per-day normalisation) and the in-browser report builder.
