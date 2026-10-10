/**
 * Authenticate the original installed probe archive without reading its recorded absolute paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpWasmSubtypeEntryInstalledArchive = "docs/evidence/php-wasm-subtype-entry-installed-20261010";
export const phpWasmSubtypeEntryInstalledIndexSha256 = "08afa6ca8e2e68fb8461c62e6834f6388b95482d700c5f901617fa47458c6939";

/**
 * Require the fixed original index and every recorded byte identity.
 *
 * @param read - Reader of archive-relative paths; substitution supports corruption controls.
 */
export const readPhpWasmSubtypeEntryInstalledArchive = async (read = path => readFile(join(phpWasmSubtypeEntryInstalledArchive, path))) => {
	const indexBytes = await read("index.json"); assert.equal(sha256(indexBytes), phpWasmSubtypeEntryInstalledIndexSha256);
	const index = JSON.parse(indexBytes); assert.equal(index.producer, "7f3ae5573d224153ce9f182f13833760d7196301");
	assert.equal(index.files.length, 109); assert.equal(new Set(index.files.map(file => file.path)).size, 109);
	const records = new Map([["index.json", indexBytes]]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && file.path.split("/").every(part => part && part !== "." && part !== ".."));
		const bytes = await read(file.path); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		records.set(file.path, bytes);
	}
	const start = JSON.parse(records.get("run/start.json")), end = JSON.parse(records.get("run/end.json"));
	assert.equal(start.revision, index.producer); assert.equal(start.runnerSha256, sha256(records.get("run/runner.mjs.txt")));
	assert.deepEqual([end.code, end.signal, end.stoppedForDisk], [0, null, false]); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(end.tapSha256, sha256(records.get("run/tap")));
	const verified = JSON.parse(records.get("run/verified.json")); assert.equal(verified.revision, index.producer);
	assert.deepEqual(verified.reports.map(item => item.route), ["ordinary", "reviewed"]);
	for(const item of verified.reports) assert.equal(item.sha256, sha256(records.get(`r1/${item.route}/report.json`)));
	return { index, records };
};
