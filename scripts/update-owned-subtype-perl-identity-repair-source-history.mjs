#!/usr/bin/env node
/**
 * Record the exact owned-Subtype Perl identity-accounting repair.
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
	ownedSubtypePerlIdentityRepairAddedPaths
	, ownedSubtypePerlIdentityRepairHistoryPath
	, ownedSubtypePerlIdentityRepairImplementation
	, ownedSubtypePerlIdentityRepairImplementationPaths
	, ownedSubtypePerlIdentityRepairIntegrationPaths
	, ownedSubtypePerlIdentityRepairPredecessor
	, reverseOwnedSubtypePerlIdentityRepairUpdate
} from "../tests/helpers/owned-subtype-perl-identity-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypePerlIdentityRepairImplementation
	, "Owned Subtype Perl identity history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedSubtypePerlIdentityRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypePerlIdentityRepairPredecessor
	, ownedSubtypePerlIdentityRepairImplementation]).trim()
	.split("\n").sort()
, [...ownedSubtypePerlIdentityRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypePerlIdentityRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-perl-identity-history-"));
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
	assert.equal(reverseOwnedSubtypePerlIdentityRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypePerlIdentityRepairImplementationPaths)
		updates.push(await transition(path
			, git(["show"
				, `${ownedSubtypePerlIdentityRepairPredecessor}:${path}`])
			, git(["show"
				, `${ownedSubtypePerlIdentityRepairImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedSubtypePerlIdentityRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show"
				, `${ownedSubtypePerlIdentityRepairImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypePerlIdentityRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypePerlIdentityRepairPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypePerlIdentityRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-subtype-perl-identity-repair-v1"
		, predecessorCommit: ownedSubtypePerlIdentityRepairPredecessor
		, implementationCommit: ownedSubtypePerlIdentityRepairImplementation
		, scope: "Require the exact Perl lifecycle observed by the installed native runtime: one persistent session identity, one result-owner identity per whole owner, and one shared resource identity."
		, updates, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
