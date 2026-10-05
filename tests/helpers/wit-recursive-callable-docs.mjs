/**
 * Compile the exact published Lean definitions and installed C consumer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeRecursiveCallableSource } from "./native-recursive-callable-fixture.mjs";

const block = (section, language) => {
	const source = section.match(new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```"))?.[1];
	assert.ok(source, language + " documentation block");
	return source + "\n";
};

/** Return verbatim examples and their independently checked fixture composition. */
export const witRecursiveCallableDocumentation = async () => {
	const publisher = await readFile("docs/publish/wit-wasi.md", "utf8");
	const section = publisher.split("## Export recursive callbacks\n")[1]?.split(/\n## /u)[0];
	assert.ok(section);
	const author = block(section, "lean"), configuration = block(section, "json");
	assert.deepEqual(JSON.parse(configuration), {
		schemaVersion: 1, modules: ["Structured"]
		, exports: ["Structured.callRecursive", "Structured.makeRecursive"]
		, arities: { "Structured.makeRecursive": 1 }
		, targets: { "wit-wasi": { name: "structured", version: "1.0.0" } }
	});
	assert.match(author, /^namespace Structured\n[\s\S]*\nend Structured\n$/u);
	let source = await nativeRecursiveCallableSource();
	const normalize = text => text.replace(/\s+/gu, " ").trim();
	for(const definition of [
		"inductive Tree where\n  | leaf (value : Nat)\n  | branch (children : Array Tree)\n"
		, "def callRecursive (value : Tree) (callback : Tree → Tree) := callback value\n"
		, "def makeRecursive (captured : Tree) : Bool → Tree → Tree := fun selected value => if selected then captured else value\n"
	]) {
		assert.equal(normalize(author).split(normalize(definition)).length, 2);
		assert.equal(source.split(definition).length, 2);
		source = source.replace(definition, "");
	}
	const guide = await readFile("docs/consume/wit-wasi.md", "utf8");
	const consumer = guide.split("### Recursive callback values\n")[1]?.split(/\n#{1,3} /u)[0];
	assert.ok(consumer);
	return { author, configuration, source: author + "\n" + source
		, example: { source: block(consumer, "c file=wit-wasi/recursive-callables.c"), stdout: "branch(leaf(42))\n" } };
};
