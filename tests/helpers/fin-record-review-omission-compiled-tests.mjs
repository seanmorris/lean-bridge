/**
 * Retain the actual fresh-Lean omission run separately from installed-package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";

const directory = "docs/evidence/fin-record-review-omission-compiled-20261010";
const revision = "179d385755cda5908cdc63dd4cc5a39989acbbad";
const archived = path => readFile(directory + "/" + path);
const index = async () => {
	const bytes = await archived("index.json");
	assert.equal(sha256(bytes), "2c1fb12ede6a0eada6b5606375fa75c5d4e7426de545c70dc3284171fef79f1e");
	const result = JSON.parse(bytes);
	assert.equal(result.kind, "fresh-lean-record-review-omission");
	assert.deepEqual(result.producer, { revision, tree: "4d5a5d11b42491ef3692792aef6f8cd55a78de4b" });
	assert.equal(result.cases, 7); assert.equal(result.files.length, 22);
	assert.equal(new Set(result.files.map(file => file.path)).size, 22);
	assert.equal(result.files.filter(file => file.path.startsWith("sources/")).length, 15);
	return result;
};
const authenticate = async (file, read = archived) => {
	assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
	const bytes = await read(file.path);
	assert.deepEqual([bytes.length, sha256(bytes)], [file.bytes, file.sha256], file.path);
	return bytes;
};

test("compiled record review archive retains all seven unskipped fresh-Lean refusals", async () => {
	const receipt = await index();
	for(const file of receipt.files) await authenticate(file);
	const start = JSON.parse(await archived("start.json")), end = JSON.parse(await archived("end.json"));
	const verified = JSON.parse(await archived("verified.json")), tap = await archived("run.tap");
	assert.equal(start.revision, revision); assert.equal(verified.revision, revision);
	assert.equal(start.tree, receipt.producer.tree); assert.equal(verified.cases, 7);
	assert.equal(start.environment.LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES, "c");
	assert.match(start.environment.LEAN_BRIDGE_LEAN_PREFIX, /leanprover--lean4---v4\.32\.2$/u);
	assert.ok(start.args.includes("tests/native-fin-records.test.mjs"));
	assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.stoppedForDisk], [0, null, false]);
	assert.equal(end.tapSha256, sha256(tap)); assert.equal(verified.tapSha256, sha256(tap));
	assert.ok(Date.parse(start.startedAt) <= Date.parse(end.endedAt));
	assert.ok(Date.parse(end.endedAt) <= Date.parse(verified.verifiedAt));
	for(const [name, count] of [["tests", 8], ["pass", 8], ["fail", 0], ["skipped", 0], ["cancelled", 0]])
		assert.equal(Number(tap.toString().match(new RegExp("^# " + name + " (\\d+)$", "m"))?.[1]), count);
	const names = [
		"tightened field", "bound moved to the other field"
		, "loosened nested record's own bound", "tightened case field"
		, "loosened Fin 0 case", "omitted record bounds", "omitted variant bounds"
	];
	assert.deepEqual([...tap.toString().matchAll(/^ {4}ok \d+ - (.+)$/gmu)].map(match => match[1]), names);
	for(const file of receipt.files.filter(file => file.path.startsWith("sources/")))
		assert.equal(file.original, "git:" + revision + ":" + file.path.slice("sources/".length, -".txt".length));
});

test("compiled record review archive refuses altered execution and source records", async () => {
	const receipt = await index();
	const paths = [
		"run.tap", "start.json", "end.json", "verified.json"
		, "sources/tests/native-fin-records.test.mjs.txt"
		, "sources/tests/helpers/fin-fixture-installed.mjs.txt"
	];
	for(const path of paths)
	{
		const file = receipt.files.find(file => file.path === path); assert.ok(file);
		await assert.rejects(authenticate(file, async () => Buffer.concat([await archived(path), Buffer.from("\n")])), assert.AssertionError);
	}
});
