"""
FROZEN - the first PDF converter, exactly as deployed in 6b95a0c. Never change it.

It is kept only to recognise notes it wrote: a lesson whose notes are still,
word for word, what this produces from the lesson's own PDF was never edited
by anybody, so `learning.authoring.rebuild_first_converter_notes` may replace
them with what the current converter (`learning.pdf_import`) makes. Changing
this file would make that recognition miss - or worse, match notes it should
not. Its original description follows.

Lesson notes from a PDF: the text of an uploaded file, rewritten as a lesson.

An administrator who uploads a PDF as a lesson gets the file attached and, when
the lesson has no notes yet, notes made from it - so learners read the lesson
in the app (numbered sections, lists, code, objectives) instead of only being
handed a download. The result is ordinary lesson text in the Markdown subset
`learning.content` reads, checked by the same parser, and the administrator
can edit it like any other lesson.

The PDF's own layout says what each line is:

- the body size is the size most of the text is set in; a line clearly larger,
  or a short bold line on its own, is a heading;
- a line opening with a bullet or a number is a list item, and the lines under
  it continue that item;
- a run of lines in a monospaced font is code, its indentation rebuilt from
  where each line starts;
- at the top or foot of a page, a bare page number, small print, and a line
  repeated on most pages (a running header or footer) are dropped;
- everything else is a paragraph, its lines joined and hyphenation undone.

A heading such as "Learning objectives" followed by a list becomes the lesson's
objectives. The summary is the first sentence of the first paragraph, and the reading
time is the word count at a steady pace.

A PDF that is only pictures of pages (a scan) has no text to read, and gives
nothing: the lesson keeps the file alone.
"""

import logging
import math
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from io import BytesIO
from statistics import median

from learning.content import ContentError, blocks_from

logger = logging.getLogger(__name__)

# A conversion runs inside the upload request: past this, the lesson keeps its file only.
TIME_BUDGET_SECONDS = 15
MIN_WORDS = 20
WORDS_PER_MINUTE = 180
SUMMARY_MAX_CHARS = 200
MAX_OBJECTIVES = 8

_MONOSPACE = ('courier', 'mono', 'consol', 'menlo', 'inconsolata', 'code', 'typewriter')
# A bullet glyph with no text mapping comes out as `(cid:N)`; at the start of a line it is a bullet.
_BULLET = re.compile(
    r'^(?:(?:[•●▪◦‣∙·○■□➢►✓✔\-\u2013\u2014*]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+|\(cid:\d+\)\s*)'
    r'(\S.*)$'
)
_UNMAPPED = re.compile(r'\(cid:\d+\)')
# The share of the page at its top and foot where running headers and footers sit.
_EDGE = 0.1
_PAGE_NUMBER = re.compile(r'^(?:page\s+)?\d{1,4}(?:\s*(?:/|of)\s*\d{1,4})?$', re.IGNORECASE)
_OBJECTIVES = re.compile(
    r'^(?:learning\s+)?(?:objectives|outcomes|goals)\b|in this (?:lesson|chapter|module)'
    r'|you will (?:learn|be able)|by the end of',
    re.IGNORECASE,
)
_PYTHON_HINT = re.compile(r'^\s*(?:def |class |import |from \S+ import |print\(|for |if |while )')


@dataclass(frozen=True)
class ImportedLesson:
    """A lesson's notes and details, as `authoring.LessonInput` takes them."""

    body: str
    summary: str
    objectives: list[str]
    estimated_minutes: int


@dataclass
class _Line:
    text: str
    size: float
    bold: bool
    mono: bool
    x0: float
    char_width: float
    page: int
    box: int
    edge: bool  # in the strip at the top or foot of the page


@dataclass
class _Block:
    kind: str  # heading | paragraph | list | code
    parts: list[str] = field(default_factory=list)
    language: str = ''


class _OutOfTime(Exception):
    pass


def lesson_from_pdf(data: bytes, *, title: str = '') -> ImportedLesson | None:
    """The lesson in `data`, a PDF's bytes; None when there is no readable text in it.

    Never raises: a damaged or unusual file is logged and gives None, so an
    upload never fails because its notes could not be made.
    """
    try:
        lines = _read_lines(data)
        return _lesson(lines, title)
    except _OutOfTime:
        logger.info('PDF notes skipped: the file took longer than %ss to read', TIME_BUDGET_SECONDS)
    except Exception:
        logger.warning('PDF notes skipped: the file could not be read', exc_info=True)
    return None


# --- reading -----------------------------------------------------------------------------


