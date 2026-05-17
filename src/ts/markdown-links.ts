import type { CellModel } from "./types.ts";
import { extractText } from "./markdown-text.ts";

export function linkedCellFromChildren(children: any[]): Pick<CellModel, "value" | "hyperlink"> | undefined {
  const linkNodes = children.filter((child: any) => child.type === "link");
  if (linkNodes.length !== 1) {
    return undefined;
  }

  const link = linkNodes[0];
  const linkIndex = children.indexOf(link);
  const before = children.slice(0, linkIndex).map((child: any) => extractText(child)).join("");
  const after = children.slice(linkIndex + 1).map((child: any) => extractText(child)).join("");
  const label = Array.isArray(link.children) ? link.children.map((child: any) => extractText(child)).join("") : "";
  const url = typeof link.url === "string" ? link.url : "";
  if (!url || before.trim()) {
    return undefined;
  }

  const internalLocation = after.match(/^\s*\(([^()]+![A-Z]{1,3}\d+)\)\s*$/);
  if (url.startsWith("#") && internalLocation) {
    return {
      value: label,
      hyperlink: { target: internalLocation[1], kind: "internal" }
    };
  }

  if (!after.trim() && isExternalLinkTarget(url)) {
    return {
      value: label,
      hyperlink: { target: url, kind: "external" }
    };
  }

  return undefined;
}

function isExternalLinkTarget(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}
