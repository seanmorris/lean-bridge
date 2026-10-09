/**
 * Bind the four immutable reports to exact members of the original GitHub artifact ZIPs.
 * Only the two SHA-pinned single-disk, deflated, descriptor-bearing ZIP layouts are admitted.
 * No archive member is written to disk or executed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { sha256 } from "../../src/capsule/node.mjs";

// Match the existing package ZIP reader without requiring node:zlib.crc32 (added after Node 22.0).
const crcTable = Array.from({ length: 256 }, (_, value) => {
	for(let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
	return value >>> 0;
});
const crc32 = bytes => {
	let crc = 0xffffffff;
	for(const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
	return (crc ^ 0xffffffff) >>> 0;
};

const base = "docs/evidence/python-rust-container-dispatch-20261009";
export const hostedContainerMembershipPath = `${base}/artifact-membership.json`;
export const hostedContainerMembership = {
	schemaVersion: 1
	, kind: "hosted-container-artifact-membership"
	, receipt: {
		path: "docs/evidence/python-rust-container-dispatch-20261009/receipt.json"
		, sha256: "4b943a755f29af54ccef6fb59d4973f88470db78c08b520928734bbb998882e1"
	}
	, artifacts: [{
		path: "docs/evidence/python-rust-container-dispatch-20261009/python.zip"
		, originalPath: "build/vo1436-hosted-container-dispatch-93c60a0/python.zip"
		, bytes: 993757
		, sha256: "461d3e810c8bee043e7f498206f030ec9a18b4d79ca6636896d2b150f5a93b08"
	}
	, {
		path: "docs/evidence/python-rust-container-dispatch-20261009/rust.zip"
		, originalPath: "build/vo1436-hosted-container-dispatch-93c60a0/rust.zip"
		, bytes: 841995
		, sha256: "00290557169f1c38a67ba1d06208dbd048912b90d77a336b11a8e74f9c143a9b"
	}
	, {
		path: "docs/evidence/python-rust-container-dispatch-20261009/capture.json"
		, originalPath: "build/vo1436-hosted-container-dispatch-93c60a0/capture.json"
		, bytes: 549
		, sha256: "34744e2b5b7dd4cc1e97a8fd2a3995846ed7b568d06eb83ef285a502990a6087"
	}]
	, members: [{
		archive: "docs/evidence/python-rust-container-dispatch-20261009/python.zip"
		, member: "native-fin-containers/python.json"
		, report: "docs/evidence/python-rust-container-dispatch-20261009/python-container-0.json"
	}
	, {
		archive: "docs/evidence/python-rust-container-dispatch-20261009/python.zip"
		, member: "native-fin-containers/reviewed-python.json"
		, report: "docs/evidence/python-rust-container-dispatch-20261009/python-container-1.json"
	}
	, {
		archive: "docs/evidence/python-rust-container-dispatch-20261009/rust.zip"
		, member: "native-fin-containers/rust.json"
		, report: "docs/evidence/python-rust-container-dispatch-20261009/rust-container-0.json"
	}
	, {
		archive: "docs/evidence/python-rust-container-dispatch-20261009/rust.zip"
		, member: "native-fin-containers/reviewed-rust.json"
		, report: "docs/evidence/python-rust-container-dispatch-20261009/rust-container-1.json"
	}]
};
const captures = [{
	profile: "python"
	, id: 11596416341
	, sha256: "461d3e810c8bee043e7f498206f030ec9a18b4d79ca6636896d2b150f5a93b08"
	, selected: ["native-fin-containers/python.json", "native-fin-containers/reviewed-python.json"]
	, entries: 70
}
, {
	profile: "rust"
	, id: 11595796933
	, sha256: "00290557169f1c38a67ba1d06208dbd048912b90d77a336b11a8e74f9c143a9b"
	, selected: ["native-fin-containers/rust.json", "native-fin-containers/reviewed-rust.json"]
	, entries: 55
}];

/**
 * Read selected members after authenticating the complete original ZIP identity.
 *
 * @param bytes - Original ZIP bytes, bounded by its pinned size and digest.
 * @param descriptor - The fixed descriptor of either original ZIP.
 * @param selected - Exact report member names to retain in memory.
 */
