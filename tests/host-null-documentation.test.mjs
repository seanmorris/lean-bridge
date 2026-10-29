/**
 * Keep explicit HostNull author and PHP consumer guidance aligned with the compiler contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("PHP documents direct HostNull values without collapsing either Option nesting", async () => {
	const source = await read("docs/php.md");
	assert.match(source, /### Explicit host null/u);
	assert.match(source, /`HostNull\.null : HostNull \(Option UInt32\)` \| `null`/u);
	assert.match(source, /`HostNull\.value none` \| `new None\(\)`/u);
	assert.match(source, /`some HostNull\.null` \| `new Some\(null\)`/u);
	assert.match(source, /parameters, results, record fields,[^]*callback parameters[^]*callback results/u);
	assert.match(source, /cannot[^]*?project `HostNull Unit`/u);
	assert.doesNotMatch(source, /unsupported value[^\n]+becomes?[^\n]+null/iu);
});

test("Lean author docs require exact compiler-authenticated HostNull constructors", async () => {
	const decisions = await read("docs/lean/export-decisions.md");
	const existing = await read("docs/lean/existing-package.md");
	for(const source of [decisions, existing])
	{
		assert.match(source, /"hostProjections"/u);
		assert.match(source, /"name": "NullableApi\.HostNull"/u);
		assert.match(source, /"nullConstructor": "NullableApi\.HostNull\.null"/u);
		assert.match(source, /"valueConstructor": "NullableApi\.HostNull\.value"/u);
		assert.match(source, /fresh Lean|fresh compilation/u);
	}
	assert.match(decisions, /Keep it distinct from `Option`, `Unit`, an[^]*?omitted argument/u);
	assert.match(existing, /reviewed Binding IR[^]*?exact `hostProjections`/u);
	assert.match(existing, /at most 32 entries/u);
});
