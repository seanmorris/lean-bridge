#!/usr/bin/env node
/**
 * Record the proof-erasure evidence audit and central history registration.
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
	proofErasureEvidenceAuditAddedPaths
	, proofErasureEvidenceAuditChangedPaths
	, proofErasureEvidenceAuditCommits
	, proofErasureEvidenceAuditHistoryPath
	, proofErasureEvidenceAuditImplementation
	, proofErasureEvidenceAuditIntegrationPaths
	, proofErasureEvidenceAuditPredecessor
	, reverseProofErasureEvidenceAuditUpdate
} from "../tests/helpers/proof-erasure-evidence-audit-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = proofErasureEvidenceAuditPredecessor;
const implementation = proofErasureEvidenceAuditImplementation;
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, proofErasureEvidenceAuditCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...new Set([...proofErasureEvidenceAuditChangedPaths
		, ...proofErasureEvidenceAuditAddedPaths.slice(0, 4)])].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${proofErasureEvidenceAuditHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");

const directory = await mkdtemp(join(tmpdir(), "lean-proof-erasure-audit-"));
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
	assert.equal(reverseProofErasureEvidenceAuditUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const commit of proofErasureEvidenceAuditCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		for(const path of names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]))
			updates.push({ commit, parent, ...await gitSourceHistoryTransition(
				path, parent, commit, { maximumEditBytes: 16 * 1024 * 1024 }) });
	}
	const integrationUpdates = [];
	for(const path of proofErasureEvidenceAuditIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of proofErasureEvidenceAuditAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const committed = spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status === 0;
		const source = committed ? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}
	await writeFile(proofErasureEvidenceAuditHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "proof-erasure-evidence-audit-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, commits: proofErasureEvidenceAuditCommits
		, scope: "Classify every proof-erasure cell conservatively, bind only exact retained installed evidence, preserve every residual and register the audit newest-first without changing support."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} source states and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
