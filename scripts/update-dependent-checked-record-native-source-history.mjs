#!/usr/bin/env node
/**
 * Record the dependent checked-record C/C++ source milestone.
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
	dependentCheckedRecordNativeChangedPaths
	, dependentCheckedRecordNativeHistoryPath
	, dependentCheckedRecordNativeImplementation
	, dependentCheckedRecordNativeIntegrationPaths
	, dependentCheckedRecordNativePredecessor
	, dependentCheckedRecordNativeTests
	, reverseDependentCheckedRecordNativeUpdate
} from "../tests/helpers/dependent-checked-record-native-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordNativeImplementation
	, "Dependent checked-record native history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, dependentCheckedRecordNativePredecessor
	, "Dependent checked-record native milestone must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordNativeHistoryPath]).trim(), ""
, "Never rewrite committed dependent checked-record native history");

const applicationAdditions = Object.freeze([
	".github/workflows/dependent-checked-record-native.yml"
	, "scripts/run-dependent-checked-record-native-ci.sh"
	, "tests/dependent-checked-record-native-foundation.test.mjs"
	, "tests/fixtures/dependent-checked-record-consumers/c.c"
	, "tests/fixtures/dependent-checked-record-consumers/cpp.cpp"
	, "tests/fixtures/dependent-checked-record-consumers/result-only-c.c"
	, "tests/fixtures/dependent-checked-record-consumers/result-only-cpp.cpp"
	, "tests/helpers/dependent-checked-record-native-fixture.mjs"
	, "tests/helpers/dependent-checked-record-native-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-native-tests.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-native-source-history.mjs"
	, "tests/helpers/dependent-checked-record-native-source-history.mjs"
	, "tests/helpers/dependent-checked-record-native-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfaceBefore = JSON.parse(git(["show"
	, `${dependentCheckedRecordNativeImplementation}:${typeSurfacePath}`]));
const actualHashes = new Map();
for(const path of new Set(typeSurface.evidence.flatMap(evidence =>
	evidence.files.map(file => file.path))))
	actualHashes.set(path, sha256(await readFile(path)));
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const actual = actualHashes.get(file.path);
		if(actual !== undefined && file.sha256 !== actual)
			file.sha256 = actual;
	}
const beforePointers = typeSurfaceBefore.evidence.flatMap(evidence =>
	evidence.files.map(file => ({ id: evidence.id, ...file })));
const afterPointers = typeSurface.evidence.flatMap(evidence =>
	evidence.files.map(file => ({ id: evidence.id, ...file })));
assert.equal(afterPointers.length, beforePointers.length);
let advanced = 0;
for(const [index, current] of afterPointers.entries())
{
	const previous = beforePointers[index];
	assert.equal(current.id, previous.id);
	assert.equal(current.path, previous.path);
	if(current.sha256 !== previous.sha256) advanced++;
}
assert.ok(advanced > 0
	, "Type-surface reconciliation must advance native milestone sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-checked-record-native-history-"
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
	if(path === "src/adoption/test-profiles.mjs")
		update.addedTests = dependentCheckedRecordNativeTests;
	assert.equal(reverseDependentCheckedRecordNativeUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordNativeChangedPaths)
		updates.push(await transition(
			path, dependentCheckedRecordNativePredecessor));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordNativeIntegrationPaths)
		integrationUpdates.push(await transition(
			path, dependentCheckedRecordNativeImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordNativePredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordNativeImplementation, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const changed = git(["diff", "--name-only"
		, dependentCheckedRecordNativePredecessor
		, dependentCheckedRecordNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed, [
		...dependentCheckedRecordNativeChangedPaths, ...applicationAdditions
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath, ...dependentCheckedRecordNativeIntegrationPaths
	].sort());
	await writeFile(dependentCheckedRecordNativeHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-checked-record-native-source-v1"
		, predecessorCommit: dependentCheckedRecordNativePredecessor
		, implementationCommit: dependentCheckedRecordNativeImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "Dependent Fin payloads install offline through independent C11/GMP and C++20/Boost packages in ordinary, reviewed, full and result-only routes."
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
