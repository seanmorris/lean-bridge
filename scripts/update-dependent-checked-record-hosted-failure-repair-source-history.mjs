#!/usr/bin/env node
/**
 * Record the exact JavaScript validator and native diagnostic repairs exposed
 * by the first hosted dependent checked-record runs.
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
	dependentCheckedRecordHostedFailureRepairBrowserImplementation
	, dependentCheckedRecordHostedFailureRepairBrowserPaths
	, dependentCheckedRecordHostedFailureRepairChangedPaths
	, dependentCheckedRecordHostedFailureRepairHistoryPath
	, dependentCheckedRecordHostedFailureRepairIntegrationPaths
	, dependentCheckedRecordHostedFailureRepairNativeImplementation
	, dependentCheckedRecordHostedFailureRepairNativePaths
	, dependentCheckedRecordHostedFailureRepairPredecessor
	, reverseDependentCheckedRecordHostedFailureRepairUpdate
} from "../tests/helpers/dependent-checked-record-hosted-failure-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordHostedFailureRepairNativeImplementation
	, "Hosted dependent-record repair history requires its native implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordHostedFailureRepairHistoryPath]).trim(), "");
const additions = Object.freeze([
	"scripts/update-dependent-checked-record-hosted-failure-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-hosted-failure-repair-source-history-tests.mjs"
	, "tests/helpers/dependent-checked-record-hosted-failure-repair-source-history.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "dependent-hosted-failure-repair-history-"));

const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
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
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseDependentCheckedRecordHostedFailureRepairUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordHostedFailureRepairBrowserPaths)
		updates.push(await transition(path
			, dependentCheckedRecordHostedFailureRepairPredecessor));
	for(const path of dependentCheckedRecordHostedFailureRepairNativePaths)
		updates.push(await transition(path
			, dependentCheckedRecordHostedFailureRepairBrowserImplementation));
	assert.deepEqual(updates.map(item => item.path)
		, dependentCheckedRecordHostedFailureRepairChangedPaths);
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordHostedFailureRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, dependentCheckedRecordHostedFailureRepairNativeImplementation));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordHostedFailureRepairNativeImplementation
			, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordHostedFailureRepairNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...dependentCheckedRecordHostedFailureRepairIntegrationPaths].sort());
	await writeFile(dependentCheckedRecordHostedFailureRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone:
				"dependent-checked-record-hosted-failure-repair-source-v1"
			, predecessorCommit:
				dependentCheckedRecordHostedFailureRepairPredecessor
			, browserImplementationCommit:
				dependentCheckedRecordHostedFailureRepairBrowserImplementation
			, nativeImplementationCommit:
				dependentCheckedRecordHostedFailureRepairNativeImplementation
			, scope: "Generated JavaScript validates retained Fin payloads against their sibling Nat field, while C and C++ callers require the exact reviewed parameter diagnostic."
			, updates, integrationUpdates, additions: added
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} repair updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${added.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
