export interface ImageSize {
  width: number;
  height: number;
}

function readUint16Be(data: Uint8Array, offset: number): number {
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

function readUint32Be(data: Uint8Array, offset: number): number {
  return (((data[offset] ?? 0) << 24) | ((data[offset + 1] ?? 0) << 16) | ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0)) >>> 0;
}

function pngSize(data: Uint8Array): ImageSize | undefined {
  if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
    return undefined;
  }
  return { width: readUint32Be(data, 16), height: readUint32Be(data, 20) };
}

function gifSize(data: Uint8Array): ImageSize | undefined {
  if (data.length < 10 || data[0] !== 0x47 || data[1] !== 0x49 || data[2] !== 0x46) {
    return undefined;
  }
  return { width: readUint16Le(data, 6), height: readUint16Le(data, 8) };
}

function jpegSize(data: Uint8Array): ImageSize | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1] ?? 0;
    const length = readUint16Be(data, offset + 2);
    if (length < 2 || offset + 2 + length > data.length) {
      return undefined;
    }
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: readUint16Be(data, offset + 7), height: readUint16Be(data, offset + 5) };
    }
    offset += 2 + length;
  }
  return undefined;
}

export function imageSize(data: Uint8Array): ImageSize | undefined {
  return pngSize(data) ?? gifSize(data) ?? jpegSize(data);
}
