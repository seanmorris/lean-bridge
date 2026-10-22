/**
 * Reversibly name authored Lean constructor and source entries for a separate
 * PHP-Wasm probe build. Match-equation definitions retain their equations under
 * a private body and receive an explicitly shaped exported wrapper.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/**
 * Add exact export annotations without changing any definition body.
 *
 * @param original - Uninstrumented Lean module source.
 * @param options - Explicit namespace, C symbol prefix and selected definitions.
 * @param options.namespace - Fully qualified Lean namespace used in trace labels.
 * @param options.prefix - Collision-free C identifier prefix for this fixture.
 * @param options.constructors - Constructor definition names.
 * @param options.sources - Exported source definition names.
 * @param options.wrappers - Explicit signatures/calls for match-equation definitions.
 */
export const phpWasmRefinementEntrySource = (original, options) => {
	assert.equal(typeof original, "string");
	const { namespace, prefix, constructors, sources, wrappers = {} } = options;
	assert.match(namespace, /^(?:[A-Za-z_][A-Za-z0-9_]*\.)*[A-Za-z_][A-Za-z0-9_]*$/u);
	assert.match(prefix, identifier); assert.ok(!original.includes(prefix));
	assert.ok(Array.isArray(constructors) && Array.isArray(sources));
	const definitions = [...constructors.map(name => ["constructor", name])
		, ...sources.map(name => ["source", name])];
	assert.equal(new Set(definitions.map(([, name]) => name)).size, definitions.length);
	const edits = [], entries = [];
	for(const [kind, name] of definitions)
	{
		assert.match(name, identifier);
		const pattern = new RegExp(`^(?:@\\[noinline\\][ \\t]+)?def[ \\t]+${name}\\b`, "gmu");
		const matches = [...original.matchAll(pattern)];
		assert.equal(matches.length, 1, `one original definition for ${name}`);
		const start = matches[0].index, lineEnd = original.indexOf("\n", start);
		assert.ok(lineEnd >= 0, `terminated definition header for ${name}`);
		const header = original.slice(start, lineEnd), symbol = `${prefix}_${kind}_${name}`;
		if(header.includes(" :="))
			edits.push({ offset: start, previous: matches[0][0]
				, current: `@[noinline, export ${symbol}]\ndef ${name}` });
		else
		{
			const wrapper = wrappers[name];
			assert.ok(typeof wrapper === "string" && wrapper.startsWith("(") && wrapper.includes(":=")
				, `match definition ${name} requires an explicit wrapper`);
			const next = /^\S/gmu; next.lastIndex = lineEnd + 1;
			const boundary = next.exec(original)?.index ?? original.length;
			edits.push({ offset: start, previous: matches[0][0], current: `def ${name}Body` });
			edits.push({ offset: boundary, previous: ""
				, current: `@[noinline, export ${symbol}]\ndef ${name} ${wrapper}\n` });
		}
		entries.push({ symbol, kind, label: `${namespace}.${name}` });
	}
	// A wrapper boundary can be the next selected definition's start. Replace that
	// definition first, then insert at the same original offset; reversal naturally
	// removes the insertion before restoring the replaced prefix.
	edits.sort((left, right) => right.offset - left.offset || right.previous.length - left.previous.length);
	let source = original;
	for(const edit of edits)
	{
		assert.equal(source.slice(edit.offset, edit.offset + edit.previous.length), edit.previous);
		source = source.slice(0, edit.offset) + edit.current + source.slice(edit.offset + edit.previous.length);
	}
	let restored = source;
	for(const edit of [...edits].reverse())
	{
		assert.equal(restored.slice(edit.offset, edit.offset + edit.current.length), edit.current);
		restored = restored.slice(0, edit.offset) + edit.previous + restored.slice(edit.offset + edit.current.length);
	}
	assert.equal(restored, original);
	return { source, entries, edits, originalSha256: sha256(original), probeSha256: sha256(source) };
};
