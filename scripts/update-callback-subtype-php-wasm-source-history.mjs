#!/usr/bin/env node
/**
 * Record the PHP-Wasm callback Subtype implementation and qualification.
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
	callbackSubtypePhpWasmAddedPaths
	, callbackSubtypePhpWasmChangedPaths
	, callbackSubtypePhpWasmEvidencePath
	, callbackSubtypePhpWasmHistoryPath
	, callbackSubtypePhpWasmImplementation
	, callbackSubtypePhpWasmImplementationPaths
	, callbackSubtypePhpWasmPredecessor
	, reverseCallbackSubtypePhpWasmUpdate
} from "../tests/helpers/callback-subtype-php-wasm-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypePhpWasmImplementation
	, "PHP-Wasm callback Subtype history is draft-only at its implementation commit");
assert.equal(git(["merge-base", callbackSubtypePhpWasmPredecessor
	, callbackSubtypePhpWasmImplementation]).trim()
, callbackSubtypePhpWasmPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypePhpWasmPredecessor
	, callbackSubtypePhpWasmImplementation]).trim().split("\n").sort()
, [...callbackSubtypePhpWasmImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypePhpWasmHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-php-wasm-history-"));
const transition = async path => {
	const previous = git(["show", `${callbackSubtypePhpWasmPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
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
	assert.equal(reverseCallbackSubtypePhpWasmUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	for(const path of callbackSubtypePhpWasmChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, callbackSubtypePhpWasmPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of callbackSubtypePhpWasmChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of callbackSubtypePhpWasmAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypePhpWasmPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const evidence = additions.find(item =>
		item.path === callbackSubtypePhpWasmEvidencePath);
	assert.ok(evidence);
	await writeFile(callbackSubtypePhpWasmHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-subtype-php-wasm-v1"
		, predecessorCommit: callbackSubtypePhpWasmPredecessor
		, implementationCommit: callbackSubtypePhpWasmImplementation
		, scope: "PHP-Wasm preserves callback direction, exact checked recovery for selected synchronous host replies, and selected-constructor checks for returned Lean closure inputs through reproduced source-free Composer and npm packages in Node and Chromium."
		, acceptanceEvidence: {
			path: evidence.path, sha256: evidence.currentSha256
		}
		, additions, updates
	}));
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
