# Automated-PDF-Report-Generation-from-Jupyter-Notebook

Live dashboard: https://jesunahmadushno.github.io/Automated-PDF-Report-Generation-from-Jupyter-Notebook/

Turn a Jupyter notebook into a shareable report, shown on a real data-cleaning notebook.

## What is in this repo

| File | What it is |
| --- | --- |
| `autoreport.py` | Runnable notebook-to-report script. Writes a self-contained HTML report (outputs and figures kept); optional PDF. |
| `AutoReport.ipynb` | The original notebook version of the idea, kept unchanged. It does not run as committed (see Limitations). |
| `assignment2DataCleaning_final_original.ipynb` | A coursework data-cleaning notebook on the SAML-D anti-money-laundering transactions file (9,504,852 rows, 12 columns), with its recorded outputs and 17 figures. |
| `tests/test_autoreport.py` | Smoke test: converts the cleaning notebook and checks that its 35 cells and 17 figures survive. |
| `site/` | The live dashboard (React + Vite). It reads both notebooks at build time; no number on it is typed by hand. |
| `docs/research-review.md` | A graded review of the repo's method and engineering, with what each gap would need. |

## How to use AutoReport

```bash
pip install -r requirements.txt
python autoreport.py assignment2DataCleaning_final_original.ipynb            # -> .html next to the notebook
python autoreport.py my.ipynb -o report.html --no-code                       # hide code inputs
python autoreport.py my.ipynb --pdf                                          # also a PDF (see below)
```

For a PDF, open the HTML in a browser and print to PDF, or use `--pdf`, which uses nbconvert's WebPDF exporter and needs `pip install "nbconvert[webpdf]"` plus a one-time Chromium download (`playwright install chromium`). No LaTeX or pandoc is needed.

The dashboard's Report Builder does the same job in the browser: pick a notebook (or drop your own), choose prose, code and outputs, and print to PDF.

## Tests and dashboard

```bash
python -m pytest -q tests
cd site && npm ci && npm run build      # build runs a known-answer check against the notebook outputs
```

`.github/workflows/pages.yml` runs both on push to `main` and publishes `site/dist` to GitHub Pages.

## Data

The cleaning notebook reads `SAML-D.csv`, which is not included in this repo, and the repo does not record where it came from. Every result in the notebook is therefore a stored output: it cannot be rerun from the repo alone, and the notebook cells carry no execution counts.

## Limitations

AutoReport.ipynb as committed:

- `subprocess` is used but never imported; it reads `file.ipynb` and `template.html`, which are not in the repo.
- `html_exporter.preprocessor = ClearOutputPreprocessor()` is ignored by nbconvert; if registered properly it would remove the outputs the report should contain.
- `PDFExporter` needs LaTeX and the final pandoc call needs a PDF engine; its one recorded output is `PandocMissing`.

The cleaning notebook's method (documented here, not rerun, since the data is not in the repo):

- IQR capping clipped 429,848 Amount values (max 12,618,500 down to 22,930.62). In money-laundering data those large transactions may carry the signal, and the notebook never checks how many capped rows are laundering.
- Capping created 5 duplicate rows, which are reported but kept.
- Account IDs are analysed as numeric variables (skewness, Shapiro-Wilk), which is meaningless for identifiers.
- Pearson correlation is computed on label-encoded nominal columns, which measures the arbitrary code order; Cramér's V or mutual information would be valid. `Laundering_type` very likely encodes the label.
- Shapiro-Wilk rejects normality for all three variables, yet two are then called "approximately normal".
- The "core 12 attributes" cell ran on a dataframe without the time features, so it used 7 attributes.
- The markdown summary says 21 columns (12 + 9) and "removed duplicates"; the code printed 24 columns (12 + 12) and removed 0.
- Laundering rows are 0.104% of the data, yet there is no split, baseline or model.

## License

An earlier version of this README said MIT, but no LICENSE file has been added to the repo yet. Choosing and adding one is still open.
