/**
 * Exercise original ZIP retention independently from hosted or route acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import {
	checkPhpWasmEntryHostedArtifactBytes, checkPhpWasmEntryStoredIndex
	, inspectPhpWasmEntryStoredZip, retainPhpWasmEntryHostedArtifact
} from "./php-wasm-refinement-entry-hosted-storage.mjs";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-byte-tests-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const directory = join(root, "original"); await mkdir(directory);
	for(const prefix of ["aa", "bb"]) await mkdir(join(directory, prefix));
	await writeFile(join(directory, "aa/aaa"), "original bytes\n");
	await writeFile(join(directory, "bb/bbb"), "");
	await writeFile(join(directory, "binary"), Buffer.alloc(256 * 1024, 0xa5));
	const bytes = await createDeterministicZip({ directory, sourceDateEpoch: 315532800 });
	const zip = join(root, "original.zip"); await writeFile(zip, bytes);
	return { root, zip, bytes, destination: join(root, "retained") };
};
const centralEntries = bytes => {
	const end = bytes.length - 22, entries = [];
	let offset = bytes.readUInt32LE(end + 16);
	while(offset < end)
	{
		assert.equal(bytes.readUInt32LE(offset), 0x02014b50); entries.push(offset);
		offset += 46 + bytes.readUInt16LE(offset + 28)
			+ bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
	}
	assert.equal(offset, end); return entries;
};

test("PHP-Wasm artifact storage reconstructs original ZIP and every extracted byte", async t => {
	const { root, zip, bytes, destination } = await fixture(t);
	const index = await retainPhpWasmEntryHostedArtifact(zip, destination);
	assert.equal(index.scope, "original-zip-and-output-bytes-only");
	assert.equal(index.zip.sha256, sha256(bytes)); assert.equal(index.zip.bytes, bytes.length);
	assert.equal(index.output.length, 3);
	assert.deepEqual(await readFile(join(destination, "zip/0000.part")), bytes);
	assert.deepEqual(await readFile(zip), bytes);
	const checked = await checkPhpWasmEntryHostedArtifactBytes(destination);
	assert.equal(checked.files, 3); assert.equal(checked.zip.sha256, index.zip.sha256);
	assert.equal(checked.outputBytes, 256 * 1024 + 15);
	const again = await retainPhpWasmEntryHostedArtifact(zip, join(root, "second"));
	assert.deepEqual(index, again);
});

test("PHP-Wasm artifact storage refuses unsafe ZIPs before creating output", async t => {
	const { root, bytes } = await fixture(t), entries = centralEntries(bytes);
	const mutations = [
		value => value.writeUInt32LE((0o120777 << 16) >>> 0, entries[0] + 38)
		, value => value.writeUInt16LE(value.readUInt16LE(entries[0] + 8) | 1, entries[0] + 8)
		, value => value.writeUInt32LE(300 * 1024 ** 2, entries[0] + 24)
		, value => Buffer.from("../aaa").copy(value, entries[0] + 46)
		, value => Buffer.from("aa/aaa").copy(value, entries[1] + 46)
		, value => { value[30 + value.readUInt16LE(26)] ^= 0xff; }
	];
	for(const [position, mutation] of mutations.entries())
	{
		const altered = Buffer.from(bytes); mutation(altered);
		const zip = join(root, `bad-${position}.zip`), destination = join(root, `bad-${position}`);
		await writeFile(zip, altered);
		await assert.rejects(inspectPhpWasmEntryStoredZip(zip));
		await assert.rejects(retainPhpWasmEntryHostedArtifact(zip, destination));
		assert.equal(existsSync(destination), false);
	}
});

test("PHP-Wasm artifact storage rejects malformed receipts and byte ranges", async t => {
	const { zip, destination } = await fixture(t);
	const index = await retainPhpWasmEntryHostedArtifact(zip, destination);
	for(const mutation of [
		value => { value.scope = "installed-support"; }
		, value => { value.extra = true; }
		, value => { value.zip.parts = []; }
		, value => { value.zip.parts[0].offset++; }
		, value => { value.zip.parts[0].bytes--; }
		, value => { value.zip.parts[0].path = "../outside"; }
		, value => { value.zip.sha256 = "not a digest"; }
		, value => { value.output.reverse(); }
		, value => { value.output.push(value.output[0]); }
		, value => { value.output[0].path = "output/../../outside"; }
		, value => { value.output[0].bytes = -1; }
	]) {
		const altered = structuredClone(index); mutation(altered);
		assert.throws(() => checkPhpWasmEntryStoredIndex(altered));
	}
});

test("PHP-Wasm artifact storage independently refuses forged output and missing files", async t => {
	const { zip, destination } = await fixture(t);
	const index = await retainPhpWasmEntryHostedArtifact(zip, destination);
	const original = await readFile(join(destination, index.output[0].path));
	const forged = Buffer.from(original); forged[0] ^= 1;
	await writeFile(join(destination, index.output[0].path), forged);
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(destination));
	const altered = structuredClone(index); altered.output[0].sha256 = sha256(forged);
	await writeFile(join(destination, "index.json"), canonicalJson(altered));
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(destination));
	await writeFile(join(destination, index.output[0].path), original);
	await writeFile(join(destination, "index.json"), canonicalJson(index));
	await writeFile(join(destination, "extra"), "unindexed\n");
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(destination));
	await rm(join(destination, "extra"));
	const part = await readFile(join(destination, "zip/0000.part")); part[0] ^= 1;
	await writeFile(join(destination, "zip/0000.part"), part);
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(destination));
	await rm(join(destination, "zip/0000.part"));
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(destination));
});

test("PHP-Wasm artifact storage preserves existing destinations and rejects symlinks", async t => {
	const { root, zip, destination } = await fixture(t);
	const index = await retainPhpWasmEntryHostedArtifact(zip, destination);
	await assert.rejects(retainPhpWasmEntryHostedArtifact(zip, destination));
	assert.equal(await readFile(join(destination, "index.json"), "utf8"), canonicalJson(index));
	await symlink(destination, join(root, "alias"));
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(join(root, "alias")));
	await assert.rejects(retainPhpWasmEntryHostedArtifact(zip, join(root, "alias/child")));
	const path = join(destination, index.output[0].path); await rm(path);
	await symlink(zip, path);
	await assert.rejects(checkPhpWasmEntryHostedArtifactBytes(destination));
});
