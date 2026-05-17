import { collectImageRefs, extractCell, extractText } from "./markdown-parser.ts";
import { paragraphTableRows, tableRows } from "./markdown-table-compat.ts";
import type { Md2XlsxOptions, RowModel } from "./types.ts";

export function blankRow(): RowModel {
  return { kind: "blank", cells: [{ value: "" }] };
}

export function textRow(kind: RowModel["kind"], value: string, styleRole: RowModel["cells"][number]["styleRole"] = "normal"): RowModel {
  return { kind, cells: [{ value, styleRole }] };
}

function headingStyleRole(depth: number): RowModel["cells"][number]["styleRole"] {
  switch (depth) {
    case 1:
      return "heading1";
    case 2:
      return "heading2";
    case 3:
      return "heading3";
    case 4:
      return "heading4";
    case 5:
      return "heading5";
    default:
      return "heading6";
  }
}

function imageRow(value: string, imageRefs: RowModel["imageRefs"]): RowModel {
  return { kind: "image", cells: [{ value, styleRole: "normal" }], imageRefs };
}

function quoteText(value: string): string {
  return value.split(/\r?\n/).map((line) => `> ${line}`).join("\n");
}

function listItemText(item: any): string {
  const parts: string[] = [];
  for (const child of item.children ?? []) {
    if (child.type === "paragraph") {
      parts.push(extractText(child).trim());
    }
  }
  return parts.filter(Boolean).join(" ");
}

function listRow(value: string, depth: number): RowModel {
  return {
    kind: "list",
    cells: [
      ...Array.from({ length: depth }, () => ({ value: "", styleRole: "normal" as const })),
      { value, styleRole: "normal" }
    ]
  };
}

function appendListRows(rows: RowModel[], node: any, depth = 0): void {
  const ordered = Boolean(node.ordered);
  let index = Number(node.start ?? 1);
  for (const item of node.children ?? []) {
    const marker = ordered ? `${index}.` : "-";
    const text = listItemText(item);
    if (text) {
      rows.push(listRow(`${marker} ${text}`, depth));
    }
    for (const child of item.children ?? []) {
      if (child.type === "list") {
        appendListRows(rows, child, depth + 1);
      }
    }
    index += 1;
  }
}

export function blockToRows(node: any, options: Required<Pick<Md2XlsxOptions, "headerRow" | "tableStyle">>): RowModel[] {
  switch (node.type) {
    case "heading":
      return [textRow(node.depth === 1 ? "title" : "heading", extractText(node).trim(), headingStyleRole(node.depth))];
    case "paragraph": {
      const cell = extractCell(node);
      const text = cell.value.trim();
      if (!text) {
        return [];
      }
      const table = paragraphTableRows(text, options.headerRow, options.tableStyle);
      if (table) {
        return table;
      }
      const imageRefs = collectImageRefs(node);
      return imageRefs.length ? [imageRow(text, imageRefs)] : [{ kind: "paragraph", cells: [{ ...cell, value: text, styleRole: "normal" }] }];
    }
    case "list": {
      const rows: RowModel[] = [];
      appendListRows(rows, node);
      return rows;
    }
    case "blockquote":
      return (node.children ?? []).flatMap((child: any) => blockToRows(child, options)).map((row: RowModel) => ({
        ...row,
        kind: row.kind === "table" ? row.kind : "paragraph",
        cells: row.cells.map((cell, index) => ({
          ...cell,
          value: index === 0 ? quoteText(cell.value) : cell.value
        }))
      }));
    case "table":
      return tableRows(node, options.headerRow, options.tableStyle);
    case "code":
      return [textRow("code", String(node.value ?? ""), "code")];
    case "html": {
      const text = String(node.value ?? "").trim();
      return text ? [textRow("paragraph", text)] : [];
    }
    case "thematicBreak":
      return [textRow("separator", "", "separator")];
    default:
      return [];
  }
}
