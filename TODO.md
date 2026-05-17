# TODO

## Current Follow-Ups

- Expand Markdown block coverage after testing with real documents.
- Decide whether `#` or `##` should be the default sheet split level for
  larger workbooks.
- Add fixture tests for escaped pipes, empty table cells, and multiline table
  content.
- Add release CLI bundle scripts once the core CLI contract stabilizes.
- Consider local image asset support after the text and table conversion model
  is stable.

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
