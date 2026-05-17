# miku-xlsx2md Fixture Coverage

This document tracks how `workplace/miku-xlsx2md/tests/fixtures/` is reused as
`miku-md2xlsx` compatibility input.

## Policy

- Treat `miku-xlsx2md` fixtures as Markdown-input compatibility tests.
- Do not require pixel-perfect `xlsx -> md -> xlsx` round-trip behavior.
- Keep committed generated Markdown under `tests/fixtures/from-xlsx2md/`.
- Keep generated local assets under the same relative `assets/` layout used by
  `miku-xlsx2md`.
- Regenerate with `npm run fixtures:from-xlsx2md`.

## Current Coverage

| Source fixture | Generated Markdown | Smoke coverage |
| --- | --- | --- |
| `tests/fixtures/xlsx2md-basic-sample01.xlsx` | `xlsx2md-basic-sample01.md` | yes |
| `tests/fixtures/chart/chart-basic-sample01.xlsx` | `chart-basic-sample01.md` | yes |
| `tests/fixtures/chart/chart-mixed-sample01.xlsx` | `chart-mixed-sample01.md` | yes |
| `tests/fixtures/display/display-format-sample01.xlsx` | `display-format-sample01.md` | yes |
| `tests/fixtures/edge/edge-empty-sample01.xlsx` | `edge-empty-sample01.md` | yes |
| `tests/fixtures/edge/edge-weird-sheetname-sample01.xlsx` | `edge-weird-sheetname-sample01.md` | yes |
| `tests/fixtures/formula/formula-basic-sample01.xlsx` | `formula-basic-sample01.md` | yes |
| `tests/fixtures/formula/formula-crosssheet-sample01.xlsx` | `formula-crosssheet-sample01.md` | yes |
| `tests/fixtures/formula/formula-shared-sample01.xlsx` | `formula-shared-sample01.md` | yes |
| `tests/fixtures/formula/formula-spill-sample01.xlsx` | `formula-spill-sample01.md` | yes |
| `tests/fixtures/image/image-basic-sample01.xlsx` | `image-basic-sample01.md` | yes |
| `tests/fixtures/image/image-basic-sample02.xlsx` | `image-basic-sample02/image-basic-sample02.md` | yes |
| `tests/fixtures/link/hyperlink-basic-sample01.xlsx` | `hyperlink-basic-sample01.md` | yes |
| `tests/fixtures/merge/merge-multiline-sample01.xlsx` | `merge-multiline-sample01.md` | yes |
| `tests/fixtures/merge/merge-pattern-sample01.xlsx` | `merge-pattern-sample01.md` | yes |
| `tests/fixtures/named-range/named-range-sample01.xlsx` | `named-range-sample01.md` | yes |
| `tests/fixtures/narrative/narrative-vs-table-sample01.xlsx` | `narrative-vs-table-sample01.md` | yes |
| `tests/fixtures/rich/rich-markdown-escape-sample01.xlsx` | `rich-markdown-escape-sample01.md` | yes |
| `tests/fixtures/rich/rich-text-github-sample01.xlsx` | `rich-text-github-sample01.md` | yes |
| `tests/fixtures/rich/rich-usecase-sample01.xlsx` | `rich-usecase-sample01.md` | yes |
| `tests/fixtures/shape/shape-basic-sample01.xlsx` | `shape-basic-sample01.md` | yes |
| `tests/fixtures/shape/shape-block-arrow-sample01.xlsx` | `shape-block-arrow-sample01.md` | yes |
| `tests/fixtures/shape/shape-callout-sample01.xlsx` | `shape-callout-sample01.md` | yes |
| `tests/fixtures/shape/shape-flowchart-sample01.xlsx` | `shape-flowchart-sample01.md` | yes |
| `tests/fixtures/table/grid-layout-sample-01.xlsx` | `grid-layout-sample-01.md` | yes |
| `tests/fixtures/table/table-basic-sample01.xlsx` | `table-basic-sample01.md` | yes |
| `tests/fixtures/table/table-basic-sample02.xlsx` | `table-basic-sample02.md` | yes |
| `tests/fixtures/table/table-basic-sample03.xlsx` | `table-basic-sample03.md` | yes |
| `tests/fixtures/table/table-basic-sample11.xlsx` | `table-basic-sample11.md` | yes |
| `tests/fixtures/table/table-basic-sample12.xlsx` | `table-basic-sample12.md` | yes |
| `tests/fixtures/table/table-basic-sample13.xlsx` | `table-basic-sample13.md` | yes |
| `tests/fixtures/table/table-basic-sample14.xlsx` | `table-basic-sample14.md` | yes |
| `tests/fixtures/table/table-basic-sample15.xlsx` | `table-basic-sample15.md` | yes |
| `tests/fixtures/table/table-basic-sample16.xlsx` | `table-basic-sample16.md` | yes |
| `tests/fixtures/table/table-border-priority-sample01.xlsx` | `table-border-priority-sample01.md` | yes |

## Remaining Work

- When `miku-xlsx2md` adds new `.xlsx` fixtures, add them to
  `scripts/regenerate-xlsx2md-fixtures.mjs`.
- Regenerate committed Markdown/assets with `npm run fixtures:from-xlsx2md`.
- Add at least one semantic assertion when a new fixture category introduces a
  new Markdown pattern.
