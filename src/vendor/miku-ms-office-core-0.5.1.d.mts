export interface ZipEntryInput {
  path: string;
  data: Uint8Array | string;
  date?: Date;
  compression?: "store" | "deflate";
}

export interface ZipEntry {
  path: string;
  data: Uint8Array;
  compression: "store" | "deflate";
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  modifiedAt: Date;
}

export interface OpcRelationship {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

export declare function buildOpcContentTypesXml(input: {
  defaults?: Array<{ extension: string; contentType: string }>;
  overrides?: Array<{ partName: string; contentType: string }>;
}): string;

export declare function buildOpcRelationshipsXml(relationships: OpcRelationship[]): string;

export declare function getZipTextEntry(entries: ZipEntry[], entryPath: string): string | undefined;

export declare function readZipPackage(data: Uint8Array): {
  entries: ZipEntry[];
  diagnostics: Array<{ severity: "info" | "warning" | "error"; code: string; message: string; path?: string }>;
};

export declare function writeZipPackage(entries: ZipEntryInput[]): Uint8Array;
