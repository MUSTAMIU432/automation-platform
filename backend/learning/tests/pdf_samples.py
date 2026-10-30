"""PDFs built for the tests, laid out the way real lesson notes are."""

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

LOREM = (
    'Python is a general-purpose programming language that is easy to read and '
    'beginner-friendly. It is used in web development, automation, data science '
    'and artificial intelligence, which makes it a strong first language to learn.'
)


def _wrap(text: str, width: int = 80) -> list[str]:
    lines, line = [], ''
    for word in text.split():
        if len(line) + len(word) + 1 > width:
            lines.append(line)
            line = word
        else:
            line = f'{line} {word}'.strip()
    return [*lines, line] if line else lines


def lesson_pdf(pages: int = 3) -> bytes:
    """A titled lesson: objectives, sections, a list, code, a running header and page numbers."""
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    def furniture(page: int) -> None:
        pdf.setFont('Helvetica', 8)
        pdf.drawString(60, height - 30, 'Python Programming - Course notes')
        pdf.drawString(width / 2, 30, str(page))

    for page in range(1, pages + 1):
        furniture(page)
        y = height - 80
        if page == 1:
            pdf.setFont('Helvetica-Bold', 20)
            pdf.drawString(60, y, 'What Python is')
            y -= 40
            pdf.setFont('Helvetica-Bold', 14)
            pdf.drawString(60, y, 'Learning objectives')
            y -= 22
            pdf.setFont('Helvetica', 11)
            for item in ('Describe what Python is', 'Install Python and check the version'):
                pdf.drawString(70, y, f'• {item}')
                y -= 16
            y -= 14
        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(60, y, f'Section {page}: Why Python matters')
        y -= 24
        pdf.setFont('Helvetica', 11)
        text = pdf.beginText(60, y)
        for line in _wrap(LOREM):
            text.textLine(line)
        pdf.drawText(text)
        y -= 16 * len(_wrap(LOREM)) + 16
        pdf.drawString(70, y, '• Web backends with Django')
        y -= 16
        pdf.drawString(70, y, '• Automation scripts')
        y -= 30
        pdf.setFont('Courier', 10)
        for indent, code in (
            (0, 'def greet(name):'),
            (4, 'print("Hello", name)'),
            (0, 'greet("Ada")'),
        ):
            pdf.drawString(60 + indent * 6, y, code)
            y -= 14
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def blank_pdf() -> bytes:
    """A page with no text at all - what a scanned document gives a text reader."""
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.rect(50, 50, 200, 200, fill=1)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


class _Guide:
    """Draws a course guide page by page, top to bottom, the way a word processor sets it."""

    def __init__(self):
        self.buffer = BytesIO()
        self.pdf = canvas.Canvas(self.buffer, pagesize=A4)
        self.y = 780.0

    def page(self, number: int) -> None:
        self.pdf.setFont('Helvetica', 8)
        self.pdf.drawString(51, 27, 'Python Programming - Beginner Student Guide')
        self.pdf.drawString(519, 27, f'Page {number}')
        self.y = 780.0

    def heading(self, text: str, size: float) -> None:
        self.pdf.setFont('Helvetica-Bold', size)
        self.pdf.drawString(57, self.y, text)
        self.y -= size + 10

    def paragraph(self, text: str) -> None:
        self.pdf.setFont('Helvetica', 9)
        block = self.pdf.beginText(57, self.y)
        for line in _wrap(text, 100):
            block.textLine(line)
        self.pdf.drawText(block)
        self.y -= 12 * len(_wrap(text, 100)) + 8

    def bullets(self, items: list[str]) -> None:
        self.pdf.setFont('Helvetica', 9)
        for item in items:
            self.pdf.drawString(57, self.y, f'• {item}')
            self.y -= 18
        self.y -= 6

    def code(self, lines: list[str]) -> None:
        self.pdf.setFont('Courier', 7.7)
        block = self.pdf.beginText(64, self.y)
        for line in lines:
            block.textLine(line)
        self.pdf.drawText(block)
        self.y -= 10 * len(lines) + 10

    def table(self, header: list[str], rows: list[list[str]]) -> None:
        columns = (81, 121, 325)
        self.pdf.setFont('Helvetica-Bold', 8)
        for x, text in zip(columns, header, strict=True):
            self.pdf.drawString(x, self.y, text)
        self.pdf.setFont('Helvetica', 10)
        for row in rows:
            self.y -= 24
            for x, text in zip(columns, row, strict=True):
                self.pdf.drawString(x, self.y, text)
        self.y -= 24

    def done(self) -> bytes:
        self.pdf.showPage()
        self.pdf.save()
        return self.buffer.getvalue()


def course_guide_pdf() -> bytes:
    """A whole course in one PDF, laid out like a real guide: a cover, then weeks of lessons.

    Cover page (title, subtitle, "Label: value" facts); "1. Course Overview" and
    "WEEK n - ..." headings at 16pt over "Lesson n.n: ..." at 11.5pt; 9pt text,
    bullets, Courier code, a schedule table, and a footer with page numbers.
    """
    guide = _Guide()
    pdf = guide.pdf
    middle = A4[0] / 2
    # The cover: no body text at all.
    pdf.setFont('Helvetica-Bold', 25)
    pdf.drawCentredString(middle, 700, 'PYTHON PROGRAMMING')
    pdf.setFont('Helvetica', 11)
    for y, line in (
        (663, 'Beginner Course Breakdown & Student Learning Guide'),
        (616, 'Course level: Absolute beginner'),
        (589, 'Estimated duration: 8 weeks'),
        (480, 'A practical foundation for future Python, Django backend development, AI and'),
        (463, 'machine learning.'),
    ):
        pdf.drawCentredString(middle, y, line)
    pdf.showPage()

    guide.page(2)
    guide.heading('1. Course Overview', 16)
    guide.paragraph(LOREM)
    guide.heading('2. Course Schedule', 16)
    guide.table(
        ['Week', 'Main topic', 'Practical outcome'],
        [
            ['1', 'Introduction and output', 'First Python programs'],
            ['2', 'Variables and operators', 'Calculator'],
        ],
    )
    pdf.showPage()

    for week, name in ((1, 'INTRODUCTION TO PROGRAMMING'), (2, 'OBJECT-ORIENTED PROGRAMMING')):
        guide.page(week + 2)
        guide.heading(f'WEEK {week} - {name}', 16)
        guide.heading(f'Lesson {week}.1: The first idea', 11.5)
        guide.paragraph(LOREM)
        guide.bullets(['Program: instructions a computer executes.', 'Bug: an error.'])
        guide.heading(f'Lesson {week}.2: Running code', 11.5)
        guide.paragraph('Check your installation:')
        guide.code(['python3 --version'])
        guide.paragraph('Python uses indentation to define blocks of code:')
        guide.code(['if 5 > 2:', '    print("Five is greater than two")'])
        if week < 2:
            pdf.showPage()
    return guide.done()
