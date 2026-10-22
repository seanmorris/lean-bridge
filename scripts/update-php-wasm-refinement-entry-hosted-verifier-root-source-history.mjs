#!/usr/bin/env node
/**
 * Record the PHP-Wasm hosted entry verifier repository-root closure milestone.
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
	phpWasmRefinementEntryHostedVerifierRootAddedPaths
	, phpWasmRefinementEntryHostedVerifierRootChangedPaths
	, phpWasmRefinementEntryHostedVerifierRootHistoryPath
	, phpWasmRefinementEntryHostedVerifierRootImplementation
	, phpWasmRefinementEntryHostedVerifierRootImplementationPaths
	, phpWasmRefinementEntryHostedVerifierRootPredecessor
	, reversePhpWasmRefinementEntryHostedVerifierRootUpdate
} from "../tests/helpers/php-wasm-refinement-entry-hosted-verifier-root-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryHostedVerifierRootImplementation
	, "hosted verifier repository-root closure history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementEntryHostedVerifierRootImplementation}^`]).trim()
, phpWasmRefinementEntryHostedVerifierRootPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryHostedVerifierRootPredecessor
	, phpWasmRefinementEntryHostedVerifierRootImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryHostedVerifierRootImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryHostedVerifierRootHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-hosted-verifier-history-"));
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
	assert.equal(reversePhpWasmRefinementEntryHostedVerifierRootUpdate(
		current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementEntryHostedVerifierRootPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementEntryHostedVerifierRootChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryHostedVerifierRootPredecessor
			, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementEntryHostedVerifierRootChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementEntryHostedVerifierRootAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryHostedVerifierRootPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryHostedVerifierRootHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-refinement-entry-hosted-verifier-root-v1"
			, predecessorCommit: phpWasmRefinementEntryHostedVerifierRootPredecessor
			, implementationCommit: phpWasmRefinementEntryHostedVerifierRootImplementation
			, scope: "The hosted PHP-Wasm entry aggregator resolves every Git observation against the verifier script's own asserted repository root, labels Node 22 as the aggregate verifier runtime rather than producer TAP evidence, and states that source closure covers tracked plus untracked nonignored paths."
			, additions, updates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
