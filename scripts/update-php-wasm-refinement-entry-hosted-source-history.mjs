#!/usr/bin/env node
/**
 * Record the hosted PHP-Wasm entry artifact verifier milestone.
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
	phpWasmRefinementEntryHostedAddedPaths
	, phpWasmRefinementEntryHostedChangedPaths
	, phpWasmRefinementEntryHostedHistoryPath
	, phpWasmRefinementEntryHostedImplementation
	, phpWasmRefinementEntryHostedImplementationPaths
	, phpWasmRefinementEntryHostedPredecessor
	, reversePhpWasmRefinementEntryHostedUpdate
} from "../tests/helpers/php-wasm-refinement-entry-hosted-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryHostedImplementation
	, "hosted PHP-Wasm entry verifier history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementEntryHostedImplementation}^`]).trim()
, phpWasmRefinementEntryHostedPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryHostedPredecessor
	, phpWasmRefinementEntryHostedImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryHostedImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryHostedHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-entry-hosted-history-"));
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
	assert.equal(reversePhpWasmRefinementEntryHostedUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementEntryHostedPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementEntryHostedChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryHostedPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementEntryHostedChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementEntryHostedAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryHostedPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryHostedHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-refinement-entry-hosted-verifier-v1"
		, predecessorCommit: phpWasmRefinementEntryHostedPredecessor
		, implementationCommit: phpWasmRefinementEntryHostedImplementation
		, scope: "The complete PHP-Wasm refinement entry artifact verifier accepts exactly twenty-six producer-bound hosted artifacts and independently rechecks all twenty-eight ordinary or reviewed route cells from their original retained records. It rejects partial or widened artifact inventories, nonterminal TAP, forged callback indexes and retained check output that differs from a fresh per-route verifier result before closing the aggregate topology. Instrumented probe evidence remains separate from unmodified-package qualification."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
