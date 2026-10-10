/**
 * Authenticate the original installed record/variant alias supplement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinRecordAliasReport } from "./fin-record-alias-report.mjs";

export const finRecordAliasArchiveRoot = "docs/evidence/fin-record-alias-native-20261010";
const revision = "b8765be7c642fd7ba3349c8cc90a3857a7118b26";

/**
 * Check archived bytes, producer identity, both routes and reconstructed package receipts.
 *
 * @param digest - Independently pinned archive index SHA-256.
 * @param read - File reader, replaceable for corruption controls.
 */
export const assertFinRecordAliasArchive = async (digest, read = readFile) => {
	const root = finRecordAliasArchiveRoot, indexBytes = await read(`${root}/index.json`);
	assert.equal(sha256(indexBytes), digest);
	const index = JSON.parse(indexBytes);
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "fin-record-alias-local-acceptance");
	assert.equal(index.outcome, "passed"); assert.equal(index.producer.revision, revision);
	assert.deepEqual(index.profiles, ["c", "cpp"]); assert.equal(index.hostGlibc, "glibc 2.36");
	assert.equal(index.files.length, 24);
	assert.equal(new Set(index.files.map(file => file.path)).size, 24);
	const files = new Map();
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && file.path.split("/").every(part => part && part !== "." && part !== ".."));
		const bytes = await read(`${root}/${file.path}`);
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const json = name => JSON.parse(files.get(name));
	const start = json("start.json"), end = json("end.json"), verified = json("verified.json");
	assert.equal(start.revision, revision); assert.equal(start.tree, index.producer.tree);
	assert.deepEqual(start.profiles, ["c", "cpp"]);
	assert.equal(start.glibc, "glibc 2.36"); assert.equal(start.node, "v22.23.2");
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.environment.LEAN_BRIDGE_FIN_RECORD_ALIAS_PROFILES, "c,cpp");
	assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
	assert.equal(end.tapSha256, sha256(files.get("run.tap")));
	assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.ok(end.minimumFreeMiB >= start.stopFloorMiB);
	assert.ok(Date.parse(end.endedAt) >= Date.parse(start.startedAt));
	assert.ok(Date.parse(verified.verifiedAt) >= Date.parse(end.endedAt));
	assert.match(files.get("run.tap").toString(), /# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.equal(verified.revision, revision); assert.deepEqual(verified.profiles, ["c", "cpp"]);
	assert.deepEqual(verified.checksPerConsumer, { c: 2064, cpp: 2053 });
	for(const file of index.files.filter(item => item.path.startsWith("sources/")))
		assert.equal(file.sha256, start.sources[file.path.slice("sources/".length)]);
	for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-ir"]])
	{
		assert.equal(verified.receipts[name], sha256(files.get(name)));
		assertFinRecordAliasReport(json(name), route, start.sources);
	}
	return { index, files, start };
};
