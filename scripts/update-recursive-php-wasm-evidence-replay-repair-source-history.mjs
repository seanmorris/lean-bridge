#!/usr/bin/env node
/**
 * Record the recursive PHP-Wasm historical evidence-replay repair.
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
	recursivePhpWasmEvidenceReplayRepairAddedPaths
	, recursivePhpWasmEvidenceReplayRepairHistoricalPaths
	, recursivePhpWasmEvidenceReplayRepairHistoryPath
	, recursivePhpWasmEvidenceReplayRepairImplementation
	, recursivePhpWasmEvidenceReplayRepairIntegrationPaths
	, recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor
	, recursivePhpWasmEvidenceReplayRepairPredecessor
	, reverseRecursivePhpWasmEvidenceReplayRepairUpdate
} from "../tests/helpers/recursive-php-wasm-evidence-replay-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor
	, "Recursive PHP-Wasm replay history requires its exact integration predecessor");
assert.equal(git(["rev-parse"
	, `${recursivePhpWasmEvidenceReplayRepairImplementation}^`]).trim()
, recursivePhpWasmEvidenceReplayRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, recursivePhpWasmEvidenceReplayRepairPredecessor
	, recursivePhpWasmEvidenceReplayRepairImplementation]).trim()
	.split("\n").sort()
, [...recursivePhpWasmEvidenceReplayRepairHistoricalPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, recursivePhpWasmEvidenceReplayRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-recursive-php-wasm-evidence-replay-history-"));
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
	assert.equal(reverseRecursivePhpWasmEvidenceReplayRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const historicalUpdates = [];
	for(const path of recursivePhpWasmEvidenceReplayRepairHistoricalPaths)
		historicalUpdates.push(await transitionSources(path
			, git(["show"
				, `${recursivePhpWasmEvidenceReplayRepairPredecessor}:${path}`])
			, git(["show"
				, `${recursivePhpWasmEvidenceReplayRepairImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of recursivePhpWasmEvidenceReplayRepairIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show"
				, `${recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of recursivePhpWasmEvidenceReplayRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(recursivePhpWasmEvidenceReplayRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "recursive-php-wasm-evidence-replay-repair-v1"
			, predecessorCommit: recursivePhpWasmEvidenceReplayRepairPredecessor
			, implementationCommit: recursivePhpWasmEvidenceReplayRepairImplementation
			, integrationPredecessorCommit: recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor
			, scope: "Bind immutable recursive PHP-Wasm evidence to the caller blob at its producer revision and keep aggregate promotion additions reconstructable through later history-reader repairs."
			, additions, historicalUpdates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalUpdates.length} historical and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