export const readHostedContainerMembers = (bytes, descriptor, selected) => {
	assert.ok(hostedContainerMembership.artifacts.slice(0, 2).some(file => JSON.stringify(file) === JSON.stringify(descriptor)));
	assert.ok(Buffer.isBuffer(bytes)); assert.equal(bytes.length, descriptor.bytes); assert.equal(sha256(bytes), descriptor.sha256);
	assert.deepEqual(selected, hostedContainerMembership.members.filter(member => member.archive === descriptor.path).map(member => member.member));
	const end = bytes.length - 22;
	assert.equal(bytes.readUInt32LE(end), 0x06054b50); assert.equal(bytes.readUInt32LE(end + 4), 0);
	assert.equal(bytes.readUInt16LE(end + 20), 0);
	const count = bytes.readUInt16LE(end + 8), centralStart = bytes.readUInt32LE(end + 16);
	assert.equal(count, descriptor.path.endsWith("python.zip") ? 70 : 55);
	assert.equal(bytes.readUInt16LE(end + 10), count);
	assert.equal(centralStart + bytes.readUInt32LE(end + 12), end);
	let central = centralStart, local = 0;
	const paths = new Set(), found = new Map();
	for(let index = 0; index < count; index++)
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
		assert.ok(!name.startsWith("/") && !name.split("/").some(part => ["", ".", ".."].includes(part)) && !paths.has(name));
		paths.add(name);
		assert.equal(bytes.readUInt32LE(local), 0x04034b50);
		assert.deepEqual(bytes.subarray(local + 4, local + 14), bytes.subarray(central + 6, central + 16));
		assert.deepEqual(bytes.subarray(local + 14, local + 26), Buffer.alloc(12));
		assert.equal(bytes.readUInt16LE(local + 26), nameSize); assert.equal(bytes.readUInt16LE(local + 28), 0);
		assert.deepEqual(bytes.subarray(local + 30, local + 30 + nameSize), nameBytes);
		const start = local + 30 + nameSize, descriptorStart = start + packed;
		assert.ok(descriptorStart + 16 <= centralStart);
		assert.equal(bytes.readUInt32LE(descriptorStart), 0x08074b50);
		assert.deepEqual(bytes.subarray(descriptorStart + 4, descriptorStart + 16), bytes.subarray(central + 16, central + 28));
		if(selected.includes(name))
		{
			assert.ok(size > 0 && size < 16384, "selected reports have bounded uncompressed size");
			const source = inflateRawSync(bytes.subarray(start, descriptorStart), { maxOutputLength: size });
			assert.equal(source.length, size); assert.equal(crc32(source), bytes.readUInt32LE(central + 16));
			found.set(name, source);
		}
		local = descriptorStart + 16; central += 46 + nameSize;
	}
	assert.equal(local, centralStart); assert.equal(central, end);
	assert.deepEqual([...found.keys()].sort(), [...selected].sort());
	return found;
};

/**
 * Authenticate the supplement, preserve the old receipt and compare each report with its real ZIP member.
 *
 * @param supplement - Parsed membership supplement.
 * @param read - Immutable archive reader, injectable for corruption controls.
 */
export const assertHostedContainerMembership = async (supplement, read = readFile) => {
	assert.deepEqual(supplement, hostedContainerMembership, "fixed supplement paths and identities before any read");
	const receipt = await read(supplement.receipt.path); assert.equal(sha256(receipt), supplement.receipt.sha256);
	const originals = JSON.parse(receipt), files = new Map();
	for(const descriptor of supplement.artifacts)
	{
		const bytes = await read(descriptor.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, descriptor.bytes); assert.equal(sha256(bytes), descriptor.sha256); files.set(descriptor.path, bytes);
	}
	assert.deepEqual(JSON.parse(files.get(`${base}/capture.json`)), captures);
	for(const descriptor of supplement.artifacts.slice(0, 2))
	{
		const members = supplement.members.filter(member => member.archive === descriptor.path);
		const actual = readHostedContainerMembers(files.get(descriptor.path), descriptor, members.map(member => member.member));
		for(const member of members)
		{
			const report = await read(member.report), original = originals.artifacts.find(file => file.path === member.report);
			assert.ok(original); assert.equal(report.length, original.bytes); assert.equal(sha256(report), original.sha256);
			assert.ok(report.equals(actual.get(member.member)), `${member.report} is the exact selected ZIP member`);
		}
	}
	return supplement;
};
