import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const splitTarPath = path => {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: "" };
  for (let index = path.lastIndexOf("/"); index > 0; index = path.lastIndexOf("/", index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  throw new Error(`package path is too long for ustar: ${path}`);
};

const writeText = (header, offset, length, value) => {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`tar field exceeds ${length} bytes`);
  bytes.copy(header, offset);
};

const octal = (value, width) => `${value.toString(8).padStart(width - 1, "0")}\0`;

const tarHeader = (path, size, epoch, mode) => {
  const header = Buffer.alloc(512);
  const { name, prefix } = splitTarPath(path);
  writeText(header, 0, 100, name);
  writeText(header, 100, 8, octal(mode, 8));
  writeText(header, 108, 8, octal(0, 8));
  writeText(header, 116, 8, octal(0, 8));
  writeText(header, 124, 12, octal(size, 12));
  writeText(header, 136, 12, octal(epoch, 12));
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeText(header, 257, 6, "ustar\0");
  writeText(header, 263, 2, "00");
  writeText(header, 345, 155, prefix);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeText(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
};

const collectFiles = async (root, archiveRoot) => {
  const files = [];
  const visit = async (directory, prefix = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, path);
      if (entry.isFile()) {
        const facts = await stat(absolute);
        files.push({
          path: `${archiveRoot}/${path}`,
          bytes: await readFile(absolute),
          mode: (facts.mode & 0o111) === 0 ? 0o644 : 0o755,
        });
      }
    }
  };
  await visit(root);
  return files;
};

export const createDeterministicTarGz = async ({ directory, archiveRoot, sourceDateEpoch }) => {
  if (typeof archiveRoot !== "string" || archiveRoot === "" || archiveRoot.startsWith("/")) {
    throw new Error("archive root must be a non-empty relative path");
  }
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 1) {
    throw new Error("source date epoch must be a positive integer");
  }
  const chunks = [];
  for (const file of await collectFiles(directory, archiveRoot)) {
    chunks.push(tarHeader(file.path, file.bytes.length, sourceDateEpoch, file.mode), file.bytes);
    const remainder = file.bytes.length % 512;
    if (remainder !== 0) chunks.push(Buffer.alloc(512 - remainder));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
};
