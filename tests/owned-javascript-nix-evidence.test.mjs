/**
 * Keep real Nix acceptance source-bound and all predecessor receipts immutable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedWitNative, ownedWitNativeHistoricalBytes } from "./helpers/wit-owned-native-history.mjs";
import { assertOwnedJavaScriptNixCi, assertOwnedJavaScriptNixExecution
	, ownedJavaScriptNixTests } from "./helpers/owned-javascript-nix-evidence.mjs";
import { beforeOwnedJavaScriptNix, ownedJavaScriptNixAddedPaths
	, ownedJavaScriptNixBaseline, ownedJavaScriptNixChangedPaths
	, ownedJavaScriptNixPath, ownedJavaScriptNixPrevious
	, reverseOwnedJavaScriptNixUpdate } from "./helpers/owned-javascript-nix-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJavaScriptNixPath, "utf8"));

test("real Nix successor authenticates every change without promoting type coverage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-nix");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptNixBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptNixPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedJavaScriptNixAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedWitNativeHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptNixChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedWitNative(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(beforeOwnedJavaScriptNix(update.path, current)), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptNix(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedWitNative("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedJavaScriptNix("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedWitNativeHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior);
});

test("real Nix history rejects unknown text, altered predecessors and overlapping spans", async () => {
	for(const update of (await read()).updates)
	{
		const current = beforeOwnedWitNative(update.path, await readFile(update.path, "utf8")), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeOwnedJavaScriptNix(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptNixUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptNixUpdate(current, changed));
	}
});

test("real Nix evidence requires both installed source paths and complete execution", async () => {
	assertOwnedJavaScriptNixExecution(await read());
});

test("real Nix evidence rejects skipped checks, injection and unsupported claims", async () => {
	const original = await read();
	const rewrite = (record, before, after) => {
		const run = record.runs.installed, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const mutate of [
		record => { record.scope.osSandboxIsolation = true; }
		, record => { record.scope.dockerExecution = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredBorrowedResults = true; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.runs.installed.exitCode = 1; }
		, record => { record.runs.installed.text += "unrecorded"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"reviewed":true', '"reviewed":false')
		, ...["unusableHostSdk", "sourceUnchanged", "installedOffline"
			, "producerRemoved", "nestedResources", "callbackBorrowExpiry"
			, "returnedClosure", "callbackException"]
			.map(key => record => rewrite(record, `"${key}":true`, `"${key}":false`))
		, record => rewrite(record, '"injectedTransport":false', '"injectedTransport":true')
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedJavaScriptNixExecution(changed), undefined, mutate.toString());
	}
});

test("real Nix installed CI is enabled, observable and required", async () => {
	assertOwnedJavaScriptNixCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("real Nix CI rejects disabled tests, swallowed failures and missing observations", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const execute = "      - name: Build and install owned npm exports through real Nix\n";
	for(const [before, after] of [
		...ownedJavaScriptNixTests.map(path => [path, ""])
		, ["  node-consumers:\n", "  node-consumers:\n    if: false\n"]
		, [execute, execute + "        if: false\n"]
		, [execute, execute + "        continue-on-error: true\n"]
		, ['          LEAN_BRIDGE_OWNED_JS_NIX_TEST: "1"', '          LEAN_BRIDGE_OWNED_JS_NIX_TEST: "0"']
		, ['          LEAN_BRIDGE_NIX_TOOLCHAIN_TEST: "1"', '          LEAN_BRIDGE_NIX_TOOLCHAIN_TEST: "0"']
		, ["tee build/owned-nix-installed.log\n", "tee build/owned-nix-installed.log || true\n"]
		, ...["pass 7", "fail 0", "skipped 0"].map(value => [`          rg '^# ${value}$' build/owned-nix-installed.log\n`, ""])
		, ["xz-utils zstd ripgrep", "xz-utils zstd"]
		, ["rg '^# pass 7$' build/owned-nix-installed.log", "rg '^# pass 5$' build/owned-nix-installed.log"]
		, ["          path: build/owned-nix-installed.log\n", ""]
		, ["      - name: Preserve real Nix owned npm acceptance\n        if: always()", "      - name: Preserve real Nix owned npm acceptance\n        if: false"]
		, ["      - name: Install archive acceptance tools\n", "      - name: Install archive acceptance tools\n        if: false\n"]
		, ["      - name: Install archive acceptance tools\n        timeout-minutes: 20\n", "      - name: Install archive acceptance tools\n"]
		, ["      - name: Install archive acceptance tools\n        timeout-minutes: 20\n", "      - name: Install archive acceptance tools\n        timeout-minutes: 240\n"]
		, ["      - node-consumers\n", ""]
		, ["if: needs.node-consumers.result != 'success'", "if: false"]
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedJavaScriptNixCi(changed), before);
	}
});
