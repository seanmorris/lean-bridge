#!/usr/bin/env node
/**
 * Refresh only the live type-surface citations changed by closing the shipped
 * npm runtime module graph.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
} from "../tests/helpers/dependent-checked-record-promotion.mjs";

const predecessor = "6d949d539d764295f82f2394c0eda0e28fd313d3";
const implementation = "6679d41ae685f936e627658886e9aee490e21455";
const inventoryPath = "docs/type-surface.v1.json";
const packagePath = "src/release/component-npm-package.mjs";
const implementationPaths = Object.freeze([
	packagePath
	, "tests/component-npm-package.test.mjs"
	, "tests/component-runtime-package-identity.test.mjs"
]);
const expectedPins = 16;
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-npm-runtime-module-graph-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Runtime module-graph pins require the exact implementation head");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation, "--"])
	, [...implementationPaths].sort());
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.deepEqual(names(["diff", "--name-only", "HEAD", "--"]), []);

const inventoryText = await readFile(inventoryPath, "utf8");
assert.equal(JSON.stringify(JSON.parse(inventoryText), null, 2) + "\n"
	, inventoryText, "The type-surface inventory must retain canonical formatting");
const inventory = JSON.parse(inventoryText);
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, implementationPaths), [packagePath]);
const previous = sha256(git(["show", `${predecessor}:${packagePath}`]));
const current = sha256(git(["show", `${implementation}:${packagePath}`]));
assert.notEqual(current, previous);
let refreshed = 0;
for(const evidence of inventory.evidence)
	for(const file of evidence.files)
	{
		if(file.path !== packagePath) continue;
		assert.equal(file.sha256, previous
			, `${evidence.id}: ${packagePath} must name the exact predecessor`);
		file.sha256 = current;
		++refreshed;
	}
assert.equal(refreshed, expectedPins);

await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${refreshed} exact npm runtime package pins.\n`);
