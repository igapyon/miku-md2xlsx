import type { CellModel, RichTextRun } from "./types.ts";
import { inlineTextXml } from "./xlsx-xml.ts";

export function cellInlineStringXml(cell: CellModel, value: string): string {
  const runs = cell.richTextRuns;
  if (!runs?.length || runs.map((run) => run.text).join("") !== value) {
    return inlineTextXml(value);
  }
  return runs.map(richTextRunXml).join("");
}

function richTextRunXml(run: RichTextRun): string {
  const properties = richTextRunPropertiesXml(run);
  return `<r>${properties}${inlineTextXml(run.text)}</r>`;
}

function richTextRunPropertiesXml(run: RichTextRun): string {
  const properties = [
    run.bold ? "<b/>" : "",
    run.italic ? "<i/>" : "",
    run.strike ? "<strike/>" : "",
    run.underline ? "<u/>" : ""
  ].join("");
  return properties ? `<rPr>${properties}</rPr>` : "";
}
