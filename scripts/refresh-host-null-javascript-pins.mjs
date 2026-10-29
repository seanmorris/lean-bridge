#!/usr/bin/env node
/**
 * Refresh only the live type-surface source pins changed by the explicit
 * HostNull foundation, JavaScript/browser implementation and recurring
 * consumer-matrix registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "7afb84696779982734578838e63e0d304b8622cf";
const implementation = "04c8e8b";
const inventoryPath = "docs/type-surface.v1.json";
const expectedPaths = 48;
const expectedPins = 975;
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-host-null-javascript-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, git(["rev-parse", implementation]).trim()
	, "HostNull pin refresh requires the exact implementation head");
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--quiet", "HEAD", "--"]));

const changedPaths = names(["diff", "--name-only", "--diff-filter=AM"
	, baseline, implementation, "--"])
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

assert.equal(transitions.size, expectedPaths
	, "HostNull integration changed an unexpected number of pinned sources");
assert.ok([...counts.values()].every(count => count > 0)
	, "Every selected HostNull source must update at least one exact pin");
const pinCount = [...counts.values()].reduce((sum, count) => sum + count, 0);
assert.equal(pinCount, expectedPins
	, "HostNull integration changed an unexpected number of exact pins");

await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${pinCount} exact pins across `
	+ `${transitions.size} HostNull source paths.\n`);
