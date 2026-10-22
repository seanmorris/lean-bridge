#!/usr/bin/env node
/**
 * Record the owned-refinement PHP-Wasm entry measurement implementation.
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
	phpWasmOwnedRefinementEntryAddedPaths
	, phpWasmOwnedRefinementEntryChangedPaths
	, phpWasmOwnedRefinementEntryHistoryPath
	, phpWasmOwnedRefinementEntryImplementation
	, phpWasmOwnedRefinementEntryImplementationPaths
	, phpWasmOwnedRefinementEntryPredecessor
	, reversePhpWasmOwnedRefinementEntryUpdate
} from "../tests/helpers/php-wasm-owned-refinement-entry-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmOwnedRefinementEntryImplementation
	, "owned-refinement entry history requires its implementation commit");
assert.equal(git(["rev-parse", `${phpWasmOwnedRefinementEntryImplementation}^`]).trim()
	, phpWasmOwnedRefinementEntryPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmOwnedRefinementEntryPredecessor
	, phpWasmOwnedRefinementEntryImplementation]).trim().split("\n").sort()
, [...phpWasmOwnedRefinementEntryImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmOwnedRefinementEntryHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-owned-refinement-entry-history-"));
const transitionSources = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
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
	assert.equal(reversePhpWasmOwnedRefinementEntryUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmOwnedRefinementEntryPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmOwnedRefinementEntryChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmOwnedRefinementEntryPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmOwnedRefinementEntryChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmOwnedRefinementEntryAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmOwnedRefinementEntryPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmOwnedRefinementEntryHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-owned-refinement-entry-v1"
		, predecessorCommit: phpWasmOwnedRefinementEntryPredecessor
		, implementationCommit: phpWasmOwnedRefinementEntryImplementation
		, scope: "Two owned Subtype and checked-record families run from reproduced PHP-Wasm package handoffs in weak and strict PHP across embedded, Composer, eager, lazy, Node and Chromium routes. Compiler-derived Zend, native, validator, constructor, Lean, source and ownership markers are bound to independently authored call plans that distinguish accepted borrows and transfers from refusal boundaries. The probe remains a separate instrumented build and makes no unmodified-package dispatch claim."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
