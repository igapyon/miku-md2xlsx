import type { Md2XlsxImageAsset } from "./types.ts";

export function mediaExtension(asset: Md2XlsxImageAsset): string {
  const fromPath = asset.path.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
  if (fromPath === "jpg" || fromPath === "jpeg" || fromPath === "png" || fromPath === "gif") {
    return fromPath;
  }
  switch (asset.contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

export function mediaContentType(extension: string): string {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}
