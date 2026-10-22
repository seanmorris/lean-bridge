/**
 * Select observable entries from a compiler-authenticated owned PHP-Wasm model.
 * Generated Lean annotations and Zend layout data own private identities; this
 * helper never recreates their hashes or infers an entry from runtime errors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const annotations = source => {
	const values = [...source.matchAll(/^@\[export ([A-Za-z_][A-Za-z0-9_]*)\]$/gmu)]
		.map(match => match[1]);
	assert.equal(new Set(values).size, values.length, "generated owned Lean exports are unique");
	return new Set(values);
};

/**
 * Enumerate the compiler-generated checked-input validators from exact Lean source.
 * The stable label retains the compiler-owned symbol instead of reproducing the
 * private adapter-key hash. Call plans inspect the matching generated definition.
 *
 * @param source - Exact generated owned carrier source compiled by Lean.
 */
export const phpWasmOwnedRefinementValidatorEntries = source => [...annotations(source)]
	.filter(symbol => symbol.startsWith("lean_bridge_owned_refine_"))
	.sort()
	.map(symbol => ({ symbol, kind: "validator", label: `owned:${symbol}` }));

const capabilities = model => ({
	hostCallbacks: Boolean(model.ownedGraph.hostCallbacks)
	, transferredInputs: Boolean(model.ownedGraph.inputTransfers)
	, anchoredResults: Boolean(model.ownedGraph.resultAnchors)
	, receiverExports: Boolean(model.ownedGraph.receiverExports)
	, callbackResultAnchors: Boolean(model.ownedGraph.callbackResultAnchors)
});

const transferEntries = Object.freeze([
	["lgo_identity_input", "identity.borrow"]
	, ["lgo_input_reserve", "transfer.reserve"]
	, ["lgo_input_begin", "transfer.begin"]
	, ["lgo_input_commit", "transfer.commit"]
	, ["lb_owned_scope_transfer_many", "owner.move"]
	, ["lgo_input_consume", "owner.consume"]
	, ["lgo_inputs_finish", "transfer.finish"]
]);

/**
 * Derive public Zend entries, generated native/Lean adapters, checked validators
 * and ownership-transfer hooks for one admitted owned component.
 *
 * Explicit authored constructor/source entries are supplied by the fixture probe;
 * those names belong to the Lean source rather than the generated transport.
 *
 * @param model - Fresh compiler-authenticated owned PHP-Wasm model.
 * @param sourceEntries - Explicit authored constructor and source markers.
 */
export const phpWasmOwnedRefinementEntrySelection = (model, sourceEntries = []) => {
	assert.equal(model?.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.ok(model.ownedGraph && !model.copiedGraph, "entry selection requires the owned graph transport");
	const adapters = generateCompiledPhpWasmLeanAdapters(model);
	const exported = annotations(adapters.leanSource);
	const zend = compileOwnedPhpZendModel(model.bindingIr, capabilities(model));
	assert.equal(zend.functions.length, model.exports.length);
	const declarations = new Map(model.bindingIr.declarations.map(item => [item.id, item]));
	assert.equal(declarations.size, model.bindingIr.declarations.length);
	const selected = structuredClone(sourceEntries);
	for(const fn of zend.functions)
	{
		const declaration = declarations.get(fn.id);
		assert.ok(declaration, `Zend function retains Binding IR identity: ${fn.id}`);
		selected.push({ symbol: `lgo_call${fn.index}`, kind: "public", label: declaration.name });
		selected.push({ symbol: fn.symbol, kind: "adapter", label: `${declaration.name}:native` });
	}
	for(const item of model.exports)
	{
		const declaration = declarations.get(item.bindingId);
		assert.ok(declaration, `Lean adapter retains Binding IR identity: ${item.bindingId}`);
		assert.ok(exported.has(item.symbol), `generated owned adapter export is present: ${item.symbol}`);
		selected.push({ symbol: item.symbol, kind: "adapter", label: `${declaration.name}:lean` });
	}
	selected.push(...phpWasmOwnedRefinementValidatorEntries(adapters.leanSource));
	if(model.ownedGraph.inputTransfers)
		selected.push(...transferEntries.map(([symbol, label]) => ({ symbol, kind: "adapter", label })));
	else
		selected.push({ symbol: "lgo_identity_input", kind: "adapter", label: "identity.borrow" });
	validateSubtypeEntrySelection(selected);
	return { selected, adapters, zend };
};
