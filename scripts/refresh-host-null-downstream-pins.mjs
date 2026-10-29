#!/usr/bin/env node
/**
 * Refresh exactly the live type-surface pins changed by the PHP/native
 * HostNull projection, its documentation and validation repair, and the
 * recurring PHP/.NET/JVM installed-package workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "7afb84696779982734578838e63e0d304b8622cf";
const implementation = "78c3ad61336ef7d4d4212e05d6825061b4641e5f";
const inventoryPath = "docs/type-surface.v1.json";
const expected = Object.freeze({
	".github/workflows/consumer-matrix.yml": 92
	, "docs/lean/existing-package.md": 18
	, "docs/lean/export-decisions.md": 22
	, "docs/php.md": 6
	, "src/adoption/type-surface.mjs": 1
	, "src/backends/c/generate.mjs": 37
	, "src/backends/c/native-copied-values.mjs": 113
	, "src/backends/c/primitive-surface.mjs": 60
	, "src/backends/php/copied-conversions.mjs": 18
	, "src/backends/php/copied-model.mjs": 20
	, "src/backends/php/copied-values.mjs": 19
	, "src/backends/php/copied-zend-conversions.mjs": 11
	, "src/backends/php/copied-zend.mjs": 16
	, "src/build/native-model.mjs": 146
});
const expectedPins = Object.values(expected).reduce((sum, count) => sum + count, 0);
const previousAt = {
	".github/workflows/consumer-matrix.yml": "04c8e8b45b7fa69f2e85d3ed65247912fac00926"
	, "docs/lean/existing-package.md": "d215a3700a02de89a139b7ef4243c2b191367c34"
	, "docs/lean/export-decisions.md": "d215a3700a02de89a139b7ef4243c2b191367c34"
	, "docs/php.md": "d215a3700a02de89a139b7ef4243c2b191367c34"
	, "src/adoption/type-surface.mjs": "68c4b2df7ad24c07b4c63e1a77159844f4af6a78"
};
for(const path of Object.keys(expected))
	if(!(path in previousAt)) previousAt[path]
		= "1d13d30f174d0f4750061cd601a6aebde3f3d69b";
Object.freeze(previousAt);
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-host-null-downstream-pins.mjs");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), implementation
	, "HostNull downstream pin refresh requires the exact implementation parent");
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
const pinnedFiles = new Map();
for(const evidence of inventory.evidence)
	for(const file of evidence.files)
	{
		if(!pinnedFiles.has(file.path)) pinnedFiles.set(file.path, []);
		pinnedFiles.get(file.path).push({ evidence, file });
	}
const transitions = new Map();
for(const path of changedPaths)
{
	const references = pinnedFiles.get(path);
	if(!references) continue;
	const current = sha256(execFileSync("git", ["show", `HEAD:${path}`]
		, { maxBuffer: 128 * 1024 * 1024 }));
	if(references.every(({ file }) => file.sha256 === current)) continue;
	if(!(path in expected))
	{
		transitions.set(path, { previous: null, current });
		continue;
	}
	const previous = sha256(execFileSync("git", ["show", `${previousAt[path]}:${path}`]
		, { maxBuffer: 128 * 1024 * 1024 }));
	assert.notEqual(previous, current, `${path} must contain a real source transition`);
	transitions.set(path, { previous, current });
}
assert.deepEqual([...transitions.keys()].sort(), Object.keys(expected).sort()
	, "HostNull downstream work left an unexpected stale pinned source");

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
	assert.equal(count, expected[path], path);
assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0)
	, expectedPins);

await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${expectedPins} exact pins across `
	+ `${transitions.size} HostNull downstream paths.\n`);
