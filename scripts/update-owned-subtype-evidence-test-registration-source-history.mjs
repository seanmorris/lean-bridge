#!/usr/bin/env node
/**
 * Record the owned-Subtype hosted-evidence test-registration repair.
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
	ownedSubtypeEvidenceTestRegistrationAddedPaths
	, ownedSubtypeEvidenceTestRegistrationHistoryPath
	, ownedSubtypeEvidenceTestRegistrationImplementation
	, ownedSubtypeEvidenceTestRegistrationImplementationPaths
	, ownedSubtypeEvidenceTestRegistrationIntegrationPaths
	, ownedSubtypeEvidenceTestRegistrationPredecessor
	, ownedSubtypeEvidenceTestRegistrationTests
	, reverseOwnedSubtypeEvidenceTestRegistrationUpdate
} from "../tests/helpers/owned-subtype-evidence-test-registration-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeEvidenceTestRegistrationImplementation
	, "Owned Subtype evidence-test registration history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedSubtypeEvidenceTestRegistrationPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypeEvidenceTestRegistrationPredecessor
	, ownedSubtypeEvidenceTestRegistrationImplementation]).trim()
	.split("\n").sort()
, [...ownedSubtypeEvidenceTestRegistrationImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeEvidenceTestRegistrationHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-evidence-registration-history-"));
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
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	if(path === "src/adoption/test-profiles.mjs")
		update.addedTests = ownedSubtypeEvidenceTestRegistrationTests;
	assert.equal(reverseOwnedSubtypeEvidenceTestRegistrationUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypeEvidenceTestRegistrationImplementationPaths)
		updates.push(await transition(path
			, git(["show"
				, `${ownedSubtypeEvidenceTestRegistrationPredecessor}:${path}`])
			, git(["show"
				, `${ownedSubtypeEvidenceTestRegistrationImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedSubtypeEvidenceTestRegistrationIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show"
				, `${ownedSubtypeEvidenceTestRegistrationImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypeEvidenceTestRegistrationAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeEvidenceTestRegistrationPredecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypeEvidenceTestRegistrationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-subtype-evidence-test-registration-v1"
			, predecessorCommit: ownedSubtypeEvidenceTestRegistrationPredecessor
			, implementationCommit: ownedSubtypeEvidenceTestRegistrationImplementation
			, scope: "Register both owned-Subtype retained-package and hosted-verifier gates in the closed Core contract profile."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
