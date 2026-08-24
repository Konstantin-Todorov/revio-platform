#!/usr/bin/env python3
"""
Convert a .docx spec to Markdown, keeping the structure that carries meaning.

macOS `textutil` is already installed and is not good enough here: it flattens a table into one cell
per line, so "Balance | Red when > 0 | BLOCKER" becomes three orphaned lines and you can no longer
tell which rule belongs to which field. Specs are mostly tables, and a requirement read against the
wrong column is worse than one that was never read.

Kept: heading levels, bold and italic, bullets and numbering, tables, and the reading order of the
document (a table between two paragraphs stays between them, which `python-docx`'s own iterators do
not give you for free).

    python3 scripts/docx-to-md.py <file.docx> [more.docx ...]

Writes <file>.md beside each input and prints a summary.
"""
import sys, pathlib
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn


def body_items(doc):
    """Paragraphs and tables in true document order."""
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, doc)
        elif child.tag == qn("w:tbl"):
            yield Table(child, doc)


def runs_to_md(para):
    out = []
    for run in para.runs:
        t = run.text
        if not t:
            continue
        # Escape only what would otherwise become accidental Markdown.
        t = t.replace("\\", "\\\\")
        if run.bold and run.italic:
            t = f"***{t.strip()}***" if t.strip() else t
        elif run.bold:
            t = f"**{t.strip()}**" if t.strip() else t
        elif run.italic:
            t = f"*{t.strip()}*" if t.strip() else t
        out.append(t)
    return "".join(out).strip()


def para_to_md(para):
    text = runs_to_md(para)
    if not text:
        return ""
    style = (para.style.name or "").lower()
    if style.startswith("heading"):
        try:
            level = int(style.split()[-1])
        except ValueError:
            level = 1
        return f"{'#' * min(level, 6)} {text}"
    if style == "title":
        return f"# {text}"
    if "list bullet" in style:
        return f"- {text}"
    if "list number" in style:
        return f"1. {text}"
    if "quote" in style:
        return f"> {text}"
    return text


def table_to_md(table):
    rows = [[" ".join(c.text.split()) or " " for c in r.cells] for r in table.rows]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [" "] * (width - len(r)) for r in rows]
    # Assume the first row is a header — Word tables in specs almost always are, and a table with no
    # header renders fine anyway.
    head, *body = rows
    out = ["| " + " | ".join(head) + " |", "| " + " | ".join(["---"] * width) + " |"]
    out += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(out)


def convert(path: pathlib.Path) -> pathlib.Path:
    doc = Document(str(path))
    chunks, tables, headings = [], 0, 0
    for item in body_items(doc):
        if isinstance(item, Paragraph):
            md = para_to_md(item)
            if md:
                if md.startswith("#"):
                    headings += 1
                chunks.append(md)
        else:
            chunks.append(table_to_md(item))
            tables += 1

    out = path.with_suffix(".md")
    out.write_text("\n\n".join(chunks) + "\n", encoding="utf-8")
    print(f"  {path.name} → {out.name}  ({headings} headings, {tables} tables, {len(chunks)} blocks)")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for arg in sys.argv[1:]:
        p = pathlib.Path(arg).expanduser()
        if not p.exists():
            print(f"  MISSING: {p}")
            continue
        convert(p)
