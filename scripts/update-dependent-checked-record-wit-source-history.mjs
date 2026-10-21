#!/usr/bin/env node
/**
 * Record the dependent checked-record WIT source milestone.
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
	dependentCheckedRecordWitChangedPaths
	, dependentCheckedRecordWitHistoryPath
	, dependentCheckedRecordWitImplementation
	, dependentCheckedRecordWitIntegrationPaths
	, dependentCheckedRecordWitPredecessor
	, reverseDependentCheckedRecordWitUpdate
} from "../tests/helpers/dependent-checked-record-wit-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordWitImplementation
	, "Dependent checked-record WIT history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, dependentCheckedRecordWitPredecessor
	, "Dependent checked-record WIT milestone must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordWitHistoryPath]).trim(), ""
, "Never rewrite committed dependent checked-record WIT history");

const applicationAdditions = Object.freeze([
	".github/workflows/dependent-checked-record-wit.yml"
	, "scripts/check-dependent-checked-record-wit-ci.mjs"
	, "scripts/run-dependent-checked-record-wit-ci.sh"
	, "tests/fixtures/dependent-checked-record-consumers/wit-values.h"
	, "tests/fixtures/dependent-checked-record-consumers/wit-wasi.c"
	, "tests/helpers/dependent-checked-record-wit-ci-handoff-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-report-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-report.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-shell-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/dependent-checked-record-wit-environment-records.mjs"
	, "tests/helpers/dependent-checked-record-wit-fixture-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-fixture.mjs"
	, "tests/helpers/dependent-checked-record-wit-handoff.mjs"
	, "tests/helpers/dependent-checked-record-wit-install.mjs"
	, "tests/helpers/dependent-checked-record-wit-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-model-records.mjs"
	, "tests/helpers/dependent-checked-record-wit-model.c"
	, "tests/helpers/dependent-checked-record-wit-package-records.mjs"
	, "tests/helpers/dependent-checked-record-wit-package.mjs"
	, "tests/helpers/dependent-checked-record-wit-report.mjs"
	, "tests/helpers/dependent-checked-record-wit-resources.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-wit-source-history.mjs"
	, "tests/helpers/dependent-checked-record-wit-source-history.mjs"
	, "tests/helpers/dependent-checked-record-wit-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfacePaths = Object.freeze([
	...dependentCheckedRecordWitChangedPaths
	, ...dependentCheckedRecordWitIntegrationPaths
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
	, "Type-surface reconciliation must advance WIT milestone sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-checked-record-wit-history-"
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
	assert.equal(reverseDependentCheckedRecordWitUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordWitChangedPaths)
		updates.push(await transition(
			path, dependentCheckedRecordWitPredecessor));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordWitIntegrationPaths)
		integrationUpdates.push(await transition(
			path, dependentCheckedRecordWitImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordWitPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordWitImplementation, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const changed = git(["diff", "--name-only"
		, dependentCheckedRecordWitPredecessor
		, dependentCheckedRecordWitImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed, [
		...dependentCheckedRecordWitChangedPaths, ...applicationAdditions
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordWitImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath, ...dependentCheckedRecordWitIntegrationPaths
	].sort());
	await writeFile(dependentCheckedRecordWitHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-checked-record-wit-source-v1"
		, predecessorCommit: dependentCheckedRecordWitPredecessor
		, implementationCommit: dependentCheckedRecordWitImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "Dependent Fin payloads install offline as WIT/WASI components consumed by an independent Wasmtime caller, in ordinary, reviewed, full and result-only routes."
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
