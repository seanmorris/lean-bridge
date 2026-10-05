/**
 * Compile the published Lean definitions and execute the exact Ruby example.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeRecursiveCallableSource } from "./native-recursive-callable-fixture.mjs";

/** Return exact publisher and consumer snippets plus the complete Lean fixture. */
export const rubyRecursiveCallableDocumentation = async () => {
	const publisher = await readFile("docs/publish/rubygems.md", "utf8");
	const author = publisher.match(/## Export recursive callbacks and closures\n[\s\S]*?```lean\n([\s\S]*?)\n```/u)?.[1];
	const consumer = (await readFile("docs/consume/ruby.md", "utf8")).match(/### Recursive callback values\n[\s\S]*?```ruby\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(author && consumer);
	assert.match(author, /^namespace Structured\n[\s\S]*\nend Structured$/u);
	let source = await nativeRecursiveCallableSource();
	for(const definition of [
		"inductive Tree where\n  | leaf (value : Nat)\n  | branch (children : Array Tree)\n"
		, "def callRecursive (value : Tree) (callback : Tree → Tree) := callback value\n"
		, "def makeRecursive (captured : Tree) : Bool → Tree → Tree := fun selected value => if selected then captured else value\n"
	]) {
		assert.equal(source.split(definition).length, 2);
		source = source.replace(definition, "");
	}
	return { author, consumer, source: author + "\n\n" + source };
};
