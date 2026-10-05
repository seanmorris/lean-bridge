/**
 * Receiver descriptors preserve original owners and optional capabilities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../src/build/javascript-wasm-owned-sources.mjs";
import { assertComponentOwnedWasmBindings } from "../src/abi/component-owned-wasm.mjs";
import { ownedRustReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";

const capabilities = { receiverExports: true, transferredInputs: true, anchoredResults: true };
const previous = async () => JSON.parse(await readFile("docs/evidence/owned-perl-receivers-20261001.json", "utf8"));

test("JavaScript receiver layout preserves the first receiver and remaining anchor positions", () => {
	const ir = ownedRustReceiverReviewedIr(), before = canonicalJson(ir);
	assert.throws(() => compileOwnedJavaScriptWasmLayout(ir, { transferredInputs: true, anchoredResults: true }), /only synchronous function exports/u);
	const layout = compileOwnedJavaScriptWasmLayout(ir, capabilities);
	assert.equal(canonicalJson(ir), before);
	assert.equal(layout.native.functions.filter(fn => fn.receiver === 0).length, 16);
	assert.equal(layout.native.functions.filter(fn => fn.anchor !== undefined).length, 20);
	assert.equal(layout.native.functions.find(fn => fn.name === "chooseTicket").anchor, 1);
	assert.equal(layout.native.functions.find(fn => fn.name === "retainTicket").anchor, 0);
	assert.deepEqual(layout.native.functions.find(fn => fn.name === "transferTicket").transfers, [0]);
});

test("JavaScript receiver components authenticate both source paths and reject capability drift", async () => {
	for(const { input } of (await previous()).runtime)
	{
		assert.throws(() => createOwnedJavaScriptWasmModel({ ...input, receiverExports: false }), /receiver-capable consumer/u);
		const model = createOwnedJavaScriptWasmModel({ ...input, receiverExports: true });
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.pointerBits, 32);
		const adapters = generateOwnedJavaScriptWasmLeanAdapters(model);
		const generated = generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters);
		assert.equal(generated.privateAbi.version, 13); assert.equal(generated.receipt.schemaVersion, 4);
		assert.deepEqual(generated.receipt.receiverExports, model.ownedGraph.receiverExports);
		assert.equal(generated.privateAbi.receiverExports.exports.length, 16);
		assert.equal(generated.privateAbi.resultAnchors.exports.length, 20);
		assert.equal(generated.privateAbi.resultAnchors.exports.find(fn => fn.bindingId === "lean:Owned.chooseTicket").parameter, 1);
		assert.equal(generated.privateAbi.resultAnchors.exports.find(fn => fn.bindingId === "lean:Owned.retainTicket").parameter, 0);
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, value]) => [path, sha256(value)])));
		assert.equal(assertComponentOwnedWasmBindings(generated.privateAbi, model.bindingIr), generated.metadataHash);
		for(const mutate of [
			value => { value.version = 12; }
			, value => { delete value.receiverExports; }
			, value => { value.receiverExports.exports.pop(); }
			, value => { value.receiverExports.exports[0].argument = 1; }
			, value => { value.resultAnchors.exports.find(fn => fn.bindingId === "lean:Owned.chooseTicket").parameter = 0; }
			, value => { value.inputTransfers.exports.find(fn => fn.bindingId === "lean:Owned.transferTicket").parameters = [1]; }
		]) {
			const changed = structuredClone(generated.privateAbi); mutate(changed);
			assert.throws(() => assertComponentOwnedWasmBindings(changed, model.bindingIr));
		}
		for(const mutate of [
			value => { value.schemaVersion = 9; }
			, value => { delete value.ownedGraph.receiverExports; }
			, value => { value.ownedGraph.receiverExports.exports.pop(); }
			, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateOwnedJavaScriptWasmLeanAdapters(changed));
			assert.throws(() => generateCompiledJavaScriptWasmOwned(changed, input.metadata, adapters));
		}
	}
});

test("JavaScript resource receivers require neither callback transport nor borrowed results", async () => {
	for(const item of (await previous()).plain)
	{
		const model = createOwnedJavaScriptWasmModel({ ...item.input
			, receiverExports: true
			, hostCallbacks: false, transferredInputs: item.consuming
			, anchoredResults: false });
		assert.equal(model.schemaVersion, 10);
		assert.equal(model.ownedGraph.hostCallbacks, undefined);
		assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(Boolean(model.ownedGraph.inputTransfers), item.consuming);
		const generated = generateCompiledJavaScriptWasmOwned(model, item.input.metadata, generateOwnedJavaScriptWasmLeanAdapters(model));
		assert.equal(generated.privateAbi.version, 13);
		assert.equal(generated.privateAbi.callbackKey, null);
		assert.equal(generated.privateAbi.resultAnchors, undefined);
		assert.equal(generated.files["owned/callbacks.c"], undefined);
		assert.deepEqual(generated.sources, ["owned/component.c"]);
		assert.ok(generated.privateAbi.receiverExports.exports.length >= 2);
	}
});
