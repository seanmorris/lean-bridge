/**
 * Inspect the complete deterministic ZIP format emitted by native package builders.
 * No archive member is extracted or executed before layout and CRC validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, value) => {
	for(let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
	return value >>> 0;
});
const crc32 = bytes => {
	let crc = 0xffffffff;
	for(const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
	return (crc ^ 0xffffffff) >>> 0;
};

/**
 * Read every file, rejecting duplicates, links, traversal, inconsistent headers and trailing data.
 * This deliberately accepts only the repository's fixed-epoch, deflated ZIP32 package format.
 *
 * @param bytes - Original package archive bytes.
 */
export const readClosedPackageZip = bytes => {
	assert.ok(Buffer.isBuffer(bytes) && bytes.length > 22 && bytes.length < 128 * 1024 ** 2);
	const end = bytes.length - 22;
	assert.equal(bytes.readUInt32LE(end), 0x06054b50, "ZIP end marker");
	assert.equal(bytes.readUInt32LE(end + 4), 0, "single ZIP disk");
	const count = bytes.readUInt16LE(end + 8), centralSize = bytes.readUInt32LE(end + 12);
	assert.ok(count > 0); assert.equal(bytes.readUInt16LE(end + 10), count);
	assert.equal(bytes.readUInt16LE(end + 20), 0, "no ZIP comment or trailing bytes");
	const centralStart = bytes.readUInt32LE(end + 16);
	assert.equal(centralStart + centralSize, end);
	let offset = 0, central = centralStart, total = 0;
	const files = new Map();
	for(let index = 0; index < count; index++)
	{
		assert.ok(offset + 30 <= centralStart && central + 46 <= end, "ZIP header bounds");
		assert.equal(bytes.readUInt32LE(offset), 0x04034b50);
		assert.equal(bytes.readUInt16LE(offset + 4), 20);
		assert.equal(bytes.readUInt16LE(offset + 6), 0x800);
		assert.equal(bytes.readUInt16LE(offset + 8), 8);
		assert.equal(bytes.readUInt16LE(offset + 10), 0); assert.equal(bytes.readUInt16LE(offset + 12), 33);
		const checksum = bytes.readUInt32LE(offset + 14), compressedSize = bytes.readUInt32LE(offset + 18);
		const size = bytes.readUInt32LE(offset + 22), nameSize = bytes.readUInt16LE(offset + 26);
		assert.equal(bytes.readUInt16LE(offset + 28), 0);
		assert.ok(offset + 30 + nameSize <= centralStart && central + 46 + nameSize <= end);
		const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameSize), path = nameBytes.toString("utf8");
		assert.deepEqual(Buffer.from(path), nameBytes);
		assert.ok(path === "[Content_Types].xml" || /^[A-Za-z0-9_.$+/-]+$/u.test(path), "safe ZIP member name");
		assert.ok(!path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part)), "safe ZIP path");
		assert.ok(!files.has(path), `duplicate ZIP path ${path}`);
		total += size; assert.ok(total < 512 * 1024 ** 2, "ZIP expanded size limit");
		const dataStart = offset + 30 + nameSize, next = dataStart + compressedSize;
		assert.ok(next <= centralStart);
		const inflated = inflateRawSync(bytes.subarray(dataStart, next), { maxOutputLength: Math.max(1, size), info: true });
		assert.equal(inflated.engine.bytesWritten, compressedSize, "no trailing deflate data");
		const source = inflated.buffer;
		assert.equal(source.length, size); assert.equal(crc32(source), checksum, `ZIP CRC ${path}`);
		assert.equal(bytes.readUInt32LE(central), 0x02014b50);
		assert.equal(bytes.readUInt16LE(central + 4), 0x0314);
		assert.deepEqual(bytes.subarray(central + 6, central + 28), bytes.subarray(offset + 4, offset + 26));
		assert.equal(bytes.readUInt16LE(central + 28), nameSize);
		assert.equal(bytes.readUInt32LE(central + 30), 0); assert.equal(bytes.readUInt32LE(central + 34), 0);
		assert.equal(bytes.readUInt32LE(central + 38), (0o100644 << 16) >>> 0, "regular ZIP file");
		assert.equal(bytes.readUInt32LE(central + 42), offset);
		assert.deepEqual(bytes.subarray(central + 46, central + 46 + nameSize), nameBytes);
		files.set(path, source); offset = next; central += 46 + nameSize;
	}
	assert.equal(offset, centralStart); assert.equal(central, end);
	for(const path of files.keys())
	{
		const parts = path.split("/");
		for(let index = 1; index < parts.length; index++)
			assert.ok(!files.has(parts.slice(0, index).join("/")), "ZIP file/directory conflict");
	}
	return files;
};
