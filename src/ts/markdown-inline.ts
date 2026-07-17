import type { CellModel } from "./types.ts";
import { collectImageRefs } from "./markdown-images.ts";
import { linkedCellFromChildren } from "./markdown-links.ts";
import { richCellFromChildren } from "./markdown-rich-text.ts";
import { extractText } from "./markdown-text.ts";

export { collectImageRefs, extractText };

export function extractCell(node: any): Pick<CellModel, "value" | "hyperlink" | "richTextRuns"> {
  const children = inlineChildren(node);
  return linkedCellFromChildren(children) ?? richCellFromChildren(children, extractText(node));
}

function inlineChildren(node: any): any[] {
  if (!Array.isArray(node?.children)) {
    return [];
  }
  if (node.children.length === 1 && node.children[0]?.type === "paragraph" && Array.isArray(node.children[0].children)) {
    return node.children[0].children;
  }
  return node.children;
}
