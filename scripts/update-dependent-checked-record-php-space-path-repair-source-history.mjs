#!/usr/bin/env node
/**
 * Record the dependent checked-record native PHP space-path repair.
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
	dependentCheckedRecordPhpSpacePathRepairChangedPaths
	, dependentCheckedRecordPhpSpacePathRepairHistoryPath
	, dependentCheckedRecordPhpSpacePathRepairImplementation
	, dependentCheckedRecordPhpSpacePathRepairIntegrationBase
	, dependentCheckedRecordPhpSpacePathRepairIntegrationPaths
	, dependentCheckedRecordPhpSpacePathRepairPredecessor
	, reverseDependentCheckedRecordPhpSpacePathRepairUpdate
} from "../tests/helpers/dependent-checked-record-php-space-path-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const integrationBase = dependentCheckedRecordPhpSpacePathRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Dependent checked-record PHP space-path repair history is draft-only at its integration base commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordPhpSpacePathRepairHistoryPath]).trim(), "");

const additions = Object.freeze([
	"scripts/update-dependent-checked-record-php-space-path-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-php-space-path-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-php-space-path-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "dependent-record-php-space-repair-history-"));
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
				previousStart, previousStart + previousCount
			).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount
			).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseDependentCheckedRecordPhpSpacePathRepairUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordPhpSpacePathRepairChangedPaths)
	{
		const current = await readFile(path, "utf8");
		assert.equal(current, git(["show"
			, `${dependentCheckedRecordPhpSpacePathRepairImplementation}:${path}`])
		, `Later work changed ${path}; record a composed transition instead`);
		updates.push(await transition(
			path, dependentCheckedRecordPhpSpacePathRepairPredecessor));
	}
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordPhpSpacePathRepairIntegrationPaths)
		integrationUpdates.push(await transition(path, integrationBase));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, integrationBase, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, integrationBase, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...dependentCheckedRecordPhpSpacePathRepairIntegrationPaths].sort());
	await writeFile(dependentCheckedRecordPhpSpacePathRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-checked-record-php-space-path-repair-source-v1"
		, predecessorCommit: dependentCheckedRecordPhpSpacePathRepairPredecessor
		, implementationCommit: dependentCheckedRecordPhpSpacePathRepairImplementation
		, integrationBaseCommit: integrationBase
		, scope: "Offline native PHP Composer installations preserve literal filesystem characters in local distribution URLs, including paths with spaces, while retaining authenticated package and dependency archives."
		, updates, integrationUpdates, additions: added
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${added.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
