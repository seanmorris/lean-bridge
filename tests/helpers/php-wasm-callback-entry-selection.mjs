/**
 * Derive callback probe identities only from a compiler-authenticated PHP-Wasm model.
 *
 * @file
 */
import assert from "node:assert/strict";
import { componentStructuredCallbackDirection } from "../../src/abi/component-structured-callables.mjs";
import { compileCallablePhpGraphZendModel } from "../../src/backends/php/callable-graph-zend-model.mjs";
import { componentStructuredCallablePrefix } from "../../src/build/component-structured-callable-lean.mjs";
import {
	generateCompiledPhpWasmLeanAdapters, phpWasmGraphCarrierAbi
} from "../../src/build/php-wasm-graph-model.mjs";
import { validatePhpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-c.mjs";

const exportedSymbols = source => {
	const values = [...source.matchAll(/^@\[export ([A-Za-z_][A-Za-z0-9_]*)\]$/gmu)]
		.map(match => match[1]);
	assert.equal(new Set(values).size, values.length, "generated callback exports are unique");
	return new Set(values);
};

const refinementSymbol = (symbol, prefix) => symbol.startsWith(prefix)
	&& /_(?:fin_guard|refinement|graph_refinement)_/u.test(symbol);

const constructorIdentities = value => {
	const found = new Set();
	const visit = current => {
		if(Array.isArray(current)) current.forEach(visit);
		else if(current && typeof current === "object")
		{
			if(typeof current.constructor === "string") found.add(current.constructor);
			Object.values(current).forEach(visit);
		}
	};
	for(const item of [...value.declarations, ...value.types])
		visit(item.source.extensions["lean-lang.org/refinements"]);
	return found;
};

/**
 * Select exact public, adapter, recovery, callback, rejection, closure and cleanup entries.
 * Authored source and closure-body identities are supplied explicitly by the reversible fixture.
 *
 * @param model - Fresh compiler-authenticated callback PHP-Wasm model.
 * @param sourceEntries - Exact authored marker identities.
 */
export const phpWasmCallbackEntrySelection = (model, sourceEntries) => {
	assert.equal(model?.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	const abi = phpWasmGraphCarrierAbi(model);
	assert.ok(abi.callbacks?.length, "callback entry selection requires callable carriers");
	validatePhpWasmCallbackEntrySelection(sourceEntries);
	const generated = generateCompiledPhpWasmLeanAdapters(model);
	const annotations = exportedSymbols(generated.leanSource);
	const zend = compileCallablePhpGraphZendModel(model.bindingIr, { finDirections: true });
	const callbackPrefixes = abi.callbacks.map(signature =>
		componentStructuredCallablePrefix(abi, signature));
	assert.equal(zend.functions.length, model.bindingIr.declarations.length);
	const selected = structuredClone(sourceEntries);
	const constructors = constructorIdentities(model.bindingIr);
	for(const entry of sourceEntries.filter(item => item.kind === "constructor"))
		assert.ok(constructors.has(entry.label)
			, `authored callback constructor is absent from compiler refinements: ${entry.label}`);
	const selectedSources = new Set(sourceEntries.filter(item => item.kind === "source")
		.map(item => item.label));
	for(const entry of sourceEntries.filter(item => item.kind === "closure"))
	{
		assert.ok(entry.label.endsWith(":body"));
		assert.ok(selectedSources.has(entry.label.slice(0, -":body".length))
			, `closure body lacks a selected source owner: ${entry.label}`);
	}
	const matchedSources = new Set();
	const callbackOwners = new Map();
	for(const fn of zend.functions)
	{
		const label = fn.declaration.source.declaration;
		if(!selectedSources.has(label)) continue;
		matchedSources.add(label);
		const item = model.exports.find(value => value.bindingId === fn.declaration.id);
		assert.ok(item); assert.ok(fn.native.endsWith("_graph"));
		assert.equal(fn.native.slice(0, -"_graph".length) + "_lean", item.symbol);
		selected.push(
			{ symbol: `lgc_call${fn.index}`, kind: "public", label }
			, { symbol: fn.native, kind: "adapter", label: `${label}:native` }
			, { symbol: item.symbol, kind: "adapter", label: `${label}:lean` }
			, { symbol: `lgc_cleanup_call${fn.index}`, kind: "cleanup"
				, label: `${label}:cleanup` }
		);
		const base = item.symbol.slice(0, -"_lean".length);
		assert.ok(item.symbol.endsWith("_lean") && annotations.has(item.symbol));
		for(const symbol of [...annotations]
			.filter(value => refinementSymbol(value, base + "_")
				&& !callbackPrefixes.some(prefix => value.startsWith(prefix + "_")))
			.sort())
			selected.push({ symbol, kind: "validator"
				, label: `${label}:validator:${symbol.slice(base.length + 1)}` });
		for(const site of [...fn.parameters, fn.result.callback ? fn.result : []].flat())
		{
			if(!site.callback) continue;
			const owners = callbackOwners.get(site.callback.id) ?? [];
			owners.push({ label, callback: site.callback }); callbackOwners.set(site.callback.id, owners);
		}
	}
	assert.deepEqual([...matchedSources].sort(), [...selectedSources].sort()
		, "authored callback source selection differs from the compiler model");
	for(const signature of abi.callbacks)
	{
		const owners = callbackOwners.get(signature.id);
		if(!owners) continue;
		assert.equal(owners.length, 1, `one selected owner for ${signature.id}`);
		const { label, callback } = owners[0];
		assert.equal(callback.key, signature.key);
		const prefix = componentStructuredCallablePrefix(abi, signature);
		const direction = componentStructuredCallbackDirection(abi, signature, true);
		assert.equal(direction, callback.direction);
		for(const symbol of [...annotations]
			.filter(value => refinementSymbol(value, prefix + "_")).sort())
			selected.push({ symbol, kind: "validator"
				, label: `${label}:callback_validator:${symbol.slice(prefix.length + 1)}` });
		if(direction === "host")
		{
			selected.push(
				{ symbol: `${prefix}_recovery`, kind: "recovery", label: `${label}:recovery:lean` }
				, { symbol: `ng_recovery_${signature.key}`, kind: "recovery", label: `${label}:recovery:native` }
				, { symbol: `${prefix}_invoke`, kind: "callback", label: `${label}:callback:lean` }
				, { symbol: `ng_invoke_${signature.key}`, kind: "callback", label: `${label}:callback:native` }
				, { symbol: `lgc_callback${callback.index}`, kind: "callback", label: `${label}:callback:zend` }
				, { symbol: `${prefix}_reject`, kind: "rejection", label: `${label}:rejection:lean` }
				, { symbol: `ng_reject_${signature.key}`, kind: "rejection", label: `${label}:rejection:native` }
			);
		}
		else if(direction === "closure")
		{
			assert.ok(annotations.has(`${prefix}_apply`));
			selected.push(
				{ symbol: `lgc_invoke${callback.index}`, kind: "public", label: `${label}:invoke` }
				, { symbol: callback.call, kind: "adapter", label: `${label}:closure:native` }
				, { symbol: `${prefix}_apply`, kind: "adapter", label: `${label}:closure:lean` }
				, { symbol: `lgc_cleanup_invoke${callback.index}`, kind: "cleanup"
					, label: `${label}:invoke:cleanup` }
			);
		}
		else throw new TypeError(`Selected callback has no admitted direction: ${label}`);
	}
	validatePhpWasmCallbackEntrySelection(selected);
	return { selected, generated, zend, abi };
};
