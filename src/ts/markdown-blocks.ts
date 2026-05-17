import { collectImageRefs, extractText } from "./markdown-parser.ts";
import { paragraphTableRows, tableRows } from "./markdown-table-compat.ts";
import type { Md2XlsxOptions, RowModel } from "./types.ts";

export function blankRow(): RowModel {
  return { kind: "blank", cells: [{ value: "" }] };
}

export function textRow(kind: RowModel["kind"], value: string, styleRole: RowModel["cells"][number]["styleRole"] = "normal"): RowModel {
  return { kind, cells: [{ value, styleRole }] };
}

function imageRow(value: string, imageRefs: RowModel["imageRefs"]): RowModel {
  return { kind: "image", cells: [{ value, styleRole: "normal" }], imageRefs };
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

function appendListRows(rows: RowModel[], node: any, depth = 0): void {
  const ordered = Boolean(node.ordered);
  let index = Number(node.start ?? 1);
  for (const item of node.children ?? []) {
    const marker = ordered ? `${index}.` : "-";
    const indent = "  ".repeat(depth);
    const text = listItemText(item);
    if (text) {
      rows.push(textRow("list", `${indent}${marker} ${text}`));
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
      return [textRow(node.depth === 1 ? "title" : "heading", extractText(node).trim(), node.depth === 1 ? "title" : "heading")];
    case "paragraph": {
      const text = extractText(node).trim();
      if (!text) {
        return [];
      }
      const table = paragraphTableRows(text, options.headerRow, options.tableStyle);
      if (table) {
        return table;
      }
      const imageRefs = collectImageRefs(node);
      return imageRefs.length ? [imageRow(text, imageRefs)] : [textRow("paragraph", text)];
    }
    case "list": {
      const rows: RowModel[] = [];
      appendListRows(rows, node);
      return rows;
    }
    case "table":
      return tableRows(node, options.headerRow, options.tableStyle);
    case "code":
      return [textRow("code", String(node.value ?? ""), "code")];
    case "thematicBreak":
      return [textRow("separator", "", "separator")];
    default:
      return [];
  }
}
