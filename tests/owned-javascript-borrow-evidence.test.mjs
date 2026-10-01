/**
 * Authenticate source history and reject incomplete borrowed-result evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedJavaScriptBorrowExecution } from "./helpers/owned-javascript-borrow-evidence.mjs";
import { beforeOwnedWitBorrow, ownedWitBorrowHistoricalBytes } from "./helpers/wit-owned-borrow-history.mjs";
import { ownedJavaScriptBorrowPath, ownedJavaScriptBorrowBaseline, ownedJavaScriptBorrowPrevious
	, ownedJavaScriptBorrowChangedPaths, ownedJavaScriptBorrowAddedPaths
	, beforeOwnedJavaScriptBorrow, reverseOwnedJavaScriptBorrowUpdate } from "./helpers/owned-javascript-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJavaScriptBorrowPath, "utf8"));

test("JavaScript borrowed results preserve every predecessor receipt and support cell", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptBorrowBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJavaScriptBorrowAddedPaths].sort());
	for(const [path, identity] of Object.entries(record.sources)) assert.equal(sha256(ownedWitBorrowHistoricalBytes(path, await readFile(path), identity)), identity, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedWitBorrow(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedJavaScriptBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded edit */\n";
		assert.equal(beforeOwnedJavaScriptBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedWitBorrow(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedJavaScriptBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedWitBorrowHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior, "Source refresh must not promote unrelated support cells");
	for(const name of ["owned-javascript-borrows"
		, "owned-javascript-borrow-evidence"
		, "owned-javascript-borrow-package", "owned-javascript-borrow-packaging"
		, "owned-javascript-borrow-coexistence", "owned-javascript-borrow-mutants"
		, "owned-wasm-borrow-registry"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("JavaScript borrowed-result evidence reconstructs compiled and installed execution", async () => {
	await assertOwnedJavaScriptBorrowExecution(await read());
});

test("JavaScript borrowed-result evidence rejects missing execution and inflated scope", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.receiverAnchors = true; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].privateAbi.version = 11; }
		, value => { value.runtime[0].sourceSha256 = "0".repeat(64); }
		, value => { value.runtime[0].limits.borrowDepth--; }
		, value => { value.runtime[1].faultCounts["host:move"].after = 0; }
		, value => { value.runtime[1].liveIdentities++; }
		, value => { value.borrowOnly[0].emptyShapes = 0; }
		, value => { value.borrowOnly[1].liveOwners++; }
		, value => { value.mutants[0].observations.pop(); }
		, value => { value.mutants[1].observations[0].parsed = false; }
		, value => { value.mutants[1].observations[6].semanticRejection = false; }
		, value => { value.coexistence.pop(); }
		, value => { value.coexistence[1].runtimeInitializations++; }
		, value => { value.coexistence[2].legacyHandles++; }
		, value => { value.packages.reports[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages.reports[0].independentRebuild = false; }
		, value => { value.packages.reports[1].documentation.output = "42n\n"; }
		, value => { value.packages.reports[1].model.ownedGraph.resultAnchors.exports.pop(); }
		, value => { value.packages.reports[1].inventory["@lean-bridge/runtime/internal/owned-wasm-borrow-registry.mjs"].sha256 = "0".repeat(64); }
		, value => { value.packages.reports[0].browser.executions.pop(); }
		, value => { value.packages.reports[1].browser.executions[0].assets.pop(); }
		, value => { value.packages.reports[0].rejected = 0; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedJavaScriptBorrowExecution(changed), undefined, mutate.toString());
	}
});
