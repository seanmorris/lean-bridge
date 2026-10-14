/**
 * Replay the hosted temporary-path failure without claiming a new hosted run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { assertNominalSubtypePhpWasmDirectory } from "./nominal-subtype-php-wasm-directory.mjs";
import { checkNominalSubtypePhpWasmCiRecords } from "./nominal-subtype-php-wasm-ci-report.mjs";
import { checkNominalSubtypePhpWasmReport } from "./nominal-subtype-php-wasm-report.mjs";

const root = "docs/evidence/nominal-subtype-php-wasm-temp-path-20261014";
const indexSha256 = "41c707a2870486ec324766515371c4594ff7a8f562f8473088b765053e90c082";
const producerCommit = "d4dd322f1e61c52a6505fbaa9294ee3d19cc0a33";
const prefix = "artifact/nominal-subtype-php-wasm-ci/ordinary/full/";
const suffix = "lean-bridge-nominal-php-wasm-installed-Ab12Cd";
const parents = ["/tmp/", "/var/tmp/", "/home/runner/work/_temp/", "/tmp/custom parent/", "/tmp/λ/"];
const invalid = [undefined, null, false, 1, {}, [], "", suffix
	, "tmp/" + suffix, "//tmp/" + suffix
	, "/tmp//" + suffix, "/tmp/./" + suffix, "/tmp/../" + suffix
	, "/tmp/" + suffix + "/", "/tmp/" + suffix + "/consumer"
	, "/tmp/other-Ab12Cd", "/tmp/lean-bridge-nominal-php-wasm-installed-"
	, "/tmp/" + suffix + "!", "C:\\tmp\\" + suffix, "/tmp\\bad/" + suffix
	, ...[0, 1, 9, 10, 13, 31, 127].map(code => "/tmp/" + String.fromCharCode(code) + "/" + suffix)];
const load = async () => {
	const bytes = await readFile(root + "/index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.kind, "nominal-php-wasm-hosted-temp-path-failure-v1");
	assert.equal(index.producerCommit, producerCommit); assert.equal(index.files.length, 66);
	for(const entry of index.files)
	{
		assert.ok(/^[A-Za-z0-9_@.+/-]+$/u.test(entry.path) && !entry.path.startsWith("/") && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(entry.path)); const original = await readFile(root + "/" + entry.path);
		assert.equal(original.length, entry.bytes); assert.equal(sha256(original), entry.sha256); files.set(entry.path, original);
	}
	const recordPrefix = prefix + "records/ordinary/full/";
	const records = new Map([...files].filter(([path]) => path.startsWith(recordPrefix)).map(([path, value]) => [path.slice(recordPrefix.length), value]));
	return { index, files, records };
};

test("nominal PHP-Wasm accepts configured canonical temporary parents and rejects malformed paths", () => {
	for(const parent of parents) assertNominalSubtypePhpWasmDirectory(parent + suffix);
	for(const directory of invalid) assert.throws(() => assertNominalSubtypePhpWasmDirectory(directory), JSON.stringify(directory));
	assert.equal(parents.length, 5); assert.equal(invalid.length, 27);
});

test("nominal PHP-Wasm replays the original failed hosted job with its non-tmp directory", async t => {
	const { index, files, records } = await load();
	assert.deepEqual(await nativeArtifactPaths(root), [...files.keys(), "index.json"].sort());
	assert.deepEqual(index.selected, { route: "ordinary", mode: "full" });
	assert.equal(index.attemptedSelections, 1); assert.equal(index.requiredSelections, 4);
	assert.equal(index.originalJobConclusion, "failure"); assert.equal(index.fullHostedAcceptance, false);
	const job = JSON.parse(files.get("job.json")), artifact = JSON.parse(files.get("artifact.json"));
	assert.equal(job.id, index.jobId); assert.equal(job.run_id, index.runId);
	assert.equal(job.head_sha, producerCommit); assert.equal(job.conclusion, "failure");
	assert.equal(artifact.id, index.artifactId); assert.equal(artifact.workflow_run.head_sha, producerCommit);
	assert.equal(artifact.digest, "sha256:" + sha256(files.get("original-artifact.zip")));
	const log = gunzipSync(files.get("job.log.gz")).toString();
	assert.ok(log.includes("AssertionError [ERR_ASSERTION]"));
	const context = JSON.parse(records.get("context.json"));
	assert.equal(context.directory, "/home/runner/work/_temp/lean-bridge-nominal-php-wasm-installed-1Xc05D");
	assert.throws(() => assert.match(context.directory, /^\/tmp\/lean-bridge-nominal-php-wasm-installed-[A-Za-z0-9]+$/u));
	assert.ok(log.includes(context.directory)); assert.ok(files.get(prefix + "check.log").toString().includes(context.directory));
	assert.deepEqual(files.get(prefix + "runtime-before.json"), files.get(prefix + "runtime-after.json"));
	const options = { route: "ordinary", mode: "full", producer: producerCommit
		, directory: "retained-records", tap: "retained-tap"
		, runtime: "retained-runtime" };
	const input = {
		tap: files.get(prefix + "run.tap").toString()
		, runtime: JSON.parse(files.get(prefix + "runtime-before.json"))
		, paths: [...records.keys()].sort()
		, read: async path => { assert.ok(records.has(path)); return records.get(path); }
	};
	const checked = await checkNominalSubtypePhpWasmCiRecords(options, input);
	assert.equal(checked.executions, 12); assert.equal(checked.records.length, 50);
	assert.deepEqual(checked.counts, { checks: 4254, rejections: 1032, hostRejections: 20, snapshotControls: 8, word_bits: 32, php: "8.4.1" });
	assert.equal(checked.dispatchObserved, false);
	t.diagnostic("Original ordinary/full installed execution passed; its hosted job failed in path validation. This report replay is not a new execution or a four-selection hosted success.");
});

test("nominal PHP-Wasm retains exact consumer and handoff relationships for configurable temporary parents", async t => {
	const { records } = await load(), context = JSON.parse(records.get("context.json"));
	const check = value => checkNominalSubtypePhpWasmReport(async path => path === "context.json" ? Buffer.from(canonicalJson(value)) : records.get(path), { route: "ordinary", mode: "full", producerCommit });
	for(const parent of parents)
	{
		const directory = parent + suffix;
		await check({ ...context, directory, consumer: directory + "/consumer", handoff: directory + "/consumer/handoff" });
	}
	for(const directory of invalid) await assert.rejects(check({ ...context, directory }));
	const mutations = [value => { value.consumer = "/different/consumer"; }
		, value => { value.consumer += "/"; }
		, value => { value.consumer += "/../consumer"; }
		, value => { value.handoff = "/different/handoff"; }
		, value => { value.handoff += "/"; }
		, value => { value.handoff += "/../handoff"; }
		, value => { delete value.consumer; }
		, value => { delete value.handoff; }
		, value => { value.directory = "/var/tmp/" + suffix; }
		, value => { value.consumer = context.directory + "/../consumer"; value.handoff = value.consumer + "/handoff"; }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(context); mutate(changed); await assert.rejects(check(changed));
	}
	t.diagnostic(`${parents.length} synthetic parent substitutions accepted; ${invalid.length} malformed directories and ${mutations.length} broken context relationships refused. No historical paths were reopened.`);
});