def _read_lines(data: bytes) -> list[_Line]:
    # Imported here: only an upload or the backfill command pays for loading pdfminer.
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LAParams, LTChar, LTTextContainer, LTTextLine

    started = time.monotonic()
    lines: list[_Line] = []
    box = 0
    for page_number, page in enumerate(extract_pages(BytesIO(data), laparams=LAParams())):
        if time.monotonic() - started > TIME_BUDGET_SECONDS:
            raise _OutOfTime
        for element in page:
            if not isinstance(element, LTTextContainer):
                continue
            box += 1
            for line in element:
                if not isinstance(line, LTTextLine):
                    continue
                chars = [char for char in line if isinstance(char, LTChar)]
                text = line.get_text().replace('\x00', '').rstrip()
                bullet = _BULLET.match(text.strip())
                if bullet and text.strip().startswith('(cid:'):
                    text = f'• {bullet.group(1)}'
                text = _UNMAPPED.sub('', text)
                if not chars or not text.strip():
                    continue
                fonts = [char.fontname.lower() for char in chars if char.get_text().strip()]
                if not fonts:
                    continue
                lines.append(
                    _Line(
                        text=text,
                        size=round(median(char.size for char in chars), 1),
                        bold=sum('bold' in f or 'black' in f or 'heavy' in f for f in fonts)
                        > len(fonts) / 2,
                        mono=sum(any(m in f for m in _MONOSPACE) for f in fonts) > len(fonts) / 2,
                        x0=line.x0,
                        char_width=median(char.width for char in chars) or 1.0,
                        page=page_number,
                        box=box,
                        edge=line.y1 > page.height * (1 - _EDGE) or line.y0 < page.height * _EDGE,
                    )
                )
    return lines


def _without_furniture(lines: list[_Line]) -> list[_Line]:
    """Drop page numbers, small print and repeated headers and footers at the page edges."""
    pages = len({line.page for line in lines})
    small = _body_size(lines) * 0.9

    def shape(line: _Line) -> str:
        return re.sub(r'\d+', '#', ' '.join(line.text.split()).lower())

    repeated = set()
    if pages >= 3:
        on_pages: dict[str, set[int]] = {}
        for line in lines:
            if line.edge:
                on_pages.setdefault(shape(line), set()).add(line.page)
        repeated = {text for text, seen in on_pages.items() if len(seen) >= max(3, pages / 2)}
    return [
        line
        for line in lines
        if not (
            line.edge
            and (
                _PAGE_NUMBER.match(line.text.strip())
                or line.size < small
                or shape(line) in repeated
            )
        )
    ]


# --- understanding -----------------------------------------------------------------------


def _body_size(lines: list[_Line]) -> float:
    weights: Counter[float] = Counter()
    for line in lines:
        if not line.mono:
            weights[line.size] += len(line.text)
    return weights.most_common(1)[0][0] if weights else 10.0


def _is_heading(line: _Line, body: float, alone: bool) -> bool:
    text = line.text.strip()
    words = len(text.split())
    if line.mono or not 1 <= words <= 14 or len(text) > 120 or text.endswith((',', ';')):
        return False
    if line.size >= body * 1.15:
        return True
    return line.bold and alone and words <= 10 and not text.endswith('.')


class _Builder:
    """Lines in, blocks out: each line extends the block before it or starts a new one."""

    def __init__(self, lines: list[_Line]):
        self.body = _body_size(lines)
        self.lines_in_box = Counter(line.box for line in lines)
        self.blocks: list[_Block] = []
        self.previous: _Line | None = None
        self.item_x0 = 0.0
        self.code_x0 = 0.0

    def _last(self, kind: str) -> _Block | None:
        """The last block, when it is of `kind`."""
        last = self.blocks[-1] if self.blocks else None
        return last if last is not None and last.kind == kind else None

    def _open(self, kind: str) -> _Block:
        block = self._last(kind)
        if block is None:
            block = _Block(kind)
            self.blocks.append(block)
        return block

    def add(self, line: _Line) -> None:
        text = ' '.join(line.text.split())
        same_box = self.previous is not None and self.previous.box == line.box
        self.previous = line
        if line.mono:
            self._add_code(line)
        elif _is_heading(line, self.body, alone=self.lines_in_box[line.box] <= 2):
            heading = self._last('heading') if same_box else None
            if heading is None:
                self.blocks.append(_Block('heading', [text]))
            else:
                heading.parts.append(text)
        elif bullet := _BULLET.match(text):
            self._open('list').parts.append(bullet.group(1))
            self.item_x0 = line.x0
        elif self._continues(line, same_box):
            self.blocks[-1].parts[-1] = _join(self.blocks[-1].parts[-1], text)
        else:
            self.blocks.append(_Block('paragraph', [text]))

    def _continues(self, line: _Line, same_box: bool) -> bool:
        """Whether a plain line carries on the paragraph, or the list item, above it."""
        if not same_box:
            return False
        if self._last('paragraph') is not None:
            return True
        return self._last('list') is not None and line.x0 > self.item_x0 + 2

    def _add_code(self, line: _Line) -> None:
        if self._last('code') is None:
            self.code_x0 = line.x0
        self.code_x0 = min(self.code_x0, line.x0)
        indent = max(0, round((line.x0 - self.code_x0) / line.char_width))
        self._open('code').parts.append((indent, line.text.strip()))  # type: ignore[arg-type]

    def finish(self) -> list[_Block]:
        for block in self.blocks:
            if block.kind == 'code':
                block.parts = _code_lines(block.parts)  # type: ignore[arg-type]
                python = any(_PYTHON_HINT.match(part) for part in block.parts)
                block.language = 'python' if python else 'code'
        return self.blocks


