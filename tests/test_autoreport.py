"""Smoke test: the committed cleaning notebook converts to a non-empty HTML report with its outputs."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from autoreport import build_report, main  # noqa: E402

NB = ROOT / "assignment2DataCleaning_final_original.ipynb"


def test_report_keeps_cells_and_outputs():
    html, nb = build_report(NB)
    assert len(nb.cells) == 35
    assert len(html) > 100_000
    assert len(re.findall(r'<img[^>]+src="data:image/png', html)) == 17  # every recorded figure survives
    assert "Dataset shape: (9504852, 12)" in html  # recorded text output survives
    assert "quick_numeric_summary" in html  # code is included by default


def test_no_code_hides_inputs():
    html, _ = build_report(NB, exclude_code=True)
    assert "quick_numeric_summary" not in html
    assert "Dataset shape: (9504852, 12)" in html


def test_cli_writes_file(tmp_path):
    out = tmp_path / "report.html"
    main([str(NB), "-o", str(out)])
    assert out.stat().st_size > 100_000
