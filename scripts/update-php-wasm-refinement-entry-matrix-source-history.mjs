#!/usr/bin/env node
/**
 * Record the complete PHP-Wasm refinement entry topology milestone.
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
	phpWasmRefinementEntryMatrixAddedPaths
	, phpWasmRefinementEntryMatrixChangedPaths
	, phpWasmRefinementEntryMatrixHistoryPath
	, phpWasmRefinementEntryMatrixImplementation
	, phpWasmRefinementEntryMatrixImplementationPaths
	, phpWasmRefinementEntryMatrixPredecessor
	, reversePhpWasmRefinementEntryMatrixUpdate
} from "../tests/helpers/php-wasm-refinement-entry-matrix-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryMatrixImplementation
	, "PHP-Wasm refinement entry matrix history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementEntryMatrixImplementation}^`]).trim()
, phpWasmRefinementEntryMatrixPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryMatrixPredecessor
	, phpWasmRefinementEntryMatrixImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryMatrixImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryMatrixHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-entry-matrix-history-"));
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
	assert.equal(reversePhpWasmRefinementEntryMatrixUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementEntryMatrixPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementEntryMatrixChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryMatrixPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementEntryMatrixChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementEntryMatrixAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryMatrixPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryMatrixHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-refinement-entry-matrix-v1"
		, predecessorCommit: phpWasmRefinementEntryMatrixPredecessor
		, implementationCommit: phpWasmRefinementEntryMatrixImplementation
		, scope: "The PHP-Wasm refinement entry promotion surface is a closed ordered topology of twenty-eight ordinary or reviewed route cells across copied, owned, callback and indexed families. Twenty-six exact hosted artifact identities map to four workflows because each callback-family artifact contains both independently checked routes. The aggregate gate rejects missing, duplicate, reordered, widened or forged observations while preserving the distinction between instrumented entry probes and unmodified-package qualification."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
