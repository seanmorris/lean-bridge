/**
 * Keep private owned WIT execution source-bound without promoting installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedWitNativeCi, assertOwnedWitNativeExecution } from "./helpers/wit-owned-native-evidence.mjs";
import { beforeOwnedWitNative, ownedWitNativeAddedPaths
	, ownedWitNativeBaseline, ownedWitNativeChangedPaths, ownedWitNativePath
	, ownedWitNativePrevious, reverseOwnedWitNativeUpdate } from "./helpers/wit-owned-native-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitNativePath, "utf8"));

test("owned WIT native successor authenticates all sources and preserves installed classifications", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-native");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitNativeBaseline);
	assert.deepEqual(record.previous, ownedWitNativePrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedWitNativeAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitNativeChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(beforeOwnedWitNative(update.path, current)), update.previousSha256);
		assert.equal(beforeOwnedWitNative(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedWitNative("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "A private host cannot establish installed package support");
});

test("owned WIT native history rejects unknown text, forged ancestors and overlapping edits", async () => {
	for(const update of (await read()).updates)
	{
		const current = await readFile(update.path, "utf8"), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeOwnedWitNative(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitNativeUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitNativeUpdate(current, changed));
	}
});

test("owned WIT native evidence requires both compiled source paths and zero skipped checks", async () => {
	assertOwnedWitNativeExecution(await read());
});

test("owned WIT native evidence rejects leaks, omitted probes and unsupported claims", async () => {
	const original = await read();
	const rewrite = (record, before, after) => {
		assert.ok(record.runs.native.text.includes(before));
		record.runs.native.text = record.runs.native.text.replaceAll(before, after);
		record.runs.native.sha256 = sha256(record.runs.native.text);
	};
	for(const mutate of [
		...["hostCallbacks", "publicSession", "installedPackages", "transferredInputs", "anchoredBorrowedResults"]
			.map(key => record => { record.scope[key] = true; })
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.runs.native.exitCode = 1; }
		, record => { record.runs.native.text += "unrecorded"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"reviewed":true', '"reviewed":false')
		, record => rewrite(record, '"liveIdentities":0', '"liveIdentities":1')
		, record => rewrite(record, '"liveAllocations":0', '"liveAllocations":1')
		, record => rewrite(record, '"allocationFailures":6', '"allocationFailures":0')
		, record => rewrite(record, "rejected mutation: missing-output-lease", "")
		, record => rewrite(record, "rejected mutation: missing-pending-rollback", "")
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedWitNativeExecution(changed), undefined, mutate.toString());
	}
});

test("owned WIT native CI executes enabled probes and retains the complete log", async () => {
	assertOwnedWitNativeCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("owned WIT native CI rejects hidden failures and disabled or missing checks", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const execute = "      - name: Execute owned WIT conversions and compiled Lean imports\n";
	for(const [before, after] of [
		...['LEAN_BRIDGE_WIT_OWNED_CONVERSIONS_TEST', 'LEAN_BRIDGE_WIT_OWNED_NATIVE_TEST']
			.map(name => [`          ${name}: "1"`, `          ${name}: "0"`])
		, ...["tests/wit-owned-graph-conversions.test.mjs", "tests/wit-owned-native-host.test.mjs"].map(path => [path, ""])
		, ["  wasi-consumer:\n", "  wasi-consumer:\n    if: false\n"]
		, [execute, execute + "        if: false\n"]
		, [execute, execute + "        continue-on-error: true\n"]
		, ["tee build/wit-owned-native.log\n", "tee build/wit-owned-native.log || true\n"]
		, ...["pass 5", "fail 0", "skipped 0"].map(value => [`          rg '^# ${value}$' build/wit-owned-native.log\n`, ""])
		, ["          path: build/wit-owned-native.log\n", ""]
		, ["      - name: Preserve owned WIT native execution\n        if: always()", "      - name: Preserve owned WIT native execution\n        if: false"]
		, ["steps.owned_wit_native.outcome != 'success'", "false"]
		, ["      - wasi-consumer\n", ""]
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedWitNativeCi(changed), before);
	}
});
