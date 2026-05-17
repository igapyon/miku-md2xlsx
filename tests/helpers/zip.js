const decoder = new TextDecoder();

function readUint16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data, offset) {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

export function unzipStoredEntries(data) {
  const entries = unzipStoredBinaryEntries(data);
  return new Map(Array.from(entries, ([name, bytes]) => [name, decoder.decode(bytes)]));
}

export function unzipStoredBinaryEntries(data) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= data.length && readUint32(data, offset) === 0x04034b50) {
    const method = readUint16(data, offset + 8);
    const compressedSize = readUint32(data, offset + 18);
    const fileNameLength = readUint16(data, offset + 26);
    const extraLength = readUint16(data, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = decoder.decode(data.slice(nameStart, nameStart + fileNameLength));
    if (method !== 0) {
      throw new Error(`Unsupported zip compression method: ${method}`);
    }
    entries.set(name, data.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
}
