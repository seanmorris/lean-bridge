#!/usr/bin/env node
/**
 * Record the hosted Rust dependent checked-record archive milestone.
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
	dependentCheckedRecordRustArchiveAddedFileCount
	, dependentCheckedRecordRustArchiveFileCount
	, dependentCheckedRecordRustArchiveFoundationAddedPaths
	, dependentCheckedRecordRustArchiveHistoryPath
	, dependentCheckedRecordRustArchiveImplementation
	, dependentCheckedRecordRustArchiveIndexSha256
	, dependentCheckedRecordRustArchiveIndexedFileCount
	, dependentCheckedRecordRustArchiveIntegrationPaths
	, dependentCheckedRecordRustArchivePredecessor
	, dependentCheckedRecordRustArchiveRoot
	, reverseDependentCheckedRecordRustArchiveUpdate
} from "../tests/helpers/dependent-checked-record-rust-archive-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = path => git([
	"show", `${dependentCheckedRecordRustArchiveImplementation}:${path}`
]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordRustArchiveImplementation
	, "Dependent Rust archive history is draft-only at its implementation commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentCheckedRecordRustArchiveImplementation}:${dependentCheckedRecordRustArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed Rust archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, dependentCheckedRecordRustArchiveImplementation, "--"
	, dependentCheckedRecordRustArchiveRoot]);
const index = JSON.parse(source(
	`${dependentCheckedRecordRustArchiveRoot}/index.json`));
assert.equal(index.files.length
	, dependentCheckedRecordRustArchiveIndexedFileCount);
assert.equal(sha256(source(
	`${dependentCheckedRecordRustArchiveRoot}/index.json`))
, dependentCheckedRecordRustArchiveIndexSha256);
assert.equal(archivePaths.length, dependentCheckedRecordRustArchiveFileCount);
assert.deepEqual(archivePaths, [
	`${dependentCheckedRecordRustArchiveRoot}/index.json`
	, ...index.files.map(entry =>
		`${dependentCheckedRecordRustArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordRustArchivePredecessor
	, dependentCheckedRecordRustArchiveImplementation]), []);
const expectedAdded = [
	...archivePaths, ...dependentCheckedRecordRustArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordRustArchivePredecessor
	, dependentCheckedRecordRustArchiveImplementation]), expectedAdded);
assert.equal(expectedAdded.length
	, dependentCheckedRecordRustArchiveAddedFileCount);

const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-rust-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-rust-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-rust-archive-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const actualHashes = new Map();
for(const path of dependentCheckedRecordRustArchiveIntegrationPaths)
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
	, "Type-surface reconciliation must advance Rust archive integrations");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-rust-archive-history-"
));
const transition = async path => {
	const previous = source(path);
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
	assert.equal(reverseDependentCheckedRecordRustArchiveUpdate(
		current, update), previous);
	return update;
};

try
{
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordRustArchiveIntegrationPaths)
		integrationUpdates.push(await transition(path));
	const additions = [];
	for(const path of [
		...dependentCheckedRecordRustArchiveFoundationAddedPaths
		, ...historyAdditions
	]) {
		if(historyAdditions.includes(path))
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${dependentCheckedRecordRustArchiveImplementation}:${path}`]
			, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordRustArchiveImplementation, "--"]);
	assert.deepEqual(modified, [
		typeSurfacePath, ...dependentCheckedRecordRustArchiveIntegrationPaths
	].sort());
	await writeFile(dependentCheckedRecordRustArchiveHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-rust-archive-source-v1"
			, predecessorCommit: dependentCheckedRecordRustArchivePredecessor
			, implementationCommit: dependentCheckedRecordRustArchiveImplementation
			, reconciledTypeSurfacePointers: advanced
			, scope: "Immutable hosted Rust dependent checked-record evidence retains all four routes, exact source roles, independent replay, the vendored dependency closure and the original GitHub artifact bytes."
			, archive: {
				root: dependentCheckedRecordRustArchiveRoot
				, indexSha256: dependentCheckedRecordRustArchiveIndexSha256
				, indexedFileCount: dependentCheckedRecordRustArchiveIndexedFileCount
				, archiveFileCount: dependentCheckedRecordRustArchiveFileCount
				, addedFileCount: dependentCheckedRecordRustArchiveAddedFileCount
			}
			, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${integrationUpdates.length} integrations, `
		+ `${additions.length} source additions and ${archivePaths.length} `
		+ `archive files.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
