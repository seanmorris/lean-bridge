/**
 * Explicit transfers through generated Zend resources in real PHP-Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../src/build/php-wasm-owned-component.mjs";
import { ownedAggregateTransferLeaseSource } from "../src/backends/native/owned-aggregate-transfers.mjs";
import { compileOwnedPhpZendModel } from "../src/backends/php/owned-zend-model.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { checkOwnedPhpWasmTransfers } from "./helpers/owned-php-wasm-transfers.mjs";
import { assertOwnedPhpWasmTransferCi, ownedPhpWasmTransferReports } from "./helpers/owned-php-wasm-transfer-ci.mjs";

test("Zend transfer layouts require an explicit consuming capability", () => {
	const ir = ownedRustTransferReviewedIr();
	assert.throws(() => compileOwnedPhpZendModel(ir), /call-scoped input borrows/u);
	const model = compileOwnedPhpZendModel(ir, { transferredInputs: true });
	assert.equal(model.functions.length, 26);
	assert.equal(model.functions.filter(fn => fn.transfers?.length).length, 20);
	for(const fn of model.functions) for(const index of fn.transfers ?? []) assert.equal(fn.hostArguments[index], false);
});

test("PHP-Wasm transfer receipts authenticate wasm32 layouts and reject ownership drift", async () => {
	const previous = JSON.parse(await readFile("docs/evidence/owned-php-transfers-20260930.json", "utf8"));
	for(const { input } of previous.runtime)
	{
		const before = canonicalJson(input), model = createCompiledPhpWasmModel(input);
		assert.equal(canonicalJson(input), before);
		assert.equal(model.schemaVersion, 8); assert.equal(model.pointerBits, 32);
		assert.equal(model.ownedGraph.schemaVersion, 3);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		const adapters = generateCompiledPhpWasmLeanAdapters(model);
		const generated = generateCompiledPhpWasmOwned(model, input.metadata, adapters);
		assert.equal(generated.manifest.schemaVersion, 2); assert.equal(generated.receipt.schemaVersion, 2);
		assert.deepEqual(generated.manifest.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(generated.receipt.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(generated.files["owned/owned-leases.h"], ownedAggregateTransferLeaseSource);
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, value]) => [path, sha256(value)])));
		for(const mutate of [
			value => { value.schemaVersion = 7; }
			, value => { value.ownedGraph.schemaVersion = 2; }
			, value => { delete value.ownedGraph.inputTransfers; }
			, value => { value.ownedGraph.inputTransfers.ownership = "one-wrapper"; }
			, value => { value.ownedGraph.inputTransfers.consumption = "after-lean-call"; }
			, value => { value.ownedGraph.inputTransfers.exports[0].parameters = []; }
			, value => { value.ownedGraph.inputTransfers.exports.pop(); }
			, value => { value.ownedGraph.inputTransfers.extra = true; }
			, value => { delete value.ownedGraph.hostCallbacks; }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateCompiledPhpWasmLeanAdapters(changed));
			assert.throws(() => generateCompiledPhpWasmOwned(changed, input.metadata, adapters));
		}
	}
});

test("CI runs consuming PHP-Wasm examples and preserves every execution report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedPhpWasmTransferCi(workflow, manifest), { testFiles: 3, reports: 4 });
	for(const [before, after] of [
		["          npm run test:owned-php-wasm-transfers\n", ""]
		, [" && npm run test:owned-php-wasm-transfers", ""]
		, ["        id: owned_php_wasm\n", "        id: owned_php_wasm\n        if: false\n"]
		, ...ownedPhpWasmTransferReports.flatMap(path => [["          test -s " + path + "\n", ""], ["            " + path + "\n", ""]])
	]) {
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow);
		assert.throws(() => assertOwnedPhpWasmTransferCi(changed, manifest));
	}
	for(const flag of ["LEAN_BRIDGE_OWNED_PHP_WASM_TRANSFER_TEST", "LEAN_BRIDGE_OWNED_PHP_WASM_DOCUMENTATION_TEST"])
	{
		const changed = structuredClone(manifest);
		changed.scripts["test:owned-php-wasm-transfers"] = changed.scripts["test:owned-php-wasm-transfers"].replace(flag + "=1", flag + "=0");
		assert.throws(() => assertOwnedPhpWasmTransferCi(workflow, changed));
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`PHP-Wasm consumes original shared leases at the actual Lean handoff (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_TRANSFER_TEST !== "1"
	, timeout: 900000
}, t => checkOwnedPhpWasmTransfers(t, mode));
