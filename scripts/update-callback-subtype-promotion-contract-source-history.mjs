#!/usr/bin/env node
/**
 * Record the callback Subtype promotion-contract transition.
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
	callbackSubtypePromotionContractAddedPaths
	, callbackSubtypePromotionContractHistoryPath
	, callbackSubtypePromotionContractImplementation
	, callbackSubtypePromotionContractImplementationPaths
	, callbackSubtypePromotionContractIntegrationPaths
	, callbackSubtypePromotionContractModifiedPaths
	, callbackSubtypePromotionContractPredecessor
	, reverseCallbackSubtypePromotionContractUpdate
} from "../tests/helpers/callback-subtype-promotion-contract-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypePromotionContractImplementation
	, "Callback Subtype promotion history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackSubtypePromotionContractImplementation}^`]).trim()
, callbackSubtypePromotionContractPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypePromotionContractPredecessor
	, callbackSubtypePromotionContractImplementation]).trim()
	.split("\n").sort()
, [...callbackSubtypePromotionContractImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypePromotionContractHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-promotion-history-"));
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
	assert.equal(
		reverseCallbackSubtypePromotionContractUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypePromotionContractModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show"
				, `${callbackSubtypePromotionContractPredecessor}:${path}`])
			, git(["show"
				, `${callbackSubtypePromotionContractImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackSubtypePromotionContractIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show"
				, `${callbackSubtypePromotionContractImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackSubtypePromotionContractAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypePromotionContractPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(
		callbackSubtypePromotionContractHistoryPath, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-subtype-promotion-contract-v1"
			, predecessorCommit:
				callbackSubtypePromotionContractPredecessor
			, implementationCommit:
				callbackSubtypePromotionContractImplementation
			, scope: "Eight independently replayed callback Subtype archives promote exactly 64 non-PHP-Wasm cells across sixteen profiles, two author routes and two callback directions while leaving every other type-surface cell unchanged."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
