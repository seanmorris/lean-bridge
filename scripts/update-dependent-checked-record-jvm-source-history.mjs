#!/usr/bin/env node
/**
 * Record the dependent checked-record JVM source milestone.
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
	dependentCheckedRecordJvmChangedPaths
	, dependentCheckedRecordJvmHistoryPath
	, dependentCheckedRecordJvmImplementation
	, dependentCheckedRecordJvmIntegrationPaths
	, dependentCheckedRecordJvmPredecessor
	, reverseDependentCheckedRecordJvmUpdate
} from "../tests/helpers/dependent-checked-record-jvm-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordJvmImplementation
	, "Dependent checked-record JVM history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, dependentCheckedRecordJvmPredecessor
	, "Dependent checked-record JVM milestone must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordJvmHistoryPath]).trim(), ""
, "Never rewrite committed dependent checked-record JVM history");

const applicationAdditions = Object.freeze([
	".github/workflows/dependent-checked-record-jvm.yml"
	, "scripts/check-dependent-checked-record-jvm-ci.mjs"
	, "scripts/run-dependent-checked-record-jvm-ci.sh"
	, "tests/fixtures/dependent-checked-record-consumers/java.java"
	, "tests/fixtures/dependent-checked-record-consumers/kotlin.kt"
	, "tests/helpers/dependent-checked-record-jvm-caller-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-handoff.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-policy-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-report.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-shell-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/dependent-checked-record-jvm-fixture-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-fixture.mjs"
	, "tests/helpers/dependent-checked-record-jvm-installed-static-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-model/Api.java"
	, "tests/helpers/dependent-checked-record-jvm-model/Dependent.java"
	, "tests/helpers/dependent-checked-record-jvm-model/LeanBridgeException.java"
	, "tests/helpers/dependent-checked-record-jvm-package.mjs"
	, "tests/helpers/dependent-checked-record-jvm-probe.mjs"
	, "tests/helpers/dependent-checked-record-jvm-report.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-jvm-source-history.mjs"
	, "tests/helpers/dependent-checked-record-jvm-source-history.mjs"
	, "tests/helpers/dependent-checked-record-jvm-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfacePaths = Object.freeze([
	...dependentCheckedRecordJvmChangedPaths
	, ...dependentCheckedRecordJvmIntegrationPaths
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
	, "Type-surface reconciliation must advance JVM milestone sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-checked-record-jvm-history-"
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
	assert.equal(reverseDependentCheckedRecordJvmUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordJvmChangedPaths)
		updates.push(await transition(
			path, dependentCheckedRecordJvmPredecessor));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordJvmIntegrationPaths)
		integrationUpdates.push(await transition(
			path, dependentCheckedRecordJvmImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordJvmPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordJvmImplementation, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const changed = git(["diff", "--name-only"
		, dependentCheckedRecordJvmPredecessor
		, dependentCheckedRecordJvmImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed, [
		...dependentCheckedRecordJvmChangedPaths, ...applicationAdditions
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordJvmImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath, ...dependentCheckedRecordJvmIntegrationPaths
	].sort());
	await writeFile(dependentCheckedRecordJvmHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-checked-record-jvm-source-v1"
		, predecessorCommit: dependentCheckedRecordJvmPredecessor
		, implementationCommit: dependentCheckedRecordJvmImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "Dependent Fin payloads install offline as Maven packages consumed by independent Java and Kotlin callers, in ordinary, reviewed, full and result-only routes."
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
