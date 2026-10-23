#!/usr/bin/env node
/**
 * Record the exact dependent checked-record support promotion transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionAddedPaths
	, dependentCheckedRecordPromotionFoundationAddedPaths
	, dependentCheckedRecordPromotionHistoryPath
	, dependentCheckedRecordPromotionImplementation
	, dependentCheckedRecordPromotionIntegrationPaths
	, dependentCheckedRecordPromotionModifiedPaths
	, dependentCheckedRecordPromotionSourcePredecessor
	, reverseDependentCheckedRecordPromotionUpdate
} from "../tests/helpers/dependent-checked-record-promotion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordPromotionImplementation
	, "Dependent promotion history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, dependentCheckedRecordPromotionSourcePredecessor
	, "Dependent promotion history requires its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentCheckedRecordPromotionImplementation}:${dependentCheckedRecordPromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed promotion history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordPromotionSourcePredecessor
	, dependentCheckedRecordPromotionImplementation])
, [...dependentCheckedRecordPromotionModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordPromotionSourcePredecessor
	, dependentCheckedRecordPromotionImplementation])
, [...dependentCheckedRecordPromotionFoundationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentCheckedRecordPromotionIntegrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-checked-record-promotion-history-"));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseDependentCheckedRecordPromotionUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordPromotionModifiedPaths)
		updates.push(await transition(path
			, source(dependentCheckedRecordPromotionSourcePredecessor, path)
			, source(dependentCheckedRecordPromotionImplementation, path)));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordPromotionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(dependentCheckedRecordPromotionImplementation, path)
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of dependentCheckedRecordPromotionAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${dependentCheckedRecordPromotionSourcePredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		const bytes = dependentCheckedRecordPromotionFoundationAddedPaths.includes(
			path) ? source(dependentCheckedRecordPromotionImplementation, path)
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(dependentCheckedRecordPromotionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-checked-record-promotion-source-v1"
		, predecessorCommit: dependentCheckedRecordPromotionSourcePredecessor
		, implementationCommit: dependentCheckedRecordPromotionImplementation
		, scope: "Promote forty-four authenticated routes from eleven hosted archives into exactly sixty-eight value-carrying dependent checked-record support cells across seventeen consumer profiles."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} promotion and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
