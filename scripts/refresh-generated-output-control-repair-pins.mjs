#!/usr/bin/env node
/**
 * Refresh only the live type-surface pins changed by the generated-output
 * control repair for Perl XS and the managed JVM regression reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "dab1fc037b5cff14c61178c1b7bc0d1c8f89ad56";
const implementation = "f8d95c2dec3509752a92f512b7556473d73c5f08";
const inventoryPath = "docs/type-surface.v1.json";
const expected = Object.freeze({
	"src/backends/perl/generate.mjs": Object.freeze({
		count: 15
		, previousRevision: "1de60dcd3dd0858b96d13f4476a405cf60fefcfd"
		, previous: "7f028acaa4b57df42c5d2095b7a8c55779d6133d243b27dadba1263c69ffd68b"
	})
	, "tests/helpers/jvm-structured-callable-regression.mjs": Object.freeze({
		count: 2
		, previousRevision: baseline
		, previous: "2ea54cb19621db1c27eef43330f110e65fb79568d0c42d3da0a10c323be21672"
	})
});
const expectedPins = Object.values(expected).reduce((sum, entry) => sum + entry.count, 0);
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-generated-output-control-repair-pins.mjs");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), implementation
	, "Generated-output pin refresh requires the exact implementation parent");
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--quiet", "HEAD", "--"]));

const changedPaths = names(["diff", "--name-only", "--diff-filter=AM"
	, baseline, "HEAD", "--"])
	.filter(path => path !== inventoryPath && !path.startsWith("docs/evidence/"));
const inventoryText = await readFile(inventoryPath, "utf8");
assert.equal(JSON.stringify(JSON.parse(inventoryText), null, 2) + "\n"
	, inventoryText, "The type-surface inventory must retain canonical formatting");
const inventory = JSON.parse(inventoryText);
const pinnedPaths = new Set(inventory.evidence.flatMap(evidence =>
	evidence.files.map(file => file.path)));
const transitions = new Map();
for(const path of changedPaths)
{
	if(!pinnedPaths.has(path)) continue;
	const definition = expected[path];
	assert.ok(definition, `Unexpected pinned generated-output repair path: ${path}`);
	const previous = sha256(execFileSync("git"
		, ["show", `${definition.previousRevision}:${path}`]
		, { maxBuffer: 128 * 1024 * 1024 }));
	assert.equal(previous, definition.previous
		, `${path} previous pin must be reproducible from its authenticated revision`);
	const current = sha256(await readFile(path));
	if(previous !== current) transitions.set(path, { previous, current });
}
assert.deepEqual([...transitions.keys()].sort(), Object.keys(expected).sort()
	, "Generated-output repair changed an unexpected pinned source");

const counts = new Map([...transitions].map(([path]) => [path, 0]));
for(const evidence of inventory.evidence)
	for(const file of evidence.files)
	{
		const transition = transitions.get(file.path);
		if(!transition) continue;
		assert.equal(file.sha256, transition.previous
			, `${evidence.id}: ${file.path} must name the authenticated baseline`);
		file.sha256 = transition.current;
		counts.set(file.path, counts.get(file.path) + 1);
	}
for(const [path, count] of counts)
	assert.equal(count, expected[path].count, path);
assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0)
	, expectedPins);

await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${expectedPins} exact pins across `
	+ `${transitions.size} generated-output repair paths.\n`);
