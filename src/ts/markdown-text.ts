export function extractText(node: any): string {
  if (!node) {
    return "";
  }
  if (node.type === "image") {
    const alt = typeof node.alt === "string" ? node.alt : "";
    const url = typeof node.url === "string" ? node.url : "";
    return url ? `![${alt}](${url})` : alt;
  }
  if (node.type === "link") {
    const label = Array.isArray(node.children) ? node.children.map((child: any) => extractText(child)).join("") : "";
    const url = typeof node.url === "string" ? node.url : "";
    if (label === url) {
      return label;
    }
    return url ? `[${label}](${url})` : label;
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => extractText(child)).join("");
  }
  return "";
}
