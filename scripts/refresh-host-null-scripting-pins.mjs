#!/usr/bin/env node
/**
 * Refresh only the live type-surface pins changed by the Perl/Python/Ruby
 * HostNull hosted producer and its closed test registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "eb0834607b2cb90abce537b9880f3e447a4185c9";
const implementation = "9126e948b065a055285f01b4acb88b8159a40419";
const inventoryPath = "docs/type-surface.v1.json";
const expected = Object.freeze({
	".github/workflows/perl-consumer.yml": 13
	, "src/adoption/test-profiles.mjs": 98
	, "tests/test-profiles.test.mjs": 4
});
const expectedPins = Object.values(expected).reduce((sum, count) => sum + count, 0);
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-host-null-scripting-pins.mjs");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), implementation
	, "Scripting HostNull pin refresh requires the exact implementation parent");
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
	const previous = sha256(execFileSync("git", ["show", `${baseline}:${path}`]
		, { maxBuffer: 128 * 1024 * 1024 }));
	const current = sha256(await readFile(path));
	if(previous !== current) transitions.set(path, { previous, current });
}
assert.deepEqual([...transitions.keys()].sort(), Object.keys(expected).sort()
	, "Scripting HostNull changed an unexpected pinned source");

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
	+ `${transitions.size} scripting HostNull source paths.\n`);
