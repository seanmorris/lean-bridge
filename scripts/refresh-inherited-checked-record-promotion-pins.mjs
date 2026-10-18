#!/usr/bin/env node
/**
 * Refresh exact source hashes while drafting the inherited checked-record
 * promotion. The final promotion ledger authenticates every replacement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const predecessor = "df10ec2348928dadb2855874e3d737d30b511048";
const inventoryPath = "docs/type-surface.v1.json";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.deepEqual(process.argv.slice(2), []);
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "Inherited promotion pin refresh is draft-only at its predecessor");
const paths = git(["diff", "--name-only", "--diff-filter=M", predecessor, "--"])
	.trim().split("\n").filter(path => path && path !== inventoryPath);
const transitions = new Map();
for(const path of paths)
{
	const previous = git(["show", `${predecessor}:${path}`]);
	const current = await readFile(path);
	transitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const inventory = JSON.parse(await readFile(inventoryPath));
let pins = 0;
for(const entry of inventory.evidence) for(const file of entry.files)
{
	const transition = transitions.get(file.path);
	if(transition && file.sha256 === transition.previous)
	{
		file.sha256 = transition.current;
		pins++;
	}
}
assert.ok(pins > 0, "Expected at least one stale current-source pin");
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${pins} exact source pins across ${paths.length} modified paths.\n`);
