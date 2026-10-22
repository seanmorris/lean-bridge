#!/usr/bin/env node
/**
 * Record the callback-Subtype PHP-Wasm Core profile repair.
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
	callbackSubtypePhpWasmProfileAddedPaths
	, callbackSubtypePhpWasmProfileChangedPaths
	, callbackSubtypePhpWasmProfileHistoryPath
	, callbackSubtypePhpWasmProfileImplementation
	, callbackSubtypePhpWasmProfileImplementationPaths
	, callbackSubtypePhpWasmProfilePredecessor
	, reverseCallbackSubtypePhpWasmProfileUpdate
} from "../tests/helpers/callback-subtype-php-wasm-profile-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypePhpWasmProfileImplementation
	, "callback-Subtype PHP-Wasm profile history requires its implementation commit");
assert.equal(git(["merge-base", callbackSubtypePhpWasmProfilePredecessor
	, callbackSubtypePhpWasmProfileImplementation]).trim()
, callbackSubtypePhpWasmProfilePredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypePhpWasmProfilePredecessor
	, callbackSubtypePhpWasmProfileImplementation]).trim().split("\n").sort()
, [...callbackSubtypePhpWasmProfileImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypePhpWasmProfileHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-bridge-callback-subtype-php-wasm-profile-history-"));
const transition = async path => {
	const previous = git(["show", `${callbackSubtypePhpWasmProfilePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous"), currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u), currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
		.map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
	assert.ok(edits.length > 0, path);
	const update = { path
		, previousSha256: sha256(previous)
		, currentSha256: sha256(current)
		, edits
		, ...path === "src/adoption/test-profiles.mjs"
			? { addedTests: ["callback-subtype-php-wasm"] } : {} };
	assert.equal(reverseCallbackSubtypePhpWasmProfileUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypePhpWasmProfileChangedPaths) updates.push(await transition(path));
	const additions = [];
	for(const path of callbackSubtypePhpWasmProfileAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypePhpWasmProfilePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackSubtypePhpWasmProfileHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-subtype-php-wasm-profile-v1"
		, predecessorCommit: callbackSubtypePhpWasmProfilePredecessor
		, implementationCommit: callbackSubtypePhpWasmProfileImplementation
		, scope: "Register the committed callback-Subtype PHP-Wasm aggregate in the closed Core contract profile and pin that classification in the profile test. This repairs test discovery only; it changes no package, runtime or support claim."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
