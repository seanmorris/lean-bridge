#!/usr/bin/env node
/**
 * Record the owned checked-record evidence-contract repair transition.
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
	ownedCheckedRecordEvidenceContractAddedPaths
	, ownedCheckedRecordEvidenceContractCommits
	, ownedCheckedRecordEvidenceContractHistoryPath
	, ownedCheckedRecordEvidenceContractImplementation
	, ownedCheckedRecordEvidenceContractImplementationPaths
	, ownedCheckedRecordEvidenceContractIntegrationPaths
	, ownedCheckedRecordEvidenceContractModifiedPaths
	, ownedCheckedRecordEvidenceContractPredecessor
	, reverseOwnedCheckedRecordEvidenceContractUpdate
} from "../tests/helpers/owned-checked-record-evidence-contract-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordEvidenceContractImplementation
	, "Owned checked-record evidence history requires its implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", "--ancestry-path"
	, `${ownedCheckedRecordEvidenceContractPredecessor}..${ownedCheckedRecordEvidenceContractImplementation}`]).trim().split("\n")
, ownedCheckedRecordEvidenceContractCommits);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordEvidenceContractPredecessor
	, ownedCheckedRecordEvidenceContractImplementation]).trim().split("\n").sort()
, [...ownedCheckedRecordEvidenceContractImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordEvidenceContractHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-record-evidence-history-"));
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
	assert.equal(reverseOwnedCheckedRecordEvidenceContractUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordEvidenceContractModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show"
				, `${ownedCheckedRecordEvidenceContractPredecessor}:${path}`])
			, git(["show"
				, `${ownedCheckedRecordEvidenceContractImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedCheckedRecordEvidenceContractIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show"
				, `${ownedCheckedRecordEvidenceContractImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRecordEvidenceContractAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordEvidenceContractPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedCheckedRecordEvidenceContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-record-evidence-contract-v1"
			, predecessorCommit: ownedCheckedRecordEvidenceContractPredecessor
			, implementationCommit: ownedCheckedRecordEvidenceContractImplementation
			, implementationCommits: ownedCheckedRecordEvidenceContractCommits
			, scope: "Retain and independently verify the exact receipt-named release archives used by every non-PHP-Wasm owned checked-record consumer lane, upload the complete evidence trees, and preserve the remaining synchronous Fin callback boundary in promotion documentation."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
