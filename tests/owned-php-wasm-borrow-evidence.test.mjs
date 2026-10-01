/**
 * Require exact source history and real installed PHP-Wasm borrowed results.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedPhpWasmBorrowExecution } from "./helpers/owned-php-wasm-borrow-evidence.mjs";
import { ownedPhpWasmBorrowPath, ownedPhpWasmBorrowBaseline, ownedPhpWasmBorrowPrevious
	, ownedPhpWasmBorrowChangedPaths, ownedPhpWasmBorrowAddedPaths
	, beforeOwnedPhpWasmBorrow, reverseOwnedPhpWasmBorrowUpdate } from "./helpers/owned-php-wasm-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpWasmBorrowPath, "utf8"));

test("PHP-Wasm borrowed-result history preserves authenticated predecessor versions", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPhpWasmBorrowBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPhpWasmBorrowAddedPaths].sort());
	for(const [path, identity] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), identity, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpWasmBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedPhpWasmBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPhpWasmBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedPhpWasmBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedPhpWasmBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpWasmBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPhpWasmBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedPhpWasmBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "Source refresh must not promote unrelated support cells");
	for(const name of ["owned-php-wasm-borrows", "owned-php-wasm-borrow-evidence"
		, "owned-php-wasm-borrow-packaging", "owned-php-wasm-borrow-documentation"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("PHP-Wasm borrowed-result evidence reconstructs actual runtime and installed packages", async () => {
	await assertOwnedPhpWasmBorrowExecution(await read());
});

test("PHP-Wasm borrowed-result evidence rejects missing execution and altered lifetime claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.receiverAnchors = true; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.wasmFiberExecution = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].sourceSha256 = "0".repeat(64); }
		, value => { value.runtime[0].files["src/Internal/Wire.php"] = "0".repeat(64); }
		, value => { value.runtime[0].observations[0].identities++; }
		, value => { value.runtime[0].observations[0].heldErrors = 0; }
		, value => { value.runtime[1].observations[1].faults.move.php.after = 0; }
		, value => { value.runtime[0].bailouts.pop(); }
		, value => { value.runtime[0].bailouts[0].after.nativeLive++; }
		, value => { value.runtime[1].mutants.pop(); }
		, value => { value.runtime[1].mutants[0].parsed = false; }
		, value => { value.runtime[1].mutants[0].semanticRejection = false; }
		, value => { value.borrowOnly.pop(); }
		, value => { value.borrowOnly[0].observations[1].live++; }
		, value => { value.nativeFibers.wasm32 = true; }
		, value => { value.nativeFibers.observations[0].fiberExecution = false; }
		, value => { value.nativeFibers.observations[1].forkExecution = false; }
		, value => { value.nativeFibers.files["extension.c"] = "0".repeat(64); }
		, value => { value.packages.observations.pop(); }
		, value => { value.packages.observations[0].handoffRemoved = false; }
		, value => { value.packages.observations[0].executions.pop(); }
		, value => { value.packages.observations[1].executions[0].observed.checks = 0; }
		, value => { value.packages.observations[1].browser.observations.pop(); }
		, value => { value.packages.observations[1].model.ownedGraph.resultAnchors.exports.pop(); }
		, value => { value.packages.observations[1].receipt.ownedGraph.resultAnchors.expiration = "never"; }
		, value => { value.packages.observations[0].rejected.pop(); }
		, value => { value.documentation.handoffRemoved = false; }
		, value => { value.documentation.observed.output = "not run"; }
		, value => { value.documentation.consumerSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPhpWasmBorrowExecution(changed), undefined, mutate.toString());
	}
});
