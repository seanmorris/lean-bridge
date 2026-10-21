#!/usr/bin/env node
/**
 * Record the nested checked-record regression-contract reconciliation.
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
	nestedCheckedRecordRegressionContractChangedPaths
	, nestedCheckedRecordRegressionContractHistoryPath
	, nestedCheckedRecordRegressionContractImplementation
	, nestedCheckedRecordRegressionContractIntegrationPaths
	, nestedCheckedRecordRegressionContractPredecessor
	, reverseNestedCheckedRecordRegressionContractUpdate
} from "../tests/helpers/nested-checked-record-regression-contract-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nestedCheckedRecordRegressionContractImplementation
	, "Nested checked-record regression history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, nestedCheckedRecordRegressionContractPredecessor
	, "Nested checked-record regression milestone must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, nestedCheckedRecordRegressionContractHistoryPath]).trim(), ""
, "Never rewrite committed nested checked-record regression history");

const historyAdditions = Object.freeze([
	"scripts/update-nested-checked-record-regression-contract-source-history.mjs"
	, "tests/helpers/nested-checked-record-regression-contract-source-history.mjs"
	, "tests/helpers/nested-checked-record-regression-contract-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfacePaths = Object.freeze([
	...nestedCheckedRecordRegressionContractChangedPaths
	, ...nestedCheckedRecordRegressionContractIntegrationPaths
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
	, "Type-surface reconciliation must advance nested record contracts");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-nested-record-contract-history-"
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
	assert.equal(reverseNestedCheckedRecordRegressionContractUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of nestedCheckedRecordRegressionContractChangedPaths)
		updates.push(await transition(
			path, nestedCheckedRecordRegressionContractPredecessor));
	const integrationUpdates = [];
	for(const path of nestedCheckedRecordRegressionContractIntegrationPaths)
		integrationUpdates.push(await transition(
			path, nestedCheckedRecordRegressionContractImplementation));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, nestedCheckedRecordRegressionContractImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const changed = git(["diff", "--name-only"
		, nestedCheckedRecordRegressionContractPredecessor
		, nestedCheckedRecordRegressionContractImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed
		, [...nestedCheckedRecordRegressionContractChangedPaths].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, nestedCheckedRecordRegressionContractImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath
		, ...nestedCheckedRecordRegressionContractIntegrationPaths
	].sort());
	await writeFile(nestedCheckedRecordRegressionContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "nested-checked-record-regression-contract-source-v1"
			, predecessorCommit: nestedCheckedRecordRegressionContractPredecessor
			, implementationCommit: nestedCheckedRecordRegressionContractImplementation
			, reconciledTypeSurfacePointers: advanced
			, scope: "Nested checked-record regressions authenticate explicit Subtype erasure and the admitted top-level rich generic checked-record contract while retaining both nested generic refusals."
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
