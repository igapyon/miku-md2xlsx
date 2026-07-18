# TODO

## Open TODO

- Expand Markdown block coverage with more user-provided real documents.
  Current hand-written coverage already includes blockquote, inline HTML, HTML
  block, nested lists, long code blocks, and multiple tables mixed with
  narrative paragraphs.
- Revisit sheet split defaults after more large real-world Markdown examples
  are collected. Current CLI default is `#`, with explicit `##` support through
  `--sheet-heading-depth 2`.
- Revisit image sizing controls after more real `miku-xlsx2md` image outputs or
  user-provided image-heavy Markdown documents are tested.
  Current behavior is semantic restoration, not exact Excel drawing geometry
  restoration.
- Expand structured `.xlsx` assertions further when new generated package
  contracts are added.
- Add fixture coverage with real user-authored template workbooks for
  `--template <xlsx>`, especially column widths, row heights, sheet views, and
  rightmost-template-sheet reuse.
- Review release asset contents when publishing the next GitHub Release.

## Maintenance Rules

- Maintain `miku-xlsx2md` fixture compatibility coverage.
  - Current source fixture coverage is complete for the checked-in
    `workplace/miku-xlsx2md/tests/fixtures/*.xlsx` set and tracked in
    `docs/xlsx2md-fixture-coverage.md`.
  - When `miku-xlsx2md` adds new `.xlsx` fixtures, update
    `scripts/regenerate-xlsx2md-fixtures.mjs`, run
    `npm run fixtures:from-xlsx2md`, commit the generated Markdown/assets, and
    add semantic assertions for any new Markdown pattern.
  - Keep treating these tests as Markdown input compatibility tests, not as
    pixel-perfect `xlsx -> md -> xlsx` round-trip tests.
  - Keep normal `npm test` independent from `workplace/`; only fixture
    regeneration should depend on `workplace/miku-xlsx2md`.
- Maintain optional semantic round-trip checks.
  - Flow: generated `.md` -> `miku-md2xlsx` -> `.xlsx` -> `miku-xlsx2md` ->
    returned `.md`.
  - Compare semantic markers and representative values only; do not compare
    full Markdown text, whitespace, table formatting, or visual geometry.
  - For image samples, check image markers, file names, and preserved semantic
    references without requiring exact regenerated asset path equality.
  - Keep this separate from normal `npm test` because it depends on
    `workplace/miku-xlsx2md`.
- Preserve Markdown table cell text semantics.
  - Keep cell values as strings by default.
  - Do not infer numeric, date, currency, or percentage types from Markdown
    text.
  - Do not auto-align numeric-looking cells.
  - Limit table presentation improvements to structural styling such as header
    fill, borders, wrapping, and conservative column width hints.
- Preserve the source Markdown compatibility vocabulary.
  - Treat `miku-xlsx2md` merge markers `[←M←]` and `[↑M↑]` as the compatibility
    contract for worksheet merges.
  - Keep Markdown image references visible as workbook text rows while embedding
    matching local assets best-effort.
  - Keep unsupported raw HTML visible as text unless explicit conversion support
    is added.

## Completed Implementation Notes

- Added initial `--template <xlsx>` support. Generated sheets are written over
  matching template sheets, and generated sheets beyond the template sheet count
  reuse the rightmost template sheet as their base.
- Template mode reuses workbook styles, theme parts, and worksheet-level XML
  settings where possible, while replacing template sheet data with generated
  Markdown content.
- `miku-xlsx2md` generated Markdown compatibility fixtures were added under
  `tests/fixtures/from-xlsx2md/`, including image assets under
  `tests/fixtures/from-xlsx2md/assets/image/`.
- `npm run fixtures:from-xlsx2md` regenerates the committed Markdown and asset
  fixtures from `workplace/miku-xlsx2md`.
- Local image references such as `assets/<sheet-name>/image_001.png` are
  resolved relative to the input Markdown file by the CLI and embedded into
  generated `.xlsx` packages under `xl/media/`.
- Markdown image references are preserved as workbook text rows for semantic
  traceability.
- Embedded images use a small fixed preview anchor and reserve blank worksheet
  rows after the Markdown image reference row to avoid overlapping following
  rows.
- Image compatibility coverage includes `image-basic-sample02` in a
  self-contained fixture subdirectory, plus heading-split multi-sheet image
  drawing assertions.
- Escaped pipe table cells, empty table cells, multiline-like `<br>` table
  content, and xlsx2md paragraph-fallback tables are covered by focused
  assertions.
- Test helpers parse content type defaults, relationships, worksheet drawing
  references, and drawing anchors for structured `.xlsx` assertions.
- `--sheet-mode heading` defaults to `#` sheet splits and supports
  `--sheet-heading-depth 2` for xlsx2md-style Markdown where `#` is the book
  title and `##` is the sheet heading.
- Release bundle scripts generate `bundle/miku-md2xlsx.mjs`,
  `bundle/miku-md2xlsx-runtime.mjs`, and `bundle/miku-md2xlsx-sources.tgz`,
  with CLI bundle version/help/conversion smoke coverage and runtime import/API
  smoke coverage.
