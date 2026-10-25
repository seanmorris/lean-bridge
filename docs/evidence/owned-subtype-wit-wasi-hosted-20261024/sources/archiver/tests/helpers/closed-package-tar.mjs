/**
 * Inspect the complete deterministic ustar gzip format emitted by the release archivers, in memory.
 * No member is extracted, linked or executed: every header, name, type, size and padding is validated
 * before any byte is returned, and only regular files below one exact distribution root are accepted.
 *
 * @file
 */
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

const BLOCK = 512;

/**
 * Read every regular file below the root, rejecting links, special entries, traversal, duplicates,
 * inconsistent headers, nonzero padding, trailing data and unbounded expansion.
 * This deliberately accepts only the repository's fixed-epoch ustar format.
 *
 * @param bytes - Original compressed archive bytes.
 * @param options - Exact root and bounds.
 * @param options.root - The single top-level directory every member must sit below.
 * @param options.epoch - The fixed entry timestamp the producer used.
 * @param options.maxInput - Largest accepted compressed archive.
 * @param options.maxBytes - Largest accepted expanded archive and total member size.
 * @param options.maxMembers - Largest accepted member count.
 */
export const readClosedPackageTarGz = (bytes, { root, epoch = 1, maxInput = 256 * 1024 ** 2, maxBytes = 512 * 1024 ** 2, maxMembers = 4096 }) => {
	assert.ok(Buffer.isBuffer(bytes) && bytes.length > 18 && bytes.length <= maxInput, "tar.gz input bounds");
	assert.ok(typeof root === "string" && /^[A-Za-z0-9_.+-]+$/u.test(root) && root !== "." && root !== "..", "safe tar root");
	assert.ok(Number.isSafeInteger(epoch) && epoch >= 1);
	const inflated = gunzipSync(bytes, { maxOutputLength: maxBytes, info: true });
	assert.equal(inflated.engine.bytesWritten, bytes.length, "no trailing gzip data");
	const tar = inflated.buffer;
	assert.ok(tar.length >= 2 * BLOCK && tar.length % BLOCK === 0, "tar block alignment");
	const files = new Map();
	let offset = 0, total = 0, ended = false;
	const zero = (start, end) => tar.subarray(start, end).every(byte => byte === 0);
	const text = (start, length) => {
		const field = tar.subarray(offset + start, offset + start + length), end = field.indexOf(0);
		if(end >= 0) assert.ok(field.subarray(end).every(byte => byte === 0), "zero-padded tar field");
		const value = (end < 0 ? field : field.subarray(0, end)).toString("utf8");
		assert.deepEqual(Buffer.from(value, "utf8"), end < 0 ? field : field.subarray(0, end), "UTF-8 tar field");
		return value;
	};
	const octal = (start, length) => {
		const field = tar.subarray(offset + start, offset + start + length).toString("latin1");
		assert.match(field, new RegExp(`^[0-7]{${length - 1}}\0$`, "u"), "deterministic octal tar field");
		return parseInt(field.slice(0, -1), 8);
	};
	while(offset < tar.length)
	{
		assert.ok(offset + BLOCK <= tar.length, "tar header bounds");
		if(zero(offset, offset + BLOCK))
		{
			assert.equal(tar.length - offset, 2 * BLOCK, "exactly two zero end-of-archive blocks");
			assert.ok(zero(offset, tar.length), "zero end-of-archive blocks");
			offset = tar.length; ended = true; break;
		}
		assert.ok(files.size < maxMembers, "tar member limit");
		const header = tar.subarray(offset, offset + BLOCK);
		let sum = 0;
		for(let index = 0; index < BLOCK; index++) sum += index >= 148 && index < 156 ? 0x20 : header[index];
		const checksum = header.subarray(148, 156).toString("latin1");
		assert.match(checksum, /^[0-7]{6}\0 $/u, "deterministic tar checksum field");
		assert.equal(parseInt(checksum.slice(0, 6), 8), sum, "tar header checksum");
		assert.equal(header.subarray(257, 265).toString("latin1"), "ustar\x0000", "ustar magic and version");
		assert.equal(header[156], 0x30, "regular tar file");
		// The writer never sets link, owner names, device numbers or the header tail.
		for(const [start, length] of [[157, 100], [265, 32], [297, 32], [329, 8], [337, 8], [500, 12]])
			assert.ok(zero(offset + start, offset + start + length), "empty tar link, owner, device and tail fields");
		for(const start of [108, 116]) assert.equal(octal(start, 8), 0, "root-owned tar entry");
		assert.ok([0o644, 0o755].includes(octal(100, 8)), "tar mode");
		assert.equal(octal(136, 12), epoch, "fixed tar timestamp");
		const size = octal(124, 12), name = text(0, 100), prefix = text(345, 155);
		assert.ok(name.length > 0, "named tar member");
		const path = prefix ? `${prefix}/${name}` : name, parts = path.split("/");
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path), `safe tar member name ${path}`);
		assert.ok(parts.every(part => !["", ".", ".."].includes(part)), `safe tar path ${path}`);
		assert.ok(parts.length >= 2 && parts[0] === root, `tar member inside ${root}/: ${path}`);
		const relative = parts.slice(1).join("/");
		assert.ok(!files.has(relative), `duplicate tar path ${relative}`);
		total += size; assert.ok(total <= maxBytes, "tar expanded size limit");
		const dataStart = offset + BLOCK, dataEnd = dataStart + size, padded = dataStart + Math.ceil(size / BLOCK) * BLOCK;
		assert.ok(padded <= tar.length, "tar data bounds");
		assert.ok(zero(dataEnd, padded), "zero tar data padding");
		files.set(relative, Buffer.from(tar.subarray(dataStart, dataEnd)));
		offset = padded;
	}
	assert.ok(ended && offset === tar.length, "tar end-of-archive blocks");
	assert.ok(files.size > 0, "empty tar archive");
	for(const path of files.keys())
	{
		const parts = path.split("/");
		for(let index = 1; index < parts.length; index++)
			assert.ok(!files.has(parts.slice(0, index).join("/")), "tar file/directory conflict");
	}
	return files;
};
