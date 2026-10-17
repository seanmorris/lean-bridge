/**
 * Compare original RubyGem payload bytes without loading Ruby or a gemspec.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { sha256 } from "../../src/capsule/node.mjs";

const zeros = bytes => bytes.every(byte => byte === 0);
const text = bytes => {
	const end = bytes.indexOf(0), content = end < 0 ? bytes : bytes.subarray(0, end);
	if(end >= 0) assert.ok(zeros(bytes.subarray(end)));
	assert.deepEqual(Buffer.from(content.toString("utf8")), content);
	return content.toString("utf8");
};
const octal = bytes => {
	const source = text(bytes); assert.match(source, /^[0-7]+$/u);
	const value = Number.parseInt(source, 8); assert.ok(Number.isSafeInteger(value)); return value;
};
const tarFiles = tar => {
	assert.equal(tar.length % 512, 0);
	const files = new Map(); let offset = 0;
	while(offset + 512 <= tar.length && !zeros(tar.subarray(offset, offset + 512)))
	{
		const header = tar.subarray(offset, offset + 512);
		const checksum = header.subarray(148, 156).toString("ascii"); assert.match(checksum, /^[0-7]{6}\0 $/u);
		assert.equal(Number.parseInt(checksum, 8), header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0));
		assert.equal(header[156], 48); assert.equal(header.subarray(257, 265).toString("ascii"), "ustar\0" + "00");
		assert.ok(zeros(header.subarray(157, 257))); assert.ok(zeros(header.subarray(500)));
		for(const [start, end] of [[108, 116], [116, 124], [329, 337], [337, 345]])
		{
			const field = header.subarray(start, end);
			assert.ok(zeros(field) || octal(field) === 0);
		}
		assert.equal(octal(header.subarray(136, 148)), 1);
		assert.ok([0o444, 0o644, 0o755, 0o100644, 0o100755].includes(octal(header.subarray(100, 108))));
		text(header.subarray(265, 297)); text(header.subarray(297, 329));
		const prefix = text(header.subarray(345, 500)), name = text(header.subarray(0, 100));
		const path = prefix ? prefix + "/" + name : name;
		assert.match(path, /^[A-Za-z0-9_.+/-]+$/u);
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(path), "Duplicate gem entry");
		const size = octal(header.subarray(124, 136)), end = offset + 512 + size;
		assert.ok(end <= tar.length); files.set(path, tar.subarray(offset + 512, end));
		offset += 512 + Math.ceil(size / 512) * 512;
		assert.ok(zeros(tar.subarray(end, offset)), "Nonzero gem padding");
	}
	assert.equal(tar.length - offset, 1024); assert.ok(zeros(tar.subarray(offset)));
	assert.ok(files.size > 0); return files;
};

/**
 * Authenticate both compressed members and all payload bytes against the receipt.
 * Gem metadata stays inert; the installer separately verifies RubyGems semantics.
 *
 * @param options - Original gem bytes and independently checked package inventory.
 * @param options.archive - Complete original .gem archive.
 * @param options.artifact - Package-set archive size and digest.
 * @param options.files - Complete member inventory including the receipt itself.
 * @param options.receiptBytes - Original canonical receipt bytes.
 */
export const checkInheritedCheckedRecordRubyArchive = ({ archive, artifact, files, receiptBytes }) => {
	assert.equal(archive.length, artifact.bytes); assert.equal(sha256(archive), artifact.sha256);
	const outer = tarFiles(archive);
	assert.deepEqual([...outer.keys()], ["metadata.gz", "data.tar.gz", "checksums.yaml.gz"]);
	const metadata = gunzipSync(outer.get("metadata.gz"), { maxOutputLength: 1024 ** 2 });
	assert.deepEqual(Buffer.from(metadata.toString("utf8")), metadata); assert.ok(metadata.length > 0);
	const checksumBytes = gunzipSync(outer.get("checksums.yaml.gz"), { maxOutputLength: 4096 });
	// Psych quotes a hexadecimal digest when its scalar heuristics treat the
	// leading digits as numeric. Both spellings encode the same exact digest.
	const lines = checksumBytes.toString("utf8").split("\n");
	const digest = (algorithm, name) =>
		createHash(algorithm.toLowerCase()).update(outer.get(name)).digest("hex");
	const section = algorithm => [
		algorithm + ":"
		, ...["metadata.gz", "data.tar.gz"].map(name => [name, digest(algorithm, name)])
	];
	const expected = ["---", ...section("SHA256"), ...section("SHA512"), ""];
	assert.equal(lines.length, expected.length);
	for(const [index, line] of lines.entries())
	{
		const item = expected[index];
		if(typeof item === "string") assert.equal(line, item);
		else assert.ok([`  ${item[0]}: ${item[1]}`, `  ${item[0]}: '${item[1]}'`].includes(line), line);
	}
	const payload = tarFiles(gunzipSync(outer.get("data.tar.gz"), { maxOutputLength: 512 * 1024 ** 2 }));
	assert.deepEqual([...payload.keys()].sort(), Object.keys(files).sort());
	assert.deepEqual(payload.get("lean-bridge/package-receipt.json"), receiptBytes);
	for(const [path, bytes] of payload)
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, files[path], path);
	return payload;
};
