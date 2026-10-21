#!/usr/bin/env node
/**
 * Record the dependent checked-record archive route-selection repair.
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
	dependentCheckedRecordArchiveSelectionRepairChangedPaths
	, dependentCheckedRecordArchiveSelectionRepairHistoryPath
	, dependentCheckedRecordArchiveSelectionRepairImplementation
	, dependentCheckedRecordArchiveSelectionRepairIntegrationPaths
	, dependentCheckedRecordArchiveSelectionRepairPredecessor
	, reverseDependentCheckedRecordArchiveSelectionRepairUpdate
} from "../tests/helpers/dependent-checked-record-archive-selection-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordArchiveSelectionRepairImplementation
	, "Dependent archive selection repair is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, dependentCheckedRecordArchiveSelectionRepairPredecessor
	, "Dependent archive selection repair must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordArchiveSelectionRepairHistoryPath]).trim(), ""
, "Never rewrite committed dependent archive selection repair history");

const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-archive-selection-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-archive-selection-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-archive-selection-repair-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfacePaths = Object.freeze([
	...dependentCheckedRecordArchiveSelectionRepairChangedPaths
	, ...dependentCheckedRecordArchiveSelectionRepairIntegrationPaths
]);
const actualHashes = new Map();
for(const path of typeSurfacePaths)
	actualHashes.set(path, sha256(await readFile(path)));
let advanced = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const actual = actualHashes.get(file.path);
		if(actual !== undefined && file.sha256 !== actual)
		{
			file.sha256 = actual;
			advanced++;
		}
	}
assert.ok(advanced > 0
	, "Type-surface reconciliation must advance archive repair sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-archive-selection-repair-history-"
));
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
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.equal(reverseDependentCheckedRecordArchiveSelectionRepairUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordArchiveSelectionRepairChangedPaths)
		updates.push(await transition(
			path, dependentCheckedRecordArchiveSelectionRepairPredecessor));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordArchiveSelectionRepairIntegrationPaths)
		integrationUpdates.push(await transition(
			path, dependentCheckedRecordArchiveSelectionRepairImplementation));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordArchiveSelectionRepairImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const changed = git(["diff", "--name-only"
		, dependentCheckedRecordArchiveSelectionRepairPredecessor
		, dependentCheckedRecordArchiveSelectionRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed
		, [...dependentCheckedRecordArchiveSelectionRepairChangedPaths].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordArchiveSelectionRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath
		, ...dependentCheckedRecordArchiveSelectionRepairIntegrationPaths
	].sort());
	await writeFile(dependentCheckedRecordArchiveSelectionRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-archive-selection-repair-source-v1"
			, predecessorCommit: dependentCheckedRecordArchiveSelectionRepairPredecessor
			, implementationCommit: dependentCheckedRecordArchiveSelectionRepairImplementation
			, reconciledTypeSurfacePointers: advanced
			, scope: "Ruby and Rust dependent checked-record archivers resolve the shared author-route selector before processing any retained evidence."
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, `
		+ `${integrationUpdates.length} integrations, ${additions.length} `
		+ `additions and ${advanced} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
