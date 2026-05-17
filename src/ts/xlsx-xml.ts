export function xml(value: string): string {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sanitizeXmlText(value: string): string {
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "");
}

export function inlineTextXml(value: string): string {
  const sanitized = sanitizeXmlText(value);
  const preserve = sanitized.length === 0 || /^\s|\s$/.test(sanitized) || /[\n\r\t]/.test(sanitized);
  const attribute = preserve ? ` xml:space="preserve"` : "";
  return `<t${attribute}>${xml(sanitized)}</t>`;
}

export function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}
