"""
Lesson notes from a PDF: the text of an uploaded file, rewritten as lessons.

An administrator who uploads a PDF as a lesson gets the file attached and, when
the lesson has no notes yet, notes made from it - so learners read the course
in the app (lessons in the outline, numbered sections, lists, code) instead of
only being handed a download. The result is ordinary lesson text in the
Markdown subset `learning.content` reads, checked by the same parser, and the
administrator can edit it like any other lesson.

The PDF's own layout says what each line is:

- the body size is the size most of the text is set in. Lines clearly larger
  are headings, and a short bold line on its own is one too. When there are two
  levels of them - a course guide's "WEEK 1 - ..." over its "Lesson 1.1: ..." -
  the top level (the largest size used more than once) starts a new lesson and
  the rest are sections within it. With one level, they are all sections of a
  single lesson;
- a first page with no body text is a cover: its biggest line (the document's
  title) is left out, and the rest becomes the opening, "Label: value" lines
  as a list;
- a line opening with a bullet or a number is a list item, and the lines under
  it continue that item;
- a run of lines in a monospaced font is code, its indentation kept, marked as
  Python or as shell commands when it reads like either;
- short lines set in columns away from the text margin are a table, rebuilt
  row by row (a header row in bold, then one list item per row);
- at the very top or foot of a page, a bare page number, small print, and a
  line repeated on most pages (a running header or footer) are dropped;
- everything else is a paragraph, its lines joined and hyphenation undone.

A section heading such as "Learning objectives" followed by a list becomes the
lesson's objectives. Each lesson's summary is the first sentence of its first
paragraph, and its reading time the word count at a steady pace.

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
TITLE_MAX_CHARS = 200

_MONOSPACE = ('courier', 'mono', 'consol', 'menlo', 'inconsolata', 'code', 'typewriter')
# A bullet glyph with no text mapping comes out as `(cid:N)`; at the start of a line it is a bullet.
_BULLET = re.compile(
    r'^(?:(?:[•●▪◦‣∙·○■□➢►✓✔\-\u2013\u2014*]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+|\(cid:\d+\)\s*)'
    r'(\S.*)$'
)
_UNMAPPED = re.compile(r'\(cid:\d+\)')
# The share of the page at its very top and foot where running headers and footers sit.
_EDGE = 0.06
_PAGE_NUMBER = re.compile(r'^(?:page\s+)?\d{1,4}(?:\s*(?:/|of)\s*\d{1,4})?$', re.IGNORECASE)
_OBJECTIVES = re.compile(
    r'^(?:learning\s+)?(?:objectives|outcomes|goals)\b|in this (?:lesson|chapter|module)'
    r'|you will (?:learn|be able)|by the end of',
    re.IGNORECASE,
)
_PYTHON_HINT = re.compile(r'^\s*(?:def |class |import |from \S+ import |print\(|for |if |while )')
_SHELL_HINT = re.compile(r'^\s*(?:\$ |python3? |pip3? |cd |ls|git |mkdir |source |npm )')
_NUMBERED_TITLE = re.compile(r'^\d{1,2}[.)]\s+')
_SMALL_WORDS = {
    'a',
    'an',
    'and',
    'as',
    'at',
    'by',
    'for',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'with',
}


@dataclass(frozen=True)
class ImportedLesson:
    """One lesson's notes and details, as `authoring.LessonInput` takes them.

    `title` is '' for the first lesson: it is the one the file was uploaded to,
    and keeps the title the administrator gave it.
    """

    title: str
    body: str
    summary: str
    objectives: list[str]
    estimated_minutes: int


@dataclass
class _Line:
    text: str  # as read, leading spaces kept (they are code's indentation)
    size: float
    bold: bool
    mono: bool
    x0: float
    top: float
    char_width: float
    page: int
    box: int
    edge: bool  # at the very top or foot of the page

    @property
    def words(self) -> str:
        return ' '.join(self.text.split())


@dataclass
class _Table:
    header: list[str]
    rows: list[list[str]]


@dataclass
class _Block:
    kind: str  # heading | paragraph | list | code | table
    parts: list = field(default_factory=list)
    level: int = 2  # a heading's: 1 starts a lesson, 2 is a section in it
    language: str = ''


class _OutOfTime(Exception):
    pass


def lessons_from_pdf(data: bytes, *, title: str = '') -> list[ImportedLesson]:
    """The lessons in `data`, a PDF's bytes; [] when there is no readable text in it.

    Never raises: a damaged or unusual file is logged and gives [], so an upload
    never fails because its notes could not be made.
    """
    try:
        return _lessons(_read_lines(data), title)
    except _OutOfTime:
        logger.info('PDF notes skipped: the file took longer than %ss to read', TIME_BUDGET_SECONDS)
    except Exception:
        logger.warning('PDF notes skipped: the file could not be read', exc_info=True)
    return []


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
        edge = page.height * _EDGE
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
                fonts = [char.fontname.lower() for char in chars if char.get_text().strip()]
                if not fonts or not text.strip():
                    continue
                lines.append(
                    _Line(
                        text=text,
                        size=round(median(char.size for char in chars), 1),
                        bold=sum('bold' in f or 'black' in f or 'heavy' in f for f in fonts)
                        > len(fonts) / 2,
                        mono=sum(any(m in f for m in _MONOSPACE) for f in fonts) > len(fonts) / 2,
                        x0=line.x0,
                        top=line.y1,
                        char_width=median(char.width for char in chars) or 1.0,
                        page=page_number,
                        box=box,
                        edge=line.y1 > page.height - edge or line.y0 < edge,
                    )
                )
    return lines


def _body_size(lines: list[_Line]) -> float:
    weights: Counter[float] = Counter()
    for line in lines:
        if not line.mono:
            weights[line.size] += len(line.words)
    return weights.most_common(1)[0][0] if weights else 10.0


def _without_furniture(lines: list[_Line]) -> list[_Line]:
    """Drop page numbers, small print and repeated headers and footers at the page edges."""
    pages = len({line.page for line in lines})
    small = _body_size(lines) * 0.9

    def shape(line: _Line) -> str:
        return re.sub(r'\d+', '#', line.words.lower())

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
            and (_PAGE_NUMBER.match(line.words) or line.size < small or shape(line) in repeated)
        )
    ]


# --- the cover -----------------------------------------------------------------------------


def _split_cover(lines: list[_Line], body: float) -> tuple[list[_Block], list[_Line]]:
    """A first page with no body text, as opening blocks, and the lines after it."""
    first = [line for line in lines if line.page == 0]
    rest = [line for line in lines if line.page != 0]
    if not first or not rest or any(_body_like(line, body) for line in first):
        return [], lines

    title_size = max(line.size for line in first)
    joined: list[_Line] = []
    for line in first:
        if line.size == title_size:
            continue  # the document's title: the lesson has its own
        previous = joined[-1] if joined else None
        if (
            previous is not None
            and previous.size == line.size
            and not previous.words.endswith(('.', '!', '?', ':'))
            and line.words[:1].islower()
        ):
            previous.text = _join(previous.words, line.words)
        else:
            joined.append(_Line(**{**line.__dict__}))

    blocks: list[_Block] = []
    for line in joined:
        text = line.words
        is_fact = re.match(r'^[^:]{2,40}:\s+\S', text) is not None
        if is_fact and blocks and blocks[-1].kind == 'list':
            blocks[-1].parts.append(text)
        else:
            blocks.append(_Block('list' if is_fact else 'paragraph', [text]))
    return blocks, rest


def _body_like(line: _Line, body: float) -> bool:
    return not line.mono and abs(line.size - body) < 0.6


# --- tables ------------------------------------------------------------------------------


def _with_tables(lines: list[_Line], margin: float) -> list:
    """`lines`, with each run of table cells replaced by the `_Table` it makes."""
    lines_in_box = Counter(line.box for line in lines)

    def is_cell(line: _Line) -> bool:
        return (
            not line.mono
            and line.x0 > margin + 12
            and lines_in_box[line.box] == 1
            and not _BULLET.match(line.words)
        )

    out: list = []
    run: list[_Line] = []

    def flush() -> None:
        table = _table(run)
        if table is None:
            out.extend(run)
        else:
            out.append(table)
        run.clear()

    for line in lines:
        if is_cell(line) and (not run or run[-1].page == line.page):
            run.append(line)
            continue
        if run:
            flush()
        if is_cell(line):
            run.append(line)
        else:
            out.append(line)
    if run:
        flush()
    return out


def _table(cells: list[_Line]) -> _Table | None:
    """Cells laid out in rows and columns, or None when they are not a table."""
    if len(cells) < 4:
        return None
    rows: list[list[_Line]] = []
    for cell in sorted(cells, key=lambda c: -c.top):
        if rows and abs(rows[-1][0].top - cell.top) <= 3:
            rows[-1].append(cell)
        else:
            rows.append([cell])
    if sum(len(row) >= 2 for row in rows) < 2:
        return None
    texts = [[cell.words for cell in sorted(row, key=lambda c: c.x0)] for row in rows]
    header: list[str] = []
    if all(cell.bold for cell in rows[0]) and not all(c.bold for row in rows[1:] for c in row):
        header = texts.pop(0)
    return _Table(header=header, rows=texts)


# --- headings and blocks -------------------------------------------------------------------


def _heading_level(line: _Line, body: float, top_size: float | None, alone: bool) -> int:
    """1 for a heading that starts a lesson, 2 for a section, 0 for no heading."""
    text = line.words
    words = len(text.split())
    if line.mono or not 1 <= words <= 14 or len(text) > 120 or text.endswith((',', ';')):
        return 0
    if line.size >= body * 1.15:
        return 1 if top_size is not None and line.size >= top_size else 2
    return 2 if line.bold and alone and words <= 10 and not text.endswith('.') else 0


def _top_heading_size(lines: list[_Line], body: float) -> float | None:
    """The size of the headings that start lessons, when headings come in two levels.

    The top level is the largest size used more than once; it only starts lessons
    when there is a level under it - another repeated size, or bold run-in
    headings - so a lesson with plain sections is not cut into one per section.
    """
    boxes_by_size: dict[float, set[int]] = {}
    for line in lines:
        if not line.mono and line.size >= body * 1.15 and len(line.words.split()) <= 14:
            boxes_by_size.setdefault(line.size, set()).add(line.box)
    repeated = sorted((s for s, boxes in boxes_by_size.items() if len(boxes) >= 2), reverse=True)
    lines_in_box = Counter(line.box for line in lines)
    bold_sections = sum(
        _heading_level(line, body, None, lines_in_box[line.box] <= 2) == 2
        and line.size < body * 1.15
        for line in lines
    )
    if len(repeated) >= 2 or (repeated and bold_sections >= 2):
        return repeated[0]
    return None


class _Builder:
    """Lines in, blocks out: each line extends the block before it or starts a new one."""

    def __init__(self, lines: list[_Line], body: float):
        self.body = body
        self.top_size = _top_heading_size(lines, body)
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

    def add(self, item) -> None:
        if isinstance(item, _Table):
            self.blocks.append(_Block('table', [item]))
            self.previous = None
            return
        line: _Line = item
        text = line.words
        same_box = self.previous is not None and self.previous.box == line.box
        self.previous = line
        level = _heading_level(line, self.body, self.top_size, self.lines_in_box[line.box] <= 2)
        if line.mono:
            self._add_code(line)
        elif level:
            heading = self._last('heading') if same_box else None
            if heading is None or heading.level != level:
                self.blocks.append(_Block('heading', [text], level=level))
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
        stripped = line.text.lstrip(' ')
        spaces = len(line.text) - len(stripped)
        indent = spaces + max(0, round((line.x0 - self.code_x0) / line.char_width))
        self._open('code').parts.append((indent, stripped.rstrip()))

    def finish(self) -> list[_Block]:
        for block in self.blocks:
            if block.kind == 'code':
                block.parts = _code_lines(block.parts)
                if any(_PYTHON_HINT.match(part) for part in block.parts):
                    block.language = 'python'
                elif all(_SHELL_HINT.match(part) for part in block.parts if part.strip()):
                    block.language = 'bash'
                else:
                    block.language = 'code'
        return self.blocks


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


def _title(text: str) -> str:
    """A heading as a lesson title: no leading "1.", and no shouting."""
    text = _NUMBERED_TITLE.sub('', _clean(text))
    words = text.split()
    letters = [w.replace('-', '') for w in words]
    shouting = bool(words) and all(not w.isalpha() or w.isupper() for w in letters)

    def calm(index: int, word: str) -> str:
        bare = word.replace('-', '')
        if not bare.isalpha() or not bare.isupper() or not (shouting or len(bare) > 3):
            return word
        if index and word.lower() in _SMALL_WORDS:
            return word.lower()
        return '-'.join(part.capitalize() for part in word.split('-'))

    return ' '.join(calm(i, w) for i, w in enumerate(words))[:TITLE_MAX_CHARS]


def _take_objectives(blocks: list[_Block]) -> list[str]:
    """An "objectives" section and the list under it, out of `blocks` and into a list."""
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
    if block.kind == 'table':
        table: _Table = block.parts[0]
        out = [f'**{" · ".join(_clean(cell) for cell in table.header)}**'] if table.header else []
        rows = [
            f'- **{_clean(row[0])}** · ' + ' · '.join(_clean(cell) for cell in row[1:])
            if len(row) > 1
            else f'- {_clean(row[0])}'
            for row in table.rows
        ]
        return '\n\n'.join([*out, '\n'.join(rows)])
    return _clean(block.parts[0]).removeprefix('- ')


def _sections(blocks: list[_Block]) -> list[tuple[str, list[_Block]]]:
    """The blocks cut at each lesson-starting heading: (its title, the blocks under it)."""
    sections: list[tuple[str, list[_Block]]] = [('', [])]
    for block in blocks:
        if block.kind == 'heading' and block.level == 1:
            sections.append((' '.join(block.parts), []))
        else:
            sections[-1][1].append(block)
    return [(title, body) for title, body in sections if title or body]


def _lesson(title: str, blocks: list[_Block]) -> ImportedLesson | None:
    objectives = _take_objectives(blocks)
    out = [text for text in map(_markup, blocks) if text.strip()]
    if not out and not objectives:
        return None
    body = '\n\n'.join(out)
    blocks_from(body)  # a ContentError here is the caller's to handle
    words = sum(len(text.split()) for text in out) + sum(len(o.split()) for o in objectives)
    first = next((block for block in blocks if block.kind == 'paragraph'), None)
    return ImportedLesson(
        title=title,
        body=body,
        summary=_summary(_markup(first)) if first else '',
        objectives=objectives,
        estimated_minutes=max(5, min(600, math.ceil(words / WORDS_PER_MINUTE))),
    )


def _lessons(lines: list[_Line], title: str) -> list[ImportedLesson]:
    lines = _without_furniture(lines)
    if not lines:
        return []
    body = _body_size(lines)
    opening, lines = _split_cover(lines, body)
    margins = Counter(round(line.x0) for line in lines if _body_like(line, body))
    margin = margins.most_common(1)[0][0] if margins else 0
    builder = _Builder(lines, body)
    for item in _with_tables(lines, margin):
        builder.add(item)
    blocks = opening + builder.finish()

    # The file's own title repeats the lesson's: the page shows it already.
    for index, block in enumerate(blocks[:3]):
        if block.kind == 'heading' and _same(' '.join(block.parts), title):
            del blocks[index]
            break

    sections = _sections(blocks)
    if sections and sections[0][0]:
        # No opening before the first lesson heading: the uploaded-to lesson starts with it.
        first_title, first_blocks = sections[0]
        sections[0] = ('', [_Block('heading', [first_title]), *first_blocks])
    words = sum(len(_markup(b).split()) for _, section in sections for b in section)
    if words < MIN_WORDS:
        return []
    try:
        lessons = [_lesson(_title(name) if name else '', section) for name, section in sections]
    except ContentError:
        logger.warning('PDF notes skipped: the text did not make a valid lesson')
        return []
    return [lesson for lesson in lessons if lesson is not None]


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
