# miku-md2xlsx

`miku-md2xlsx` converts Markdown files into practical Excel `.xlsx` workbooks.

It is a local tool. Your Markdown file is processed on your machine and is not
uploaded to a server.

This project is not a complete inverse converter for `miku-xlsx2md`. The goal
is to make Markdown information structure easy to review, distribute, and edit
in Excel, not to recreate pixel-perfect workbook layout.

## What It Converts

Initial supported Markdown features include:

- headings
- paragraphs
- bullet and numbered lists
- Markdown tables
- fenced and indented code blocks
- horizontal rules
- Markdown links
- common inline styles: bold, italic, strikethrough, underline via `<ins>`,
  and `<br>` line breaks inside cells
- local PNG, JPEG, and GIF images referenced from Markdown

Local images are embedded on a best-effort basis when Markdown image URLs point
to relative files next to the input Markdown file, such as
`![chart](assets/chart.png)`. The Markdown image reference is also kept as
workbook text so the original semantic reference remains visible. Remote URLs,
absolute paths, and missing local files are left as text references.

Markdown table cell values are written as strings. Numeric-looking, date-like,
currency-like, and percentage-like text is not inferred or converted into Excel
number/date cells, so values such as `0010`, `3月13日`, and `98.7%` remain the
text written in Markdown.

`miku-xlsx2md` merge markers in table cells are converted into Excel merged
cell ranges. `[←M←]` extends a merge to the left, and `[↑M↑]` extends a merge
upward.

Markdown links are converted into Excel hyperlinks when a cell contains a single
link. External links such as `[Open example](https://example.com/)` become
external hyperlinks. `miku-xlsx2md`-style internal links such as
`[Jump to Other](#other) (Other!A1)` become workbook hyperlinks to the generated
sheet/cell target.

Common inline Markdown styles are written as Excel rich text runs. `**bold**`,
`*italic*`, `~~strike~~`, `<ins>underline</ins>`, and `<br>` are converted to
cell formatting and cell-internal line breaks.

Known limitations:

- original Excel cell addresses, column widths, row heights, and detailed
  styles are not reconstructed
- formulas, charts, drawings, SmartArt, and conditional formatting are not
  generated
- image anchor positions, sizes, and drawing geometry are not restored exactly

## CLI Use

Install dependencies once:

```bash
npm install
```

Convert a Markdown file:

```bash
npm run cli -- ./sample.md --out ./sample.xlsx
```

Split sheets by top-level headings:

```bash
npm run cli -- ./sample.md --out ./sample.xlsx --sheet-mode heading
```

Split sheets by second-level headings, which is useful for Markdown generated
by `miku-xlsx2md` where `#` is the book title and `##` is the sheet heading:

```bash
npm run cli -- ./sample.md --out ./sample.xlsx --sheet-mode heading --sheet-heading-depth 2
```

Show help or version:

```bash
npm run cli -- --help
npm run cli -- --version
```

Build and smoke-test the single-file CLI bundle:

```bash
npm run build:bundle
npm run smoke:bundle
```

## Current Status

This repository is in first-cut development. The current vertical slice creates
`.xlsx` files from Markdown tables, basic document blocks, and local image
references. See [TODO.md](./TODO.md) for follow-up work.

Developer handoff notes are in [docs/handoff-from-xlsx2md.md](./docs/handoff-from-xlsx2md.md).
Shared miku-soft reference information is in
[docs/miku-soft-reference.md](./docs/miku-soft-reference.md).

## Repository Operation

`workplace/` is a local scratch area for sister repository checkouts, generated
verification files, and temporary artifacts. Only `workplace/.gitkeep` is
tracked.

Generated build outputs under `dist/`, `bundle/`, and `coverage/` are ignored.
