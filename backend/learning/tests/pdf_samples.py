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
