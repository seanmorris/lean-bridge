/**
 * Classify authored source entries whose compiled wrapper no call path reaches.
 * Lean emits `<name>___redArg` when a definition ignores a parameter; generated
 * adapters then call that implementation directly, so the exported marked
 * wrapper exists but never runs. The classification reads only retained compiler
 * inputs and never a runtime trace.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const masked = source => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|^[\t ]*#(?:[^\n\\]|\\[\s\S])*/gmu
	, value => value.replace(/[^\n]/gu, " "));
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const identifier = symbol => `(?<![A-Za-z0-9_])${escaped(symbol)}(?![A-Za-z0-9_])`;

// One brace-closed function definition of an exact symbol, with its source span.
const definition = (input, symbol, match) => {
	let depth = 0, end = match.index + match[0].length - 1;
	for(; end < input.text.length; end++)
	{
		if(input.text[end] === "{") depth++;
		else if(input.text[end] === "}" && --depth === 0) break;
	}
	assert.equal(depth, 0, `closed definition of ${symbol}`);
	const declarator = match.index + match[0].search(new RegExp(identifier(symbol), "u"));
	const body = input.text.slice(match.index, end + 1);
	return { name: input.name, start: match.index, end: end + 1, declarator, body };
};
const definitions = (inputs, symbol) => inputs.flatMap(input => {
	const pattern = new RegExp(`^[A-Za-z_][A-Za-z0-9_* \\t]*${identifier(symbol)}\\s*\\([^{};]*\\)\\s*\\{`, "gmu");
	return [...input.text.matchAll(pattern)].map(match => definition(input, symbol, match));
});

// Every lexical use of a symbol except its definition declarator and top-level prototypes.
const references = (inputs, symbol) => inputs.flatMap(input => {
	const prototypes = new Set([...input.text.matchAll(new RegExp(
		`^[A-Za-z_][A-Za-z0-9_* \\t]*(${identifier(symbol)})\\s*\\([^{};()]*\\)\\s*;`, "gmu"))]
		.map(match => match.index + match[0].indexOf(match[1])));
	const declarators = new Set(definitions([input], symbol).map(item => item.declarator));
	return [...input.text.matchAll(new RegExp(identifier(symbol), "gu"))]
		.filter(match => !prototypes.has(match.index) && !declarators.has(match.index))
		.map(match => ({ name: input.name, index: match.index }));
});
const within = (site, spans) => spans.some(span => span.name === site.name
	&& site.index >= span.start && site.index < span.end);

/**
 * Classify each selected source that no compiled call path reaches by its marked wrapper.
 * A reduced-arity source runs in the `___redArg` implementation that adapters call
 * directly. An unreached source has no caller at all, so no planned call may need it.
 *
 * @param inputs - Retained original compiler inputs as `{ name, text }`.
 * @param selected - Complete entry selection compiled from those inputs.
 * @param options - Already classified module-initialized entries.
 * @param options.globalDefinitions - Authored entries compiled as values rather than functions.
 */
export const phpWasmSourceCallTargets = (inputs, selected, { globalDefinitions = [] } = {}) => {
	assert.ok(Array.isArray(inputs) && inputs.length > 0);
	validateSubtypeEntrySelection(selected);
	const prepared = inputs.map(input => {
		assert.match(input?.name, /^\d+-[A-Za-z0-9_.+-]+$/u); assert.equal(typeof input.text, "string");
		return { name: input.name, text: masked(input.text) };
	});
	assert.equal(new Set(prepared.map(input => input.name)).size, prepared.length);
	const globals = new Set(globalDefinitions.map(item => item.symbol));
	const adapters = selected.filter(entry => entry.kind === "adapter")
		.flatMap(entry => definitions(prepared, entry.symbol));
	const reducedArity = [], unreachedSources = [];
	for(const item of selected.filter(entry => entry.kind === "source" && !globals.has(entry.symbol)))
	{
		const wrappers = definitions(prepared, item.symbol);
		assert.equal(wrappers.length, 1, `one compiled definition of ${item.symbol}`);
		const [wrapper] = wrappers;
		if(references(prepared, item.symbol).length > 0) continue;
		const implementation = `l_${item.label.replaceAll(".", "_")}___redArg`;
		const delegated = [...wrapper.body.matchAll(/(?<![A-Za-z0-9_])l_[A-Za-z0-9_]+(?=\s*\()/gu)].map(match => match[0]);
		if(delegated.length === 0)
		{
			unreachedSources.push({ symbol: item.symbol, kind: item.kind, label: item.label });
			continue;
		}
		assert.deepEqual(delegated, [implementation], `${item.symbol} is unreachable without one reduced-arity target`);
		assert.equal(definitions(prepared, implementation).length, 1, `one compiled definition of ${implementation}`);
		const boxed = definitions(prepared, `${implementation}___boxed`);
		const sites = references(prepared, implementation);
		const adapterSites = sites.filter(site => within(site, adapters));
		assert.ok(adapterSites.length > 0, `${implementation} is called by a selected generated adapter`);
		assert.deepEqual(sites.filter(site => !within(site, [wrapper, ...adapters, ...boxed])), []
			, `${implementation} has no unclassified caller`);
		reducedArity.push({ symbol: item.symbol, kind: item.kind, label: item.label, target: implementation });
	}
	return { reducedArity, unreachedSources };
};

/**
 * Return each selected source whose only compiled call target is a reduced-arity implementation.
 *
 * @param inputs - Retained original compiler inputs as `{ name, text }`.
 * @param selected - Complete entry selection compiled from those inputs.
 * @param options - Already classified module-initialized entries.
 */
export const phpWasmReducedArityTargets = (inputs, selected, options) =>
	phpWasmSourceCallTargets(inputs, selected, options).reducedArity;

/**
 * Classify one retained probe build from its own compiler inputs and observer record.
 *
 * @param recordRoot - Build record directory holding `c-inputs/`.
 * @param observation - Completed observer snapshot for that build.
 */
export const phpWasmEntryBuildClassifications = async (recordRoot, observation) => {
	assert.ok(Array.isArray(observation?.compiled) && observation.compiled.length > 0);
	const inputs = await Promise.all(observation.compiled.map(async item => {
		const text = await readFile(join(recordRoot, "c-inputs", item.name), "utf8");
		return { name: item.name, text };
	}));
	const globalDefinitions = structuredClone(observation.globalDefinitions ?? []);
	return {
		globalDefinitions
		, ...phpWasmSourceCallTargets(inputs, observation.selected, { globalDefinitions })
	};
};