- GitHub Release CLI/runtime bundle workflow runs when a `v*` GitHub Release is
  published, checks the release tag against `package.json`, builds from that
  tag, tests, smokes, stages, and uploads the generated release assets.
- First GitHub Release CLI bundle workflow run succeeded after adding an
  install timeout and quieter `npm ci` options.
- Real-document style coverage includes xlsx2md-generated narrative, hyperlink,
  merge multiline, and rich text fixtures.
- CLI local image collection uses parsed Markdown image refs, so relative image
  URLs with spaces and angle-bracket URL syntax can be embedded best-effort.
- `xlsx-writer` responsibilities are split into XML primitives, styles,
  worksheet XML, drawing/image handling, and package assembly modules.
- Worksheet merge marker handling is split into `xlsx-merge`, keeping merge
  range calculation separate from worksheet XML rendering.
- Worksheet hyperlink handling is split into `xlsx-hyperlinks`, keeping
  hyperlink XML and relationship XML generation separate from worksheet rows.
- XLSX rich text run XML generation is split into `xlsx-rich-text`, keeping
  inline string rendering separate from worksheet XML assembly.
- Markdown inline cell handling is split into `markdown-inline`, keeping text,
  link, rich text, and image reference extraction separate from Markdown parsing.
- Markdown inline responsibilities are further split into text extraction, image
  reference collection, link-cell detection, and rich text run generation.
- Image dimension parsing is split into `image-size`, keeping PNG/GIF/JPEG size
  detection separate from drawing XML and preview-row reservation.
- Drawing responsibilities are further split into drawing type definitions,
  media type helpers, drawing XML generation, preview-row reservation, and sheet
  drawing collection.
- `miku-xlsx2md` fixture compatibility tests are split by concern into smoke,
  content, rich/link/merge, and image test files with shared fixture helpers.
- `workbook-model` responsibilities are split into Markdown block conversion,
  table compatibility repair, sheet building, and column hint calculation.
- Column hints give text-heavy paragraph/list/code rows wider first-column
  defaults to reduce excessive wrapping in generated sample workbooks.
- Repository-local real-document smoke coverage converts `README.md` and
  `docs/handoff-from-xlsx2md.md`, including `##` sheet splitting for the
  handoff document.
- `miku-xlsx2md` fixture compatibility coverage tracks every current source
  `.xlsx` fixture in `docs/xlsx2md-fixture-coverage.md`.
- All current `miku-xlsx2md` source `.xlsx` fixtures are covered as committed
  generated Markdown fixtures and smoke-tested by the split
  `tests/md2xlsx-from-xlsx2md-*.test.js` files.
- Optional semantic round-trip checks are available via
  `npm run test:semantic-roundtrip` for representative generated Markdown
  fixtures, including rich text/link, cross-sheet formula, named range, shape,
  image-only, and image/chart coexistence samples.
- Markdown table cell values are kept as strings; numeric/date/currency/
  percentage-looking text is not inferred, converted, or auto-aligned.
- `miku-xlsx2md` merge markers `[←M←]` and `[↑M↑]` are converted into worksheet
  merged-cell ranges, and marker cells are blanked in generated worksheet XML.
- Single-cell Markdown links are emitted as worksheet hyperlinks. External links
  use relationship targets, and `miku-xlsx2md`-style internal links are mapped
  to the generated workbook sheet/cell location.
- Common inline rich text is emitted as Excel rich text runs: `**bold**`,
  `*italic*`, `~~strike~~`, `<ins>underline</ins>`, and `<br>` cell-internal
  line breaks.
- Markdown heading depths `#` through `######` map to distinct worksheet font
  sizes.
- CLI `--help` output now includes a fuller command summary, examples,
  Markdown handling notes, template mode notes, and sheet mode notes for
  AI-agent-readable usage.
- CLI option validation rejects unsupported `--sheet-mode` and `--table-style`
  values, and the `--version` test compares CLI output with `package.json`.
- Vendored `miku-ms-office-core` is updated from `0.5.1` to `0.6.0`.
- The unused pre-core `src/ts/zip-io.ts` ZIP writer is removed.
- Package version is updated to `0.9.5`.
- Verification last run: `npm test`, `npm run build:all`,
  `npm run smoke:version`, `npm run smoke:bundle`,
  `npm run smoke:runtime`, `npm run test:semantic-roundtrip`, and
  `git diff --check`.

## miku-soft Initialization Record

- Date: 2026-05-17
- Main workflow: `references/new-project-workflow.md` with
  `references/10-node-app-workflow.md`
- First delivery surface: TypeScript / Node.js main application
- Sister references checked:
  - `workplace/miku-md2docx`
  - `workplace/miku-xlsx2md`
  - `workplace/mikuproject`
- Adopted from `miku-md2docx`: `src/ts`, `scripts`, Vitest, and CLI-first
  repository shape.
- Adopted from `miku-xlsx2md`: XLSX-domain stance that preserves practical
  structure rather than visual fidelity.
- Adopted from `mikuproject`: minimal XLSX package generation pattern,
  worksheet XML shape, inline string whitespace handling, and XML text
  sanitization.
- Rejected for initial scope: Web App files, release bundle workflow, and
  complete XLSX round-trip behavior.
