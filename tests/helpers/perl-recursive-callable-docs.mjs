/**
 * Compile the published Lean callback definitions and execute the exact Perl example.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeRecursiveCallableSource } from "./native-recursive-callable-fixture.mjs";

/** Return the documented exports, consumer and complete independent Lean fixture. */
export const perlRecursiveCallableDocumentation = async () => {
	const publisher = await readFile("docs/publish/cpan.md", "utf8");
	const section = publisher.split("### Export recursive callbacks and closures\n")[1]?.split(/\n#{1,3} /)[0];
	assert.ok(section);
	const author = section.match(/```lean\n([\s\S]*?)\n```/u)?.[1];
	const configuration = section.match(/```json\n([\s\S]*?)\n```/u)?.[1];
	const consumer = (await readFile("docs/consume/perl.md", "utf8")).match(/### Recursive callback values\n[\s\S]*?```perl\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(author && consumer && configuration);
	assert.match(author, /^namespace Structured\n[\s\S]*\nend Structured$/u);
	assert.deepEqual(JSON.parse(configuration), { schemaVersion: 1
		, modules: ["Structured"]
		, exports: ["Structured.callRecursive", "Structured.makeRecursive"]
		, arities: { "Structured.makeRecursive": 1 }
		, targets: { cpan: { module: "LeanBridge::Recursive" } } });
	let source = await nativeRecursiveCallableSource();
	for(const definition of [
		"inductive Tree where\n  | leaf (value : Nat)\n  | branch (children : Array Tree)\n"
		, "def callRecursive (value : Tree) (callback : Tree → Tree) := callback value\n"
		, "def makeRecursive (captured : Tree) : Bool → Tree → Tree := fun selected value => if selected then captured else value\n"
	]) {
		assert.equal(source.split(definition).length, 2);
		source = source.replace(definition, "");
	}
	return { author, configuration, consumer, source: author + "\n\n" + source };
};
