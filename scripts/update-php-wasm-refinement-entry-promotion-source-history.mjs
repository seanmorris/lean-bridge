#!/usr/bin/env node
/**
 * Record the recurring PHP-Wasm refinement-entry promotion milestone.
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
	phpWasmRefinementEntryPromotionAddedPaths
	, phpWasmRefinementEntryPromotionChangedPaths
	, phpWasmRefinementEntryPromotionHistoryPath
	, phpWasmRefinementEntryPromotionImplementation
	, phpWasmRefinementEntryPromotionImplementationPaths
	, phpWasmRefinementEntryPromotionPredecessor
	, reversePhpWasmRefinementEntryPromotionUpdate
} from "../tests/helpers/php-wasm-refinement-entry-promotion-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryPromotionImplementation
	, "PHP-Wasm entry promotion history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementEntryPromotionImplementation}^`]).trim()
, phpWasmRefinementEntryPromotionPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryPromotionPredecessor
	, phpWasmRefinementEntryPromotionImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryPromotionImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryPromotionHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-entry-promotion-history-"));
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
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reversePhpWasmRefinementEntryPromotionUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementEntryPromotionPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementEntryPromotionChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryPromotionPredecessor
			, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementEntryPromotionChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementEntryPromotionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryPromotionPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryPromotionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "php-wasm-refinement-entry-promotion-v1"
		, predecessorCommit: phpWasmRefinementEntryPromotionPredecessor
		, implementationCommit: phpWasmRefinementEntryPromotionImplementation
		, scope: "A monthly and manually runnable promotion workflow calls all four exact instrumented producer matrices at one revision, limits the topology to four concurrent producer jobs, preserves the original current-run artifacts, downloads exactly their 26 named directories, and runs the clean-source byte-authenticating verifier before retaining a complete 28-route summary."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
