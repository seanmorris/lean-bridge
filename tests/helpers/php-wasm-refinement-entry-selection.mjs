/**
 * Select observable entries from a compiler-authenticated copied-graph PHP-Wasm model.
 * The selector consumes the same generated Lean adapter source that the build compiles;
 * it does not reproduce private validator naming rules or infer constructors from traces.
 *
 * @file
 */
import assert from "node:assert/strict";
import { compileCopiedPhpGraphZendModel } from "../../src/backends/php/copied-graph-zend.mjs";
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
export const phpWasmGraphRefinementEntrySelection = (model, sourceEntries = []) => {
	assert.equal(model?.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.ok(model.copiedGraph && !model.copiedGraph.callbacks, "entry selection requires the copied graph transport");
	phpWasmGraphCarrierAbi(model);
	const generated = generateCompiledPhpWasmLeanAdapters(model), annotations = exportedSymbols(generated.leanSource);
	const zend = compileCopiedPhpGraphZendModel(model.bindingIr);
	assert.equal(zend.functions.length, model.exports.length);
	assert.equal(model.bindingIr.declarations.length, model.exports.length);
	const selected = structuredClone(sourceEntries);
	for(const [index, fn] of zend.functions.entries())
	{
		const declaration = model.bindingIr.declarations[index], item = model.exports[index];
		assert.equal(item.bindingId, declaration.id); assert.equal(fn.declaration.id, declaration.id);
		selected.push({ symbol: `lg_call${index}`, kind: "public", label: declaration.name });
	}
	for(const item of model.exports)
	{
		assert.ok(item.symbol.endsWith("_lean"), `graph adapter symbol names its Lean boundary: ${item.symbol}`);
		assert.ok(annotations.has(item.symbol), `generated adapter export is present: ${item.symbol}`);
		selected.push({ symbol: item.symbol, kind: "adapter", label: item.name });
		const base = item.symbol.slice(0, -"_lean".length), prefixes = [
			`${base}_fin_guard_`, `${base}_refinement_`, `${base}_graph_refinement_`
		];
		for(const symbol of [...annotations].filter(value => prefixes.some(prefix => value.startsWith(prefix))).sort())
			selected.push({ symbol, kind: "validator", label: `${item.name}:${symbol.slice(base.length + 1)}` });
	}
	validateSubtypeEntrySelection(selected);
	return { selected, generated };
};
