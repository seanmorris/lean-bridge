/**
 * Compile the published Lean definitions inside the full callable fixture.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeRecursiveCallableSource } from "./native-recursive-callable-fixture.mjs";

/** Return both exact published examples and a producer that compiles them. */
export const pythonRecursiveCallableDocumentation = async () => {
	const publisher = await readFile("docs/publish/pypi.md", "utf8");
	const author = publisher.match(/## Export recursive callbacks and closures\n[\s\S]*?```lean\n([\s\S]*?)\n```/u)?.[1];
	const consumer = (await readFile("docs/consume/python.md", "utf8")).match(/### Recursive callback values\n[\s\S]*?```python\n([\s\S]*?)\n```/u)?.[1];
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
