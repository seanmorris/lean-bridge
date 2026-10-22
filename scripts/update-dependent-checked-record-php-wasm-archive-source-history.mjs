#!/usr/bin/env node
/**
 * Record the hosted PHP-Wasm dependent checked-record archive milestone.
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
	dependentCheckedRecordPhpWasmArchiveAddedFileCount
	, dependentCheckedRecordPhpWasmArchiveFileCount
	, dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths
	, dependentCheckedRecordPhpWasmArchiveHistoryPath
	, dependentCheckedRecordPhpWasmArchiveImplementation
	, dependentCheckedRecordPhpWasmArchiveImplementationPaths
	, dependentCheckedRecordPhpWasmArchiveIndexSha256
	, dependentCheckedRecordPhpWasmArchiveIndexedFileCount
	, dependentCheckedRecordPhpWasmArchiveIntegrationPaths
	, dependentCheckedRecordPhpWasmArchivePointerPaths
	, dependentCheckedRecordPhpWasmArchivePredecessor
	, dependentCheckedRecordPhpWasmArchiveRoot
	, reverseDependentCheckedRecordPhpWasmArchiveImplementation
	, reverseDependentCheckedRecordPhpWasmArchiveIntegration
} from "../tests/helpers/dependent-checked-record-php-wasm-archive-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordPhpWasmArchiveImplementation
	, "Dependent PHP-Wasm archive history is draft-only at its implementation commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentCheckedRecordPhpWasmArchiveImplementation}:${dependentCheckedRecordPhpWasmArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed PHP-Wasm archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, dependentCheckedRecordPhpWasmArchiveImplementation, "--"
	, dependentCheckedRecordPhpWasmArchiveRoot]);
const index = JSON.parse(source(
	dependentCheckedRecordPhpWasmArchiveImplementation
	, `${dependentCheckedRecordPhpWasmArchiveRoot}/index.json`));
assert.equal(index.files.length
	, dependentCheckedRecordPhpWasmArchiveIndexedFileCount);
assert.equal(sha256(source(
	dependentCheckedRecordPhpWasmArchiveImplementation
	, `${dependentCheckedRecordPhpWasmArchiveRoot}/index.json`))
, dependentCheckedRecordPhpWasmArchiveIndexSha256);
assert.equal(archivePaths.length, dependentCheckedRecordPhpWasmArchiveFileCount);
assert.deepEqual(archivePaths, [
	`${dependentCheckedRecordPhpWasmArchiveRoot}/index.json`
	, ...index.files.map(entry =>
		`${dependentCheckedRecordPhpWasmArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordPhpWasmArchivePredecessor
	, dependentCheckedRecordPhpWasmArchiveImplementation])
, [...dependentCheckedRecordPhpWasmArchiveImplementationPaths]);
const expectedAdded = [
	...archivePaths, ...dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordPhpWasmArchivePredecessor
	, dependentCheckedRecordPhpWasmArchiveImplementation]), expectedAdded);
assert.equal(expectedAdded.length
	, dependentCheckedRecordPhpWasmArchiveAddedFileCount);

const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-php-wasm-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-php-wasm-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-php-wasm-archive-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const actualHashes = new Map();
for(const path of dependentCheckedRecordPhpWasmArchivePointerPaths)
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
	, "Type-surface reconciliation must advance PHP-Wasm archive integrations");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-php-wasm-archive-history-"));
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
	for(const path of dependentCheckedRecordPhpWasmArchiveImplementationPaths)
	{
		const update = await transition(path
			, source(dependentCheckedRecordPhpWasmArchivePredecessor, path)
			, source(dependentCheckedRecordPhpWasmArchiveImplementation, path));
		assert.equal(reverseDependentCheckedRecordPhpWasmArchiveImplementation(
			source(dependentCheckedRecordPhpWasmArchiveImplementation, path)
			, update), source(
			dependentCheckedRecordPhpWasmArchivePredecessor, path));
		implementationUpdates.push(update);
	}
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordPhpWasmArchiveIntegrationPaths)
	{
		const update = await transition(path
			, source(dependentCheckedRecordPhpWasmArchiveImplementation, path)
			, await readFile(path, "utf8"));
		assert.equal(reverseDependentCheckedRecordPhpWasmArchiveIntegration(
			await readFile(path, "utf8"), update)
		, source(dependentCheckedRecordPhpWasmArchiveImplementation, path));
		integrationUpdates.push(update);
	}
	const additions = [];
	for(const path of [
		...dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths
		, ...historyAdditions
	]) {
		if(historyAdditions.includes(path))
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${dependentCheckedRecordPhpWasmArchiveImplementation}:${path}`]
			, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordPhpWasmArchiveImplementation, "--"]);
	assert.deepEqual(modified
		, [...dependentCheckedRecordPhpWasmArchiveIntegrationPaths].sort());
	await writeFile(dependentCheckedRecordPhpWasmArchiveHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-php-wasm-archive-source-v1"
			, predecessorCommit: dependentCheckedRecordPhpWasmArchivePredecessor
			, implementationCommit: dependentCheckedRecordPhpWasmArchiveImplementation
			, reconciledTypeSurfacePointers: advanced
			, scope: "Immutable hosted PHP-Wasm dependent checked-record evidence retains all four routes, compiler records, copied runtime identity, exact packages and execution observations, source roles, destructive controls and the original GitHub artifact bytes."
			, archive: {
				root: dependentCheckedRecordPhpWasmArchiveRoot
				, indexSha256: dependentCheckedRecordPhpWasmArchiveIndexSha256
				, indexedFileCount: dependentCheckedRecordPhpWasmArchiveIndexedFileCount
				, archiveFileCount: dependentCheckedRecordPhpWasmArchiveFileCount
				, addedFileCount: dependentCheckedRecordPhpWasmArchiveAddedFileCount
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
