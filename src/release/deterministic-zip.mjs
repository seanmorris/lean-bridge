import { deflateRawSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const crcTable = Object.freeze(Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
}));

const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const dosTime = epoch => {
  const date = new Date(epoch * 1000);
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
};

const collectFiles = async root => {
  const files = [];
  const visit = async (directory, prefix = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, path);
      if (entry.isFile()) files.push({ path, bytes: await readFile(absolute) });
    }
  };
  await visit(root);
  return files;
};

export const createDeterministicZip = async ({ directory, sourceDateEpoch }) => {
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 315532800) {
    throw new Error("ZIP source date epoch must be on or after 1980-01-01");
  }
  const local = [];
  const central = [];
  let offset = 0;
  const timestamp = dosTime(sourceDateEpoch);
  for (const file of await collectFiles(directory)) {
    const name = Buffer.from(file.path, "utf8");
    const compressed = deflateRawSync(file.bytes, { level: 9 });
    const checksum = crc32(file.bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(timestamp.time, 10);
    header.writeUInt16LE(timestamp.date, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(file.bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, compressed);

    const directoryHeader = Buffer.alloc(46);
    directoryHeader.writeUInt32LE(0x02014b50, 0);
    directoryHeader.writeUInt16LE(0x0314, 4);
    directoryHeader.writeUInt16LE(20, 6);
    directoryHeader.writeUInt16LE(0x800, 8);
    directoryHeader.writeUInt16LE(8, 10);
    directoryHeader.writeUInt16LE(timestamp.time, 12);
    directoryHeader.writeUInt16LE(timestamp.date, 14);
    directoryHeader.writeUInt32LE(checksum, 16);
    directoryHeader.writeUInt32LE(compressed.length, 20);
    directoryHeader.writeUInt32LE(file.bytes.length, 24);
    directoryHeader.writeUInt16LE(name.length, 28);
    directoryHeader.writeUInt16LE(0, 30);
    directoryHeader.writeUInt16LE(0, 32);
    directoryHeader.writeUInt16LE(0, 34);
    directoryHeader.writeUInt16LE(0, 36);
    directoryHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    directoryHeader.writeUInt32LE(offset, 42);
    central.push(directoryHeader, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  const fileCount = central.length / 2;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(fileCount, 8);
  end.writeUInt16LE(fileCount, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBytes, end]);
};
