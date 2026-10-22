#!/usr/bin/env node
/**
 * Record the fail-closed dependent checked-record promotion contract.
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
	dependentCheckedRecordPromotionContractAddedPaths
	, dependentCheckedRecordPromotionContractHistoryPath
	, dependentCheckedRecordPromotionContractImplementation
	, dependentCheckedRecordPromotionContractImplementationPaths
	, dependentCheckedRecordPromotionContractIntegrationPaths
	, dependentCheckedRecordPromotionContractModifiedPaths
	, dependentCheckedRecordPromotionContractPredecessor
	, reverseDependentCheckedRecordPromotionContractUpdate
} from "../tests/helpers/dependent-checked-record-promotion-contract-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordPromotionContractImplementation
	, "Dependent checked-record promotion history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${dependentCheckedRecordPromotionContractImplementation}^`]).trim()
, dependentCheckedRecordPromotionContractPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, dependentCheckedRecordPromotionContractPredecessor
	, dependentCheckedRecordPromotionContractImplementation]).trim().split("\n").sort()
, [...dependentCheckedRecordPromotionContractImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordPromotionContractHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-checked-record-promotion-history-"));
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
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseDependentCheckedRecordPromotionContractUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordPromotionContractModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${dependentCheckedRecordPromotionContractPredecessor}:${path}`])
			, git(["show", `${dependentCheckedRecordPromotionContractImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordPromotionContractIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${dependentCheckedRecordPromotionContractImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of dependentCheckedRecordPromotionContractAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordPromotionContractPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(dependentCheckedRecordPromotionContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-promotion-contract-source-v1"
			, predecessorCommit: dependentCheckedRecordPromotionContractPredecessor
			, implementationCommit: dependentCheckedRecordPromotionContractImplementation
			, scope: "Authenticate eleven immutable dependent checked-record archives before promoting exactly 68 copied parameter/result cells across seventeen profiles; refuse missing verifiers, transitive loader failures, substituted artifacts, widened file sets and inferred host coverage."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
