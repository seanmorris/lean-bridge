#!/usr/bin/env node
/**
 * Record the installed PHP-Wasm graph-entry measurement implementation.
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
	phpWasmRefinementEntryInstalledAddedPaths
	, phpWasmRefinementEntryInstalledChangedPaths
	, phpWasmRefinementEntryInstalledHistoryPath
	, phpWasmRefinementEntryInstalledImplementation
	, phpWasmRefinementEntryInstalledImplementationPaths
	, phpWasmRefinementEntryInstalledPredecessor
	, reversePhpWasmRefinementEntryInstalledUpdate
} from "../tests/helpers/php-wasm-refinement-entry-installed-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryInstalledImplementation
	, "installed graph-entry history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", `${phpWasmRefinementEntryInstalledImplementation}^`]).trim()
	, phpWasmRefinementEntryInstalledPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryInstalledPredecessor
	, phpWasmRefinementEntryInstalledImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryInstalledImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryInstalledHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-refinement-entry-installed-history-"));
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
	assert.equal(reversePhpWasmRefinementEntryInstalledUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementEntryInstalledPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementEntryInstalledChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryInstalledPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementEntryInstalledChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementEntryInstalledAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryInstalledPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryInstalledHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-refinement-entry-installed-v1"
		, predecessorCommit: phpWasmRefinementEntryInstalledPredecessor
		, implementationCommit: phpWasmRefinementEntryInstalledImplementation
		, scope: "Four nominal and recursive copied-graph families run from two reproduced PHP-Wasm package handoffs in weak and strict PHP across embedded, Composer, eager, lazy, Node and Chromium routes. Compiler-derived marker identities are bound to independently authored call plans; retained compiler inputs and all twelve installed traces are rechecked by a closed adversarial verifier. The probe remains a separate instrumented build and makes no unmodified-package dispatch claim."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
