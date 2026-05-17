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
  if (node.type === "image") {
    const alt = typeof node.alt === "string" ? node.alt : "";
    const url = typeof node.url === "string" ? node.url : "";
    return url ? `![${alt}](${url})` : alt;
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => extractText(child)).join("");
  }
  return "";
}

export function collectImageRefs(node: any): { alt: string; path: string }[] {
  if (!node) {
    return [];
  }
  const refs: { alt: string; path: string }[] = [];
  if (node.type === "image" && typeof node.url === "string") {
    refs.push({
      alt: typeof node.alt === "string" ? node.alt : "",
      path: node.url
    });
  }
  for (const child of node.children ?? []) {
    refs.push(...collectImageRefs(child));
  }
  return refs;
}
