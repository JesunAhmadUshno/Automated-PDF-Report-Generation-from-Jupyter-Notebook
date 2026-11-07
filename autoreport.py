"""AutoReport: turn a Jupyter notebook into a self-contained HTML report, and optionally a PDF.

This is the runnable version of the idea in AutoReport.ipynb (kept unchanged as the original).
Differences from the notebook: the input path is an argument, outputs are kept (the notebook's
ClearOutputPreprocessor would have removed them), no template.html is needed, and no LaTeX or
pandoc is required. For a PDF, open the HTML in a browser and print, or pass --pdf, which uses
nbconvert's WebPDF exporter (needs `pip install "nbconvert[webpdf]"` and a Chromium download).

Usage:
    python autoreport.py notebook.ipynb [-o report.html] [--no-code] [--no-outputs] [--pdf]
"""
import argparse
import pathlib
import sys

import nbformat
from nbconvert import HTMLExporter


def build_report(path, exclude_code=False, exclude_outputs=False):
    """Return (html, notebook) for the notebook at path."""
    nb = nbformat.read(str(path), as_version=4)
    exporter = HTMLExporter(exclude_input=exclude_code, exclude_output=exclude_outputs)
    html, _ = exporter.from_notebook_node(nb)
    return html, nb


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("notebook", type=pathlib.Path)
    ap.add_argument("-o", "--output", type=pathlib.Path, help="output path (default: <notebook>.html)")
    ap.add_argument("--no-code", action="store_true", help="hide code cell inputs")
    ap.add_argument("--no-outputs", action="store_true", help="hide cell outputs")
    ap.add_argument("--pdf", action="store_true", help="also write a PDF via nbconvert's WebPDF exporter")
    args = ap.parse_args(argv)

    html, nb = build_report(args.notebook, args.no_code, args.no_outputs)
    out = args.output or args.notebook.with_suffix(".html")
    out.write_text(html, encoding="utf-8")
    print(f"{args.notebook}: {len(nb.cells)} cells -> {out}")

    if args.pdf:
        try:
            from nbconvert import WebPDFExporter
            pdf, _ = WebPDFExporter(exclude_input=args.no_code, exclude_output=args.no_outputs).from_notebook_node(nb)
        except Exception as e:  # missing playwright/chromium is the usual cause
            sys.exit(f"PDF export failed ({e}). Open {out} in a browser and print to PDF instead.")
        pdf_out = out.with_suffix(".pdf")
        pdf_out.write_bytes(pdf)
        print(f"PDF -> {pdf_out}")


if __name__ == "__main__":
    main()
