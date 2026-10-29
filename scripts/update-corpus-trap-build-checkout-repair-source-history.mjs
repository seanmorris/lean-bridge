#!/usr/bin/env node
/**
 * Record the corpus sampler trap repair, the restored Performance build checkout, their pin refresh and central registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	corpusTrapBuildCheckoutRepairAddedPaths
	, corpusTrapBuildCheckoutRepairCommits
	, corpusTrapBuildCheckoutRepairHistoryPath
	, corpusTrapBuildCheckoutRepairImplementation
	, corpusTrapBuildCheckoutRepairImplementationPaths
	, corpusTrapBuildCheckoutRepairIntegrationPaths
	, corpusTrapBuildCheckoutRepairPredecessor
	, reverseCorpusTrapBuildCheckoutRepairUpdate
} from "../tests/helpers/corpus-trap-build-checkout-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = corpusTrapBuildCheckoutRepairPredecessor;
const implementation = corpusTrapBuildCheckoutRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Corpus trap and build checkout repair history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, corpusTrapBuildCheckoutRepairCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...corpusTrapBuildCheckoutRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${corpusTrapBuildCheckoutRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...corpusTrapBuildCheckoutRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...corpusTrapBuildCheckoutRepairAddedPaths])
, [...corpusTrapBuildCheckoutRepairAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-corpus-trap-build-checkout-repair-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0, offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		while(line < boundary)
		{
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			++line;
		}
		offsets.set(boundary, offset);
	}
	return offsets;
};
const transition = async (path, previous, current) => {
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const edits = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCorpusTrapBuildCheckoutRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of corpusTrapBuildCheckoutRepairImplementationPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor
			, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
	const integrationUpdates = [];
	for(const path of corpusTrapBuildCheckoutRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of corpusTrapBuildCheckoutRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(corpusTrapBuildCheckoutRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "corpus-trap-build-checkout-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Repair the two hosted regressions introduced by the PHP-Wasm corpus lane split and the Performance checkout repair at 4a71d74. The three corpus sampler EXIT traps no longer suppress a kill failure with `|| true`; they probe the sampler with kill -0 inside an if condition and kill it only when alive, so the refinement steps again satisfy the structural-subtype no-suppression gate and documentation test 67. The Performance build job checkout returns byte-for-byte to its pre-repair full-history form because tests/native-graph-model.test.mjs imports the Fin history hub, whose closure reads retained docs/evidence records and committed history; the other six Performance jobs and the clean-build script keep their shared sparse checkouts, and the focused checkout control now pins build as the single full checkout. The 92 consumer-matrix and one performance.yml type-surface pins are refreshed to the repaired workflow bytes. No record, support cell, evidence scope, benchmark or product source changes. Register the transition newest-first; hosted Downstream, Core and Performance remain the terminal acceptance gates."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
