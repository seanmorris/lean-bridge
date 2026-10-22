/**
 * Select observable entries from a compiler-authenticated copied-graph PHP-Wasm model.
 * The selector consumes the same generated Lean adapter source that the build compiles;
 * it does not reproduce private validator naming rules or infer constructors from traces.
 *
 * @file
 */
import assert from "node:assert/strict";
import { compileCopiedPhpGraphZendModel } from "../../src/backends/php/copied-graph-zend.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { generateCompiledPhpWasmLeanAdapters, phpWasmGraphCarrierAbi } from "../../src/build/php-wasm-graph-model.mjs";
import { validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const exportedSymbols = source => {
	const symbols = [...source.matchAll(/^@\[export ([A-Za-z_][A-Za-z0-9_]*)\]$/gmu)].map(match => match[1]);
	assert.equal(new Set(symbols).size, symbols.length, "generated Lean adapter exports are unique");
	return new Set(symbols);
};

/**
 * Derive public Zend entries, generated Lean adapters and every generated validator.
 * Explicit source/constructor markers are supplied by the fixture probe because those
 * identities belong to the authored Lean source, not the generated transport.
 *
 * @param model - Fresh compiler-authenticated PHP-Wasm copied-graph model.
 * @param sourceEntries - Explicit source and constructor marker selections.
 */
export const phpWasmRefinementEntrySelection = (model, sourceEntries = []) => {
	assert.equal(model?.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	const generated = generateCompiledPhpWasmLeanAdapters(model), annotations = exportedSymbols(generated.leanSource);
	const graph = model.copiedGraph !== undefined;
	if(graph)
	{
		assert.ok(!model.copiedGraph.callbacks, "entry selection requires a copied transport without callbacks");
		phpWasmGraphCarrierAbi(model);
	}
	else assert.ok([2, 3].includes(model.schemaVersion), "flat entry selection requires an acyclic copied model");
	const zend = graph ? compileCopiedPhpGraphZendModel(model.bindingIr)
		: compileCopiedPhpModel(model.bindingIr, {
			integerBits: 32, structuredCallables: true, lists: true, variants: true
		});
	const functions = graph ? zend.functions : zend.surface.functions;
	assert.equal(functions.length, model.exports.length);
	assert.equal(model.bindingIr.declarations.length, model.exports.length);
	const selected = structuredClone(sourceEntries);
	for(const [index, fn] of functions.entries())
	{
		const declaration = fn.declaration;
		assert.equal(model.bindingIr.declarations.filter(item => item.id === declaration.id).length, 1);
		const matches = model.exports.filter(item => graph
			? item.bindingId === declaration.id : item.name === declaration.source.declaration);
		assert.equal(matches.length, 1, `one compiled export for ${declaration.id}`);
		selected.push({ symbol: `${graph ? "lg" : "lb"}_call${index}`, kind: "public", label: declaration.name });
	}
	for(const item of model.exports)
	{
		if(graph) assert.ok(item.symbol.endsWith("_lean"), `graph adapter symbol names its Lean boundary: ${item.symbol}`);
		assert.ok(annotations.has(item.symbol), `generated adapter export is present: ${item.symbol}`);
		selected.push({ symbol: item.symbol, kind: "adapter", label: item.name });
		const base = graph ? item.symbol.slice(0, -"_lean".length) : item.symbol;
		const prefixes = graph ? [
			`${base}_fin_guard_`, `${base}_refinement_`, `${base}_graph_refinement_`
		] : [`${base}_refinement_`];
		for(const symbol of [...annotations].filter(value => prefixes.some(prefix => value.startsWith(prefix))).sort())
			selected.push({ symbol, kind: "validator", label: `${item.name}:${symbol.slice(base.length + 1)}` });
	}
	validateSubtypeEntrySelection(selected);
	return { selected, generated };
};

/**
 * Retain the graph-only entry point for callers whose contract specifically
 * requires a copied graph carrier.
 *
 * @param model - Fresh compiler-authenticated copied-graph model.
 * @param sourceEntries - Explicit authored source and constructor markers.
 */
export const phpWasmGraphRefinementEntrySelection = (model, sourceEntries = []) => {
	assert.ok(model?.copiedGraph, "graph entry selection requires the copied graph transport");
	return phpWasmRefinementEntrySelection(model, sourceEntries);
};
