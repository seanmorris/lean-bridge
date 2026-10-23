#!/usr/bin/env node
/**
 * Record the exact owned-Subtype documentation transaction.
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
	ownedSubtypeConsumerDocumentationGateImplementation
	, ownedSubtypeConsumerDocumentationGatePaths
	, ownedSubtypeConsumerDocumentationGatePredecessor
	, ownedSubtypeDocumentationTransactionAddedPaths
	, ownedSubtypeDocumentationTransactionHistoryPath
	, ownedSubtypeDocumentationTransactionImplementation
	, ownedSubtypeDocumentationTransactionImplementationAdditions
	, ownedSubtypeDocumentationTransactionImplementationPaths
	, ownedSubtypeDocumentationTransactionIntegrationPaths
	, ownedSubtypeDocumentationTransactionModifiedPaths
	, ownedSubtypeDocumentationTransactionPredecessor
	, reverseOwnedSubtypeDocumentationTransactionUpdate
} from "../tests/helpers/owned-subtype-documentation-transaction-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, "c18899436eb5c9c9e874a4b762a9af5d744cb11c"
	, "Run this writer only from its integration commit");
assert.equal(git(["rev-parse"
	, `${ownedSubtypeDocumentationTransactionImplementation}^`]).trim()
, ownedSubtypeDocumentationTransactionPredecessor);
assert.equal(git(["rev-parse"
	, `${ownedSubtypeConsumerDocumentationGateImplementation}^`]).trim()
, ownedSubtypeConsumerDocumentationGatePredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypeConsumerDocumentationGatePredecessor
	, ownedSubtypeConsumerDocumentationGateImplementation]).trim()
	.split("\n").sort()
, [...ownedSubtypeConsumerDocumentationGatePaths].sort());
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypeDocumentationTransactionPredecessor
	, ownedSubtypeDocumentationTransactionImplementation]).trim()
	.split("\n").sort()
, [...ownedSubtypeDocumentationTransactionImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeDocumentationTransactionHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-documentation-history-"));
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
	assert.equal(reverseOwnedSubtypeDocumentationTransactionUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypeDocumentationTransactionModifiedPaths)
		updates.push(await transition(path
			, git(["show"
				, `${ownedSubtypeDocumentationTransactionPredecessor}:${path}`])
			, git(["show"
				, `${ownedSubtypeDocumentationTransactionImplementation}:${path}`])));
	const gateUpdates = [];
	for(const path of ownedSubtypeConsumerDocumentationGatePaths)
		gateUpdates.push(await transition(path
			, git(["show"
				, `${ownedSubtypeConsumerDocumentationGatePredecessor}:${path}`])
			, git(["show"
				, `${ownedSubtypeConsumerDocumentationGateImplementation}:${path}`])));
	const implementationAdditions = [];
	for(const path of
		ownedSubtypeDocumentationTransactionImplementationAdditions){
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeDocumentationTransactionPredecessor
			, "--", path]).trim(), "", path);
		implementationAdditions.push({
			path
			, currentSha256: sha256(git(["show"
				, `${ownedSubtypeDocumentationTransactionImplementation}:${path}`]))
		});
		}
	const integrationUpdates = [];
	for(const path of ownedSubtypeDocumentationTransactionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `HEAD:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypeDocumentationTransactionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, "HEAD", "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypeDocumentationTransactionHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-subtype-documentation-transaction-v1"
			, gatePredecessorCommit:
					ownedSubtypeConsumerDocumentationGatePredecessor
			, gateCommit: ownedSubtypeConsumerDocumentationGateImplementation
			, predecessorCommit: ownedSubtypeDocumentationTransactionPredecessor
			, implementationCommit:
				ownedSubtypeDocumentationTransactionImplementation
			, integrationBaseCommit:
				"c18899436eb5c9c9e874a4b762a9af5d744cb11c"
			, scope: "Authenticate the consumer-documentation gate and apply the generated owned-Subtype documentation plus exact manual boundary replacements only after all eight evidence lanes are present."
			, gateUpdates, implementationAdditions, updates, additions
			, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${gateUpdates.length} gate updates, `
			+ `${updates.length} transaction updates, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
