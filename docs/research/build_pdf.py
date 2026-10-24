"""
Build research_concept_note_automation_platform.pdf from its HTML source.

Renders the HTML with headless Google Chrome, finds the page each heading landed on
(via poppler's pdftotext), writes those numbers into the table of contents in the HTML
source, and renders again. Run from anywhere:

    python3 docs/research/build_pdf.py
    python3 docs/research/build_pdf.py docs/research/research_concept_note_short.html

Needs `google-chrome` and `pdftotext` on PATH. Touches nothing outside docs/research.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'research_concept_note_automation_platform.html'
TARGET = HERE / 'research_concept_note_automation_platform.pdf'
PG = re.compile(r'(<span class="pg" data-for="([^"]+)">)(\d*)(</span>)')


def render(html: Path, pdf: Path, profile: str) -> None:
    # Headless Chrome sometimes aborts while shutting down after the PDF is written, so the
    # file, not the exit code, is what says whether rendering worked.
    pdf.unlink(missing_ok=True)
    result = subprocess.run(
        [
            'google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox',
            f'--user-data-dir={profile}', '--no-pdf-header-footer',
            f'--print-to-pdf={pdf}', html.as_uri(),
        ],
        capture_output=True, text=True,
        # Chrome puts a Unix socket under TMPDIR, whose path has a short length limit.
        env={k: v for k, v in os.environ.items() if k != 'TMPDIR'},
    )
    if not pdf.exists() or pdf.stat().st_size == 0:
        sys.exit(f'Chrome did not produce a PDF:\n{result.stderr[-2000:]}')


def page_texts(pdf: Path) -> list[str]:
    text = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], check=True,
                          capture_output=True, text=True).stdout
    return text.split('\f')


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def heading_pages(pdf: Path, titles: list[str]) -> dict[str, int]:
    pages = page_texts(pdf)
    toc = next(i for i, p in enumerate(pages) if any(norm(l) == 'Contents' for l in p.splitlines()))
    found = {}
    for title in titles:
        want = norm(title)[:40]
        for i, page in enumerate(pages):
            if i == toc:
                continue
            if any(norm(line).startswith(want) for line in page.splitlines()):
                found[title] = i + 1
                break
        else:
            sys.exit(f'Heading not found in PDF: {title!r}')
    return found


def main() -> None:
    # An optional argument names another HTML source; its PDF is written beside it.
    source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else SOURCE
    target = source.with_suffix('.pdf')
    html = source.read_text(encoding='utf-8')
    titles = [m.group(2) for m in PG.finditer(html)]
    with tempfile.TemporaryDirectory() as tmp:
        draft = Path(tmp) / 'draft.pdf'
        for attempt in range(3):
            render(source, draft, tmp + '/profile')
            pages = heading_pages(draft, titles) if titles else {}
            updated = PG.sub(lambda m: f'{m.group(1)}{pages[m.group(2)]}{m.group(4)}', html)
            if updated == html:
                break
            html = updated
            source.write_text(html, encoding='utf-8')
        else:
            sys.exit('Table of contents did not settle after three passes.')
        shutil.copyfile(draft, target)
    print(f'Wrote {target}')
    for title, page in pages.items():
        print(f'  p.{page:>3}  {title}')


if __name__ == '__main__':
    main()
