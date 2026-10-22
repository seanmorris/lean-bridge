#!/usr/bin/env node
/**
 * Record the hosted JVM dependent checked-record archive milestone.
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
	dependentCheckedRecordJvmArchiveAddedFileCount
	, dependentCheckedRecordJvmArchiveFileCount
	, dependentCheckedRecordJvmArchiveFoundationAddedPaths
	, dependentCheckedRecordJvmArchiveHistoryPath
	, dependentCheckedRecordJvmArchiveImplementation
	, dependentCheckedRecordJvmArchiveImplementationPaths
	, dependentCheckedRecordJvmArchiveIndexSha256
	, dependentCheckedRecordJvmArchiveIndexedFileCount
	, dependentCheckedRecordJvmArchiveIntegrationPaths
	, dependentCheckedRecordJvmArchivePointerPaths
	, dependentCheckedRecordJvmArchivePredecessor
	, dependentCheckedRecordJvmArchiveRoot
	, reverseDependentCheckedRecordJvmArchiveImplementation
	, reverseDependentCheckedRecordJvmArchiveIntegration
} from "../tests/helpers/dependent-checked-record-jvm-archive-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordJvmArchiveImplementation
	, "Dependent JVM archive history is draft-only at its implementation commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentCheckedRecordJvmArchiveImplementation}:${dependentCheckedRecordJvmArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed JVM archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, dependentCheckedRecordJvmArchiveImplementation, "--"
	, dependentCheckedRecordJvmArchiveRoot]);
const index = JSON.parse(source(
	dependentCheckedRecordJvmArchiveImplementation
	, `${dependentCheckedRecordJvmArchiveRoot}/index.json`));
assert.equal(index.files.length
	, dependentCheckedRecordJvmArchiveIndexedFileCount);
assert.equal(sha256(source(
	dependentCheckedRecordJvmArchiveImplementation
	, `${dependentCheckedRecordJvmArchiveRoot}/index.json`))
, dependentCheckedRecordJvmArchiveIndexSha256);
assert.equal(archivePaths.length, dependentCheckedRecordJvmArchiveFileCount);
assert.deepEqual(archivePaths, [
	`${dependentCheckedRecordJvmArchiveRoot}/index.json`
	, ...index.files.map(entry =>
		`${dependentCheckedRecordJvmArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordJvmArchivePredecessor
	, dependentCheckedRecordJvmArchiveImplementation])
, [...dependentCheckedRecordJvmArchiveImplementationPaths]);
const expectedAdded = [
	...archivePaths, ...dependentCheckedRecordJvmArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordJvmArchivePredecessor
	, dependentCheckedRecordJvmArchiveImplementation]), expectedAdded);
assert.equal(expectedAdded.length
	, dependentCheckedRecordJvmArchiveAddedFileCount);

const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-jvm-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-jvm-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-jvm-archive-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const actualHashes = new Map();
for(const path of dependentCheckedRecordJvmArchivePointerPaths)
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
	, "Type-surface reconciliation must advance JVM archive integrations");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-jvm-archive-history-"
));
const transition = async (path, previous, current) => {
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
	return {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
};

try
{
	const implementationUpdates = [];
	for(const path of dependentCheckedRecordJvmArchiveImplementationPaths)
	{
		const update = await transition(path
			, source(dependentCheckedRecordJvmArchivePredecessor, path)
			, source(dependentCheckedRecordJvmArchiveImplementation, path));
		assert.equal(reverseDependentCheckedRecordJvmArchiveImplementation(
			source(dependentCheckedRecordJvmArchiveImplementation, path)
			, update), source(
			dependentCheckedRecordJvmArchivePredecessor, path));
		implementationUpdates.push(update);
	}
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordJvmArchiveIntegrationPaths)
	{
		const update = await transition(path
			, source(dependentCheckedRecordJvmArchiveImplementation, path)
			, await readFile(path, "utf8"));
		assert.equal(reverseDependentCheckedRecordJvmArchiveIntegration(
			await readFile(path, "utf8"), update)
		, source(dependentCheckedRecordJvmArchiveImplementation, path));
		integrationUpdates.push(update);
	}
	const additions = [];
	for(const path of [
		...dependentCheckedRecordJvmArchiveFoundationAddedPaths
		, ...historyAdditions
	]) {
		if(historyAdditions.includes(path))
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${dependentCheckedRecordJvmArchiveImplementation}:${path}`]
			, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordJvmArchiveImplementation, "--"]);
	assert.deepEqual(modified
		, [...dependentCheckedRecordJvmArchiveIntegrationPaths].sort());
	await writeFile(dependentCheckedRecordJvmArchiveHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-jvm-archive-source-v1"
			, predecessorCommit: dependentCheckedRecordJvmArchivePredecessor
			, implementationCommit: dependentCheckedRecordJvmArchiveImplementation
			, reconciledTypeSurfacePointers: advanced
			, scope: "Immutable hosted JVM dependent checked-record evidence retains all four routes, exact Temurin and Kotlin tools, source roles, independent replay and the original GitHub artifact bytes."
			, archive: {
				root: dependentCheckedRecordJvmArchiveRoot
				, indexSha256: dependentCheckedRecordJvmArchiveIndexSha256
				, indexedFileCount: dependentCheckedRecordJvmArchiveIndexedFileCount
				, archiveFileCount: dependentCheckedRecordJvmArchiveFileCount
				, addedFileCount: dependentCheckedRecordJvmArchiveAddedFileCount
			}
			, implementationUpdates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${implementationUpdates.length} implementation, `
		+ `${integrationUpdates.length} integrations, ${additions.length} source `
		+ `additions and ${archivePaths.length} archive files.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
