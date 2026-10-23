#!/usr/bin/env node
/**
 * Record the owned Subtype hosted-evidence contract transition.
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
	ownedSubtypeHostedEvidenceContractAddedPaths
	, ownedSubtypeHostedEvidenceContractCommits
	, ownedSubtypeHostedEvidenceContractHistoricalAdditions
	, ownedSubtypeHostedEvidenceContractHistoryParent
	, ownedSubtypeHostedEvidenceContractHistoryPath
	, ownedSubtypeHostedEvidenceContractImplementation
	, ownedSubtypeHostedEvidenceContractImplementationPaths
	, ownedSubtypeHostedEvidenceContractIntegrationPaths
	, ownedSubtypeHostedEvidenceContractModifiedPaths
	, ownedSubtypeHostedEvidenceContractPredecessor
	, reverseOwnedSubtypeHostedEvidenceContractUpdate
} from "../tests/helpers/owned-subtype-hosted-evidence-contract-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeHostedEvidenceContractHistoryParent
	, "Owned Subtype hosted-evidence history requires its exact integration parent");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${ownedSubtypeHostedEvidenceContractPredecessor}..${ownedSubtypeHostedEvidenceContractImplementation}`])
	.trim().split("\n"), ownedSubtypeHostedEvidenceContractCommits);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypeHostedEvidenceContractPredecessor
	, ownedSubtypeHostedEvidenceContractImplementation]).trim().split("\n").sort()
, [...ownedSubtypeHostedEvidenceContractImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only"
	, ownedSubtypeHostedEvidenceContractHistoryParent, "--"
	, ownedSubtypeHostedEvidenceContractHistoryPath]).trim(), "");

const draft = await readFile(
	ownedSubtypeHostedEvidenceContractHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.historyParentCommit
	, ownedSubtypeHostedEvidenceContractHistoryParent);
const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-hosted-evidence-history-"));

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
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.equal(reverseOwnedSubtypeHostedEvidenceContractUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const historicalUpdates = [];
	for(const path of ownedSubtypeHostedEvidenceContractModifiedPaths)
		historicalUpdates.push(await transitionSources(path
			, git(["show"
				, `${ownedSubtypeHostedEvidenceContractPredecessor}:${path}`])
			, git(["show"
				, `${ownedSubtypeHostedEvidenceContractImplementation}:${path}`])));
	const historicalAdditions = [];
	for(const path of ownedSubtypeHostedEvidenceContractHistoricalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeHostedEvidenceContractPredecessor, "--", path])
			.trim(), "", path);
		historicalAdditions.push({ path
			, currentSha256: sha256(git(["show"
				, `${ownedSubtypeHostedEvidenceContractImplementation}:${path}`])) });
	}
	const integrationUpdates = [];
	for(const path of ownedSubtypeHostedEvidenceContractIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show"
				, `${ownedSubtypeHostedEvidenceContractHistoryParent}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypeHostedEvidenceContractAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeHostedEvidenceContractHistoryParent, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypeHostedEvidenceContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-subtype-hosted-evidence-contract-v1"
			, predecessorCommit: ownedSubtypeHostedEvidenceContractPredecessor
			, implementationCommit: ownedSubtypeHostedEvidenceContractImplementation
			, implementationCommits: ownedSubtypeHostedEvidenceContractCommits
			, historyParentCommit: ownedSubtypeHostedEvidenceContractHistoryParent
			, scope: "Correct the owned Subtype acceptance semantics, retain each route's exact receipt-named package set, and independently verify original TAP, semantic reports, lifecycle observations, producer identity and retained package bytes across every non-browser hosted lane."
			, historicalAdditions, historicalUpdates
			, additions, integrationUpdates
		})
	);
	process.stdout.write(`Recorded ${historicalUpdates.length} historical, `
		+ `${historicalAdditions.length} historical additions and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
