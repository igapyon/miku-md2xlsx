import { readFile } from "node:fs/promises";

export async function readFixture(name) {
  return readFile(`tests/fixtures/from-xlsx2md/${name}`, "utf8");
}

export function flatten(values) {
  return values.flat().join("\n");
}

export const allGeneratedFixtureMarkdown = [
  "chart-basic-sample01.md",
  "chart-mixed-sample01.md",
  "display-format-sample01.md",
  "edge-empty-sample01.md",
  "edge-weird-sheetname-sample01.md",
  "formula-basic-sample01.md",
  "formula-crosssheet-sample01.md",
  "formula-shared-sample01.md",
  "formula-spill-sample01.md",
  "grid-layout-sample-01.md",
  "hyperlink-basic-sample01.md",
  "image-basic-sample01.md",
  "image-basic-sample02/image-basic-sample02.md",
  "merge-multiline-sample01.md",
  "merge-pattern-sample01.md",
  "named-range-sample01.md",
  "narrative-vs-table-sample01.md",
  "rich-markdown-escape-sample01.md",
  "rich-text-github-sample01.md",
  "rich-usecase-sample01.md",
  "shape-basic-sample01.md",
  "shape-block-arrow-sample01.md",
  "shape-callout-sample01.md",
  "shape-flowchart-sample01.md",
  "table-basic-sample01.md",
  "table-basic-sample02.md",
  "table-basic-sample03.md",
  "table-basic-sample11.md",
  "table-basic-sample12.md",
  "table-basic-sample13.md",
  "table-basic-sample14.md",
  "table-basic-sample15.md",
  "table-basic-sample16.md",
  "table-border-priority-sample01.md",
  "xlsx2md-basic-sample01.md"
];
