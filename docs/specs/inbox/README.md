# Drop `.docx` specs here

Put the Word file in this folder and tell me the filename. I convert it and work from the Markdown.

```bash
python3 scripts/docx-to-md.py docs/specs/inbox/*.docx
```

Keeps headings, bold and italic, bullets, numbering, and **tables as tables**. macOS `textutil` is
already installed and is not good enough: it flattens a table into one cell per line, so a row like
`Balance | Red when > 0 | BLOCKER` becomes three orphaned lines and you can no longer tell which rule
belongs to which field. Specs are mostly tables, and a requirement read against the wrong column is
worse than one that was never read at all.

Both files stay: the `.docx` is the record of what was actually sent, the `.md` is what gets read and
quoted in commits.
