#!/usr/bin/env node
/**
 * Record the exact owned-Subtype promotion-contract foundation.
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
	ownedSubtypePromotionContractAddedPaths
	, ownedSubtypePromotionContractHistoryPath
	, ownedSubtypePromotionContractImplementation
	, ownedSubtypePromotionContractImplementationAdditions
	, ownedSubtypePromotionContractImplementationPaths
	, ownedSubtypePromotionContractIntegrationPaths
	, ownedSubtypePromotionContractModifiedPaths
	, ownedSubtypePromotionContractPredecessor
	, reverseOwnedSubtypePromotionContractUpdate
} from "../tests/helpers/owned-subtype-promotion-contract-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypePromotionContractImplementation
	, "Owned Subtype promotion-contract history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedSubtypePromotionContractPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypePromotionContractPredecessor
	, ownedSubtypePromotionContractImplementation]).trim().split("\n").sort()
, [...ownedSubtypePromotionContractImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypePromotionContractHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-promotion-contract-history-"));
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
	assert.equal(reverseOwnedSubtypePromotionContractUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypePromotionContractModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${ownedSubtypePromotionContractPredecessor}:${path}`])
			, git(["show", `${ownedSubtypePromotionContractImplementation}:${path}`])));
	const implementationAdditions = [];
	for(const path of ownedSubtypePromotionContractImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypePromotionContractPredecessor, "--", path]).trim()
		, "", path);
		implementationAdditions.push({
			path
			, currentSha256: sha256(git(["show"
				, `${ownedSubtypePromotionContractImplementation}:${path}`]))
		});
	}
	const integrationUpdates = [];
	for(const path of ownedSubtypePromotionContractIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show"
				, `${ownedSubtypePromotionContractImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypePromotionContractAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypePromotionContractPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypePromotionContractHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-subtype-promotion-contract-v1"
		, predecessorCommit: ownedSubtypePromotionContractPredecessor
		, implementationCommit: ownedSubtypePromotionContractImplementation
		, scope: "Define an exact eight-lane promotion for the thirty-two non-PHP-Wasm checked-field cells, including authenticated relocated JavaScript evidence, seven independently replayed hosted archives and strict unrelated-cell preservation."
		, implementationAdditions, updates, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
