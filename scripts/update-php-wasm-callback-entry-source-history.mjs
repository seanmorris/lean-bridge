#!/usr/bin/env node
/**
 * Record the synchronous callback-entry PHP-Wasm measurement implementation.
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
	phpWasmCallbackEntryAddedPaths, phpWasmCallbackEntryChangedPaths
	, phpWasmCallbackEntryHistoryPath, phpWasmCallbackEntryImplementation
	, phpWasmCallbackEntryImplementationPaths, phpWasmCallbackEntryPredecessor
	, reversePhpWasmCallbackEntryUpdate
} from "../tests/helpers/php-wasm-callback-entry-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), phpWasmCallbackEntryImplementation
	, "callback-entry history requires its implementation commit");
assert.equal(git(["merge-base", phpWasmCallbackEntryPredecessor
	, phpWasmCallbackEntryImplementation]).trim(), phpWasmCallbackEntryPredecessor);
assert.deepEqual(git(["diff", "--name-only", phpWasmCallbackEntryPredecessor
	, phpWasmCallbackEntryImplementation]).trim().split("\n").sort()
, [...phpWasmCallbackEntryImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmCallbackEntryHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-entry-history-"));
const transitionSources = async (path, previous, current) => {
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
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reversePhpWasmCallbackEntryUpdate(current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmCallbackEntryPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmCallbackEntryChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmCallbackEntryPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmCallbackEntryChangedPaths) updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmCallbackEntryAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmCallbackEntryPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmCallbackEntryHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-callback-entry-v1"
		, predecessorCommit: phpWasmCallbackEntryPredecessor
		, implementationCommit: phpWasmCallbackEntryImplementation
		, scope: "Two synchronous callback families reproduce separately instrumented ordinary and reviewed PHP-Wasm packages, install them without author sources, and execute compiler-authenticated public, recovery, callback, rejection, closure, cleanup, constructor and authored-source entries across weak and strict PHP, embedded and Composer loading, eager and lazy initialization, Node and Chromium. Independent plans distinguish zero-native-entry preflight refusal from native reply rejection and later recovery. The lane measures only the separate probe packages and makes no unmodified release-package dispatch claim."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
