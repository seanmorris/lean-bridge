#!/usr/bin/env node
/**
 * Record the PHP-Wasm callback Fin and checked-record implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackRefinementsPhpWasmAddedPaths
	, callbackRefinementsPhpWasmChangedPaths
	, callbackRefinementsPhpWasmHistoryPath
	, callbackRefinementsPhpWasmImplementation
	, callbackRefinementsPhpWasmImplementationPaths
	, callbackRefinementsPhpWasmPredecessor
	, reverseCallbackRefinementsPhpWasmUpdate
} from "../tests/helpers/callback-refinements-php-wasm-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackRefinementsPhpWasmImplementation
	, "PHP-Wasm callback-refinement history is draft-only at its implementation commit");
assert.equal(git(["merge-base", callbackRefinementsPhpWasmPredecessor
	, callbackRefinementsPhpWasmImplementation]).trim()
, callbackRefinementsPhpWasmPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackRefinementsPhpWasmPredecessor
	, callbackRefinementsPhpWasmImplementation]).trim().split("\n").sort()
, [...callbackRefinementsPhpWasmImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackRefinementsPhpWasmHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-refinements-php-wasm-history-"));
const transitionSources = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseCallbackRefinementsPhpWasmUpdate(
		current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${callbackRefinementsPhpWasmPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of callbackRefinementsPhpWasmChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, callbackRefinementsPhpWasmPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of callbackRefinementsPhpWasmChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of callbackRefinementsPhpWasmAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackRefinementsPhpWasmPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const historicalUpdates = [await transitionSources(
		"src/adoption/test-profiles.mjs"
		, git(["show", "209b13b86b8d23a10a76de73bbf1c1f095d5fe31:src/adoption/test-profiles.mjs"])
		, git(["show", "22c1efd6c9c66c42ba438a07ca6adff6fbc7f2c5:src/adoption/test-profiles.mjs"])
	)];
	await writeFile(callbackRefinementsPhpWasmHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-refinements-php-wasm-v1"
		, predecessorCommit: callbackRefinementsPhpWasmPredecessor
		, implementationCommit: callbackRefinementsPhpWasmImplementation
		, scope: "PHP-Wasm infers Fin-only callback roles only inside its authenticated callable graph, checks Fin and constructor-backed record values at host callbacks and returned closures, retains ordinary and independently reviewed installed Node and Chromium evidence, restores copied-build output for bare produced checked records, and repairs the previously unrecorded PHP-Wasm owned-value test-profile edge."
		, additions, updates, historicalUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
