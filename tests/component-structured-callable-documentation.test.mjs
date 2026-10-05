/**
 * Keep installed callback examples scoped to the section consumers read.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { npmStructuredCallableDocumentation } from "./helpers/npm-structured-callable-documentation.mjs";

const example = "import { callRecord } from \"structured\";\n";
const section = "### Structured callbacks\n\n```js\n" + example + "```\n";

test("structured callback documentation excludes adjacent sections at every enclosing level", () => {
	for(const heading of ["# Next", "## Next", "### Consuming inputs"])
		assert.equal(npmStructuredCallableDocumentation(section + "\n" + heading + "\n\n```js\nunrelated();\n```\n"), example);
	assert.equal(npmStructuredCallableDocumentation(section), example);
});

test("structured callback documentation requires one section and one example", () => {
	for(const source of ["### Other\n```js\nwrong();\n```\n", section + section])
		assert.throws(() => npmStructuredCallableDocumentation(source), /exactly one Structured callbacks section/u);
	for(const source of ["### Structured callbacks\nNo example.\n"
		, section + "\n```js\nsecond();\n```\n"
		, section + "\n#### More callbacks\n\n```js\nsecond();\n```\n"])
		assert.throws(() => npmStructuredCallableDocumentation(source), /exactly one JavaScript example/u);
});

test("the consumer guide retains its installed callback example beside consuming inputs", async () => {
	const source = await readFile("docs/javascript-typescript.md", "utf8");
	const previousSelection = source.split("### Structured callbacks\n")[1].split("### Type conversions\n")[0];
	assert.ok([...previousSelection.matchAll(/```js\n([\s\S]*?)```/g)].length > 1);
	const selected = npmStructuredCallableDocumentation(source);
	assert.match(selected, /import \{ callRecord, makeRecord, callRecursive \} from "structured";/u);
	assert.doesNotMatch(selected, /api\.newTicket/u);
});
