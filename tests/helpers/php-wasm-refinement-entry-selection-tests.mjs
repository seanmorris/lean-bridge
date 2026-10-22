/**
 * Controls for compiler-derived copied-graph PHP-Wasm entry selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { createPhpWasmCopiedModel } from "../../src/build/native-model.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../../src/backends/php/copied-graph-zend.mjs";
import { generateCopiedPhpZendAdapter } from "../../src/backends/php/copied-zend.mjs";
import { nominalSubtypeNativeFixture } from "./nominal-subtype-native-fixture.mjs";
import { instrumentSubtypeCEntries, restoreSubtypeCEntries } from "./php-wasm-subtype-entry-c.mjs";
import {
	phpWasmGraphRefinementEntrySelection, phpWasmRefinementEntrySelection
} from "./php-wasm-refinement-entry-selection.mjs";
import { recursiveSubtypeReview } from "./recursive-subtype-fixture.mjs";

const fixtureModel = () => {
	const bindingIr = recursiveSubtypeReview();
	const exports = bindingIr.declarations.map(item => ({
		bindingId: item.id
		, symbol: `lean_bridge_${sha256(`${bindingIr.component.id}\0${item.id}`).slice(0, 24)}`
		, parameters: item.parameters.map(site => site.type)
		, result: item.result.type, resultMode: item.resultMode
	}));
	const copiedGraph = { schemaVersion: 1, types: componentRecordDefinitions(bindingIr, true), exports };
	return {
		schemaVersion: 5, profile: "php-wasm-copied-v1"
		, pointerBits: 32, byteOrder: "little"
		, component: bindingIr.component, bindingIr, copiedGraph
		, exports: bindingIr.declarations.map((declaration, index) => ({
			bindingId: declaration.id, symbol: `${exports[index].symbol}_lean`
			, name: declaration.source.declaration, module: "RecursiveSubtypes"
			, parameters: declaration.parameters.map(() => ({}))
			, refinements: declaration.source.extensions["lean-lang.org/refinements"]
		}))
	};
};

test("copied-graph entry selection comes from exact generated adapter identities", () => {
	const model = fixtureModel(), marker = {
		symbol: "lb_probe_constructor_plusOne", kind: "constructor"
		, label: "RecursiveSubtypes.plusOne"
	};
	const { selected, generated } = phpWasmGraphRefinementEntrySelection(model, [marker]);
	assert.equal(selected.filter(item => item.kind === "public").length, model.exports.length);
	assert.equal(selected.filter(item => item.kind === "adapter").length, model.exports.length);
	assert.ok(selected.some(item => item.kind === "validator"));
	assert.deepEqual(selected[0], marker);
	for(const item of selected.filter(value => ["adapter", "validator"].includes(value.kind)))
		assert.ok(generated.leanSource.includes(`@[export ${item.symbol}]`), item.symbol);
	assert.deepEqual(selected.filter(item => item.kind === "public").map(item => item.symbol)
		, model.exports.map((_, index) => `lg_call${index}`));
});

test("Zend macro entries are instrumented and restore byte for byte", () => {
	const model = fixtureModel(), { selected } = phpWasmGraphRefinementEntrySelection(model);
	const files = generateCopiedPhpGraphZendAdapter(model.bindingIr, { refinementDiagnostics: true });
	const [path, original] = Object.entries(files).find(([name]) => name.startsWith("extension/"));
	assert.match(path, /\.c$/u);
	const publicEntries = selected.filter(item => item.kind === "public");
	const { source, receipt } = instrumentSubtypeCEntries(original, publicEntries);
	assert.equal(receipt.insertions.filter(item => item.kind === "public").length, model.exports.length);
	assert.equal(restoreSubtypeCEntries(source, receipt), original);
	assert.throws(() => phpWasmGraphRefinementEntrySelection({ ...model, pointerBits: 64 }), /32/u);
});

test("acyclic entry selection follows the actual flat copied model and Zend boundary", () => {
	const model = createPhpWasmCopiedModel(nominalSubtypeNativeFixture());
	assert.equal(model.schemaVersion, 2); assert.equal(model.copiedGraph, undefined);
	const { selected, generated } = phpWasmRefinementEntrySelection(model);
	assert.deepEqual(selected.filter(item => item.kind === "public").map(item => item.symbol)
		, model.exports.map((_, index) => `lb_call${index}`));
	assert.deepEqual(selected.filter(item => item.kind === "adapter").map(item => item.symbol)
		, model.exports.map(item => item.symbol));
	assert.ok(selected.some(item => item.kind === "validator"));
	for(const item of selected.filter(value => ["adapter", "validator"].includes(value.kind)))
		assert.ok(generated.leanSource.includes(`@[export ${item.symbol}]`), item.symbol);
	const files = generateCopiedPhpZendAdapter(model.bindingIr, { integerBits: 32 });
	const original = Object.entries(files).find(([name]) => name.startsWith("extension/"))[1];
	const publicEntries = selected.filter(item => item.kind === "public");
	const { source, receipt } = instrumentSubtypeCEntries(original, publicEntries);
	assert.equal(receipt.insertions.filter(item => item.kind === "public").length, model.exports.length);
	assert.equal(restoreSubtypeCEntries(source, receipt), original);
	assert.throws(() => phpWasmGraphRefinementEntrySelection(model), /graph transport/u);
});
