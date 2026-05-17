# TODO

## Current Follow-Ups

- Resume note as of 2026-05-17:
  - `miku-xlsx2md` generated Markdown compatibility fixtures were added under
    `tests/fixtures/from-xlsx2md/`, including image assets under
    `tests/fixtures/from-xlsx2md/assets/image/`.
  - `npm run fixtures:from-xlsx2md` regenerates the committed Markdown and
    asset fixtures from `workplace/miku-xlsx2md`.
  - Local image references such as `assets/<sheet-name>/image_001.png` are
    resolved relative to the input Markdown file by the CLI and embedded into
    generated `.xlsx` packages under `xl/media/`.
  - Markdown image references are still preserved as workbook text rows for
    semantic traceability.
  - Embedded images now use a small fixed preview anchor and reserve blank
    worksheet rows after the Markdown image reference row to avoid overlapping
    following rows.
  - Image compatibility coverage now includes `image-basic-sample02` in a
    self-contained fixture subdirectory, plus heading-split multi-sheet image
    drawing assertions.
  - Escaped pipe table cells, empty table cells, multiline-like `<br>` table
    content, and xlsx2md paragraph-fallback tables are covered by focused
    assertions.
  - Test helpers now parse content type defaults, relationships, worksheet
    drawing references, and drawing anchors for structured `.xlsx` assertions.
  - `--sheet-mode heading` now defaults to `#` sheet splits and supports
    `--sheet-heading-depth 2` for xlsx2md-style Markdown where `#` is the book
    title and `##` is the sheet heading.
  - Release CLI bundle scripts now generate `bundle/miku-md2xlsx.mjs` and
    `bundle/miku-md2xlsx-sources.tgz`, with bundle version/help/conversion
    smoke coverage.
  - GitHub Release CLI bundle workflow now builds, tests, smokes, stages, and
    uploads the generated CLI bundle assets for `v*` tags.
  - First GitHub Release CLI bundle workflow run succeeded after adding an
    install timeout and quieter `npm ci` options.
  - Real-document style coverage now includes xlsx2md-generated narrative,
    hyperlink, merge multiline, and rich text fixtures.
  - CLI local image collection now uses parsed Markdown image refs, so
    relative image URLs with spaces and angle-bracket URL syntax can be
    embedded best-effort.
  - `xlsx-writer` responsibilities are split into XML primitives, styles,
    worksheet XML, drawing/image handling, and package assembly modules.
  - `workbook-model` responsibilities are split into Markdown block conversion,
    table compatibility repair, sheet building, and column hint calculation.
  - Column hints now give text-heavy paragraph/list/code rows wider first-column
    defaults to reduce excessive wrapping in generated sample workbooks.
  - Repository-local real-document smoke coverage now converts `README.md` and
    `docs/handoff-from-xlsx2md.md`, including `##` sheet splitting for the
    handoff document.
  - `miku-xlsx2md` fixture compatibility coverage now tracks every current
    source `.xlsx` fixture in `docs/xlsx2md-fixture-coverage.md`.
  - All current `miku-xlsx2md` source `.xlsx` fixtures are covered as
    committed generated Markdown fixtures and smoke-tested by
    `tests/md2xlsx-from-xlsx2md.test.js`.
  - Optional semantic round-trip checks are available via
    `npm run test:semantic-roundtrip` for representative generated Markdown
    fixtures, including rich text/link, cross-sheet formula, named range,
    shape, image-only, and image/chart coexistence samples.
  - Hand-written real Markdown coverage now includes blockquote, inline HTML,
    HTML block, nested lists, long code blocks, and multiple tables mixed with
    narrative paragraphs.
  - Markdown table cell values are kept as strings; numeric/date/currency/
    percentage-looking text is not inferred, converted, or auto-aligned.
  - `miku-xlsx2md` merge markers `[←M←]` and `[↑M↑]` are now converted into
    worksheet merged-cell ranges, and marker cells are blanked in generated
    worksheet XML.
  - Single-cell Markdown links are now emitted as worksheet hyperlinks.
    External links use relationship targets, and `miku-xlsx2md`-style internal
    links are mapped to the generated workbook sheet/cell location.
  - Common inline rich text is now emitted as Excel rich text runs:
    `**bold**`, `*italic*`, `~~strike~~`, `<ins>underline</ins>`, and `<br>`
    cell-internal line breaks.
  - Markdown heading depths `#` through `######` now map to distinct worksheet
    font sizes.
  - Verification last run: `npm run fixtures:from-xlsx2md`, `npm run test`,
    `npm run build:all`, `npm run smoke:bundle`, and `git diff --check`.
  - Final verification and handoff summary are updated. Next practical restart
    point: expand coverage with user-provided real Markdown documents.
- Expand Markdown block coverage after testing with more user-provided real
  documents.
- Revisit sheet split defaults after more larger real-world Markdown examples
  are collected; current CLI default is `#`, with explicit `##` support.
- Add more real-document Markdown block coverage after the current focused
  escaped pipe, empty cell, multiline-like table cell, and repository-local
  smoke assertions.
- Preserve Markdown table cell text semantics.
  - Keep cell values as strings by default.
  - Do not infer numeric, date, currency, or percentage types from Markdown
    text.
  - Do not auto-align numeric-looking cells.
  - Limit table presentation improvements to structural styling such as header
    fill, borders, wrapping, and conservative column width hints.
- Preserve explicit `miku-xlsx2md` merge markers as worksheet merges.
  - Convert `[←M←]` and `[↑M↑]` table markers into `mergeCell` ranges.
  - Keep the source Markdown marker vocabulary as the compatibility contract;
    do not attempt pixel-perfect restoration of the original workbook layout.
- Preserve simple Markdown hyperlinks as worksheet hyperlinks.
  - Convert single-link cells to Excel hyperlinks while using the link label as
    the visible cell text.
  - Keep mixed-content or unsupported links as plain text until rich inline run
    support is added.
- Preserve common inline rich text as worksheet rich text runs.
  - Convert `**bold**`, `*italic*`, `~~strike~~`, `<ins>underline</ins>`, and
    `<br>` into Excel inline string runs and cell-internal line breaks.
  - Keep unsupported raw HTML as visible text.
- Keep Markdown heading levels visually distinct in worksheets.
  - Map `#` through `######` to progressively smaller bold font sizes.
  - Keep sheet splitting behavior separate from visual heading style.
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
- Revisit image sizing controls after more real `miku-xlsx2md` image outputs or
  user-provided image-heavy Markdown documents are tested.
  - Current image behavior preserves Markdown image references as workbook text
    rows and embeds matching local assets into generated `.xlsx` package
    relationships.
  - Continue resolving images relative to the input Markdown file and keep the
    `miku-xlsx2md` asset path vocabulary as the primary compatibility contract.
  - Treat image work as semantic restoration without requiring exact Excel
    anchor positions, sizes, or drawing geometry.
- Expand structured `.xlsx` assertions further when new generated package
  contracts are added.
- Review release asset contents when publishing the next GitHub Release.

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