def _blocks(lines: list[_Line]) -> list[_Block]:
    builder = _Builder(lines)
    for line in lines:
        builder.add(line)
    return builder.finish()


def _join(text: str, more: str) -> str:
    """Two lines of one paragraph as one: a word broken by a hyphen is mended."""
    if re.search(r'\w-$', text) and more[:1].islower():
        return text[:-1] + more
    return f'{text} {more}'


def _code_lines(parts: list[tuple[int, str]]) -> list[str]:
    """Code lines with their indentation, in steps of four as the source most likely had."""
    steps = sorted({indent for indent, _ in parts if indent})
    step = steps[0] if steps else 4
    return [' ' * (4 * round(indent / step)) + text for indent, text in parts]


# --- writing -----------------------------------------------------------------------------


def _clean(text: str) -> str:
    """A line of prose that the lesson parser cannot mistake for markup."""
    text = text.strip()
    while text.startswith(('#', '>', '```')):
        text = text.lstrip('#>`').strip()
    return text


def _take_objectives(blocks: list[_Block]) -> list[str]:
    """An "objectives" heading and the list under it, out of `blocks` and into a list."""
    for index, block in enumerate(blocks[:-1]):
        if block.kind == 'heading' and _OBJECTIVES.search(' '.join(block.parts)):
            following = blocks[index + 1]
            if following.kind != 'list':
                return []
            del blocks[index : index + 2]
            return [_clean(item) for item in following.parts][:MAX_OBJECTIVES]
    return []


def _markup(block: _Block) -> str:
    """One block in the lesson's Markdown subset ('' for nothing worth keeping)."""
    if block.kind == 'heading':
        heading = _clean(' '.join(block.parts))
        return f'## {heading}' if heading else ''
    if block.kind == 'list':
        return '\n'.join(f'- {_clean(item)}' for item in block.parts if _clean(item))
    if block.kind == 'code':
        code = '\n'.join(part.replace('```', "'''") for part in block.parts)
        return f'```{block.language}\n{code}\n```'
    paragraph = _clean(block.parts[0])
    return paragraph.removeprefix('- ')


def _lesson(lines: list[_Line], title: str) -> ImportedLesson | None:
    blocks = _blocks(_without_furniture(lines))

    # The file's own title repeats the lesson's: the page shows it already.
    for index, block in enumerate(blocks[:3]):
        if block.kind == 'heading' and _same(' '.join(block.parts), title):
            del blocks[index]
            break
    objectives = _take_objectives(blocks)

    out = [text for text in map(_markup, blocks) if text.strip()]
    words = sum(len(text.split()) for text in out) + sum(len(o.split()) for o in objectives)
    if words < MIN_WORDS:
        return None
    body = '\n\n'.join(out)
    try:
        blocks_from(body)
    except ContentError:
        logger.warning('PDF notes skipped: the text did not make a valid lesson')
        return None
    first = next((block for block in blocks if block.kind == 'paragraph'), None)
    return ImportedLesson(
        body=body,
        summary=_summary(_markup(first)) if first else '',
        objectives=objectives,
        estimated_minutes=max(5, min(600, math.ceil(words / WORDS_PER_MINUTE))),
    )


def _same(one: str, other: str) -> bool:
    def norm(text: str) -> str:
        return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()

    return bool(other) and norm(one) == norm(other)


def _summary(paragraph: str) -> str:
    """A paragraph's first sentence - a line under the title, not a copy of the text below it."""
    sentence = re.split(r'(?<=[.!?])\s+', paragraph, maxsplit=1)[0]
    if len(sentence) <= SUMMARY_MAX_CHARS:
        return sentence
    return sentence[: SUMMARY_MAX_CHARS - 1].rsplit(' ', 1)[0] + '…'
