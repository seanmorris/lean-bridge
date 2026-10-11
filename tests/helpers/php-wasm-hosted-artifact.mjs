/**
 * Read the fixed original hosted PHP-Wasm artifact without extracting or executing its members.
 *
 * @file
 */
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpWasmHostedArtifactSha256 = "046a23daad626a480eb007e434ffa053ed2392f79ea1f9d10842d98ff82942df";
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
 * Authenticate the original ZIP before accepting its single-disk descriptor-bearing layout.
 *
 * @param bytes - Exact GitHub artifact 11685379051 ZIP bytes.
 */
export const readPhpWasmHostedMembers = bytes => {
	assert.ok(Buffer.isBuffer(bytes)); assert.equal(bytes.length, 3016912);
	assert.equal(sha256(bytes), phpWasmHostedArtifactSha256);
	const end = bytes.length - 22, centralStart = bytes.readUInt32LE(end + 16);
	assert.equal(bytes.readUInt32LE(end), 0x06054b50); assert.equal(bytes.readUInt32LE(end + 4), 0);
	assert.equal(bytes.readUInt16LE(end + 20), 0);
	assert.equal(bytes.readUInt16LE(end + 8), 111); assert.equal(bytes.readUInt16LE(end + 10), 111);
	assert.equal(centralStart + bytes.readUInt32LE(end + 12), end);
	let central = centralStart, local = 0, total = 0;
	const files = new Map();
	for(let index = 0; index < 111; index++)
	{
		assert.ok(central + 46 <= end && local + 30 <= centralStart);
		assert.equal(bytes.readUInt32LE(central), 0x02014b50);
		assert.equal(bytes.readUInt16LE(central + 6), 20);
		assert.equal(bytes.readUInt16LE(central + 8), 8); assert.equal(bytes.readUInt16LE(central + 10), 8);
		assert.equal(bytes.readUInt32LE(central + 30), 0); assert.equal(bytes.readUInt32LE(central + 34), 0);
		assert.equal(bytes.readUInt32LE(central + 42), local);
		const nameSize = bytes.readUInt16LE(central + 28), packed = bytes.readUInt32LE(central + 20), size = bytes.readUInt32LE(central + 24);
		assert.ok(central + 46 + nameSize <= end);
		const nameBytes = bytes.subarray(central + 46, central + 46 + nameSize), name = nameBytes.toString("utf8");
		assert.deepEqual(Buffer.from(name), nameBytes); assert.match(name, /^[A-Za-z0-9_.+/-]+$/u);
		assert.ok(!name.startsWith("/") && !name.split("/").some(part => ["", ".", ".."].includes(part)) && !files.has(name));
		assert.equal(bytes.readUInt32LE(local), 0x04034b50);
		assert.deepEqual(bytes.subarray(local + 4, local + 14), bytes.subarray(central + 6, central + 16));
		assert.deepEqual(bytes.subarray(local + 14, local + 26), Buffer.alloc(12));
		assert.equal(bytes.readUInt16LE(local + 26), nameSize); assert.equal(bytes.readUInt16LE(local + 28), 0);
		assert.deepEqual(bytes.subarray(local + 30, local + 30 + nameSize), nameBytes);
		const start = local + 30 + nameSize, descriptor = start + packed;
		assert.ok(descriptor + 16 <= centralStart);
		assert.equal(bytes.readUInt32LE(descriptor), 0x08074b50);
		assert.deepEqual(bytes.subarray(descriptor + 4, descriptor + 16), bytes.subarray(central + 16, central + 28));
		total += size; assert.ok(total < 64 * 1024 ** 2 && size < 32 * 1024 ** 2);
		const inflated = inflateRawSync(bytes.subarray(start, descriptor), { maxOutputLength: Math.max(1, size), info: true });
		assert.equal(inflated.engine.bytesWritten, packed);
		assert.equal(inflated.buffer.length, size); assert.equal(crc32(inflated.buffer), bytes.readUInt32LE(central + 16));
		files.set(name, inflated.buffer);
		local = descriptor + 16; central += 46 + nameSize;
	}
	assert.equal(local, centralStart); assert.equal(central, end);
	return files;
};
