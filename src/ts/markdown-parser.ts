import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

export function parseMarkdown(markdown: string): any {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as any;
}

export function extractText(node: any): string {
  if (!node) {
    return "";
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => extractText(child)).join("");
  }
  return "";
}
