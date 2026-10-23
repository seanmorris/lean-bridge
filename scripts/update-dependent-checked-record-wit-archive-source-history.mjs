#!/usr/bin/env node
/**
 * Record the hosted WIT dependent checked-record archive verifier milestone.
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
	dependentCheckedRecordWitArchiveCommit
	, dependentCheckedRecordWitArchiveCompletedPaths
	, dependentCheckedRecordWitArchiveCompletionCommit
	, dependentCheckedRecordWitArchiveCompletionPredecessor
	, dependentCheckedRecordWitArchiveFileCount
	, dependentCheckedRecordWitArchiveFoundationAddedPaths
	, dependentCheckedRecordWitArchiveHistoryPath
	, dependentCheckedRecordWitArchiveImplementation
	, dependentCheckedRecordWitArchiveImplementationPaths
	, dependentCheckedRecordWitArchiveIndexSha256
	, dependentCheckedRecordWitArchiveInitialFileCount
	, dependentCheckedRecordWitArchiveIndexedFileCount
	, dependentCheckedRecordWitArchiveIntegrationPaths
	, dependentCheckedRecordWitArchivePredecessor
	, dependentCheckedRecordWitArchiveRoot
	, dependentCheckedRecordWitArchiveVerifierPredecessor
	, reverseDependentCheckedRecordWitArchiveImplementation
	, reverseDependentCheckedRecordWitArchiveIntegration
} from "../tests/helpers/dependent-checked-record-wit-archive-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const sourceAt = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordWitArchiveCompletionCommit
	, "Dependent WIT archive history is draft-only at its implementation commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentCheckedRecordWitArchiveCompletionCommit}:${dependentCheckedRecordWitArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed WIT archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, dependentCheckedRecordWitArchiveCompletionCommit, "--"
	, dependentCheckedRecordWitArchiveRoot]);
const indexPath = `${dependentCheckedRecordWitArchiveRoot}/index.json`;
const indexBytes = sourceAt(
	dependentCheckedRecordWitArchiveCompletionCommit, indexPath);
const index = JSON.parse(indexBytes);
assert.equal(sha256(indexBytes)
	, dependentCheckedRecordWitArchiveIndexSha256);
assert.equal(index.files.length
	, dependentCheckedRecordWitArchiveIndexedFileCount);
assert.equal(archivePaths.length, dependentCheckedRecordWitArchiveFileCount);
const indexedArchivePaths = [
	indexPath
	, ...index.files.map(entry =>
		`${dependentCheckedRecordWitArchiveRoot}/${entry.path}`)
].sort();
assert.deepEqual(archivePaths, indexedArchivePaths);
const initialArchivePaths = names(["ls-tree", "-r", "--name-only"
	, dependentCheckedRecordWitArchiveCommit, "--"
	, dependentCheckedRecordWitArchiveRoot]);
assert.equal(initialArchivePaths.length
	, dependentCheckedRecordWitArchiveInitialFileCount);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordWitArchivePredecessor
	, dependentCheckedRecordWitArchiveCommit]), initialArchivePaths);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=MD"
	, dependentCheckedRecordWitArchivePredecessor
	, dependentCheckedRecordWitArchiveCommit]), []);
const completedArchivePaths = names([
	"diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordWitArchiveCompletionPredecessor
	, dependentCheckedRecordWitArchiveCompletionCommit
]);
assert.deepEqual(completedArchivePaths
	, [...dependentCheckedRecordWitArchiveCompletedPaths]);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=MD"
	, dependentCheckedRecordWitArchiveCompletionPredecessor
	, dependentCheckedRecordWitArchiveCompletionCommit]), []);
const verifierAdditions = names([
	"diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordWitArchiveVerifierPredecessor
	, dependentCheckedRecordWitArchiveImplementation
]);
assert.deepEqual(verifierAdditions
	, [...dependentCheckedRecordWitArchiveFoundationAddedPaths].sort());
const verifierUpdates = names([
	"diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordWitArchiveVerifierPredecessor
	, dependentCheckedRecordWitArchiveImplementation
]);
assert.deepEqual(verifierUpdates
	, [...dependentCheckedRecordWitArchiveImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=D"
	, dependentCheckedRecordWitArchiveVerifierPredecessor
	, dependentCheckedRecordWitArchiveImplementation]), []);

const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-wit-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-wit-archive-source-history.mjs"
	, "tests/helpers/dependent-checked-record-wit-archive-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-wit-archive-history-"));
const transition = async (path, previous, current, reverse) => {
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
	assert.equal(reverse(current, update), previous);
	return update;
};

try
{
	const implementationUpdates = [];
	for(const path of dependentCheckedRecordWitArchiveImplementationPaths)
		implementationUpdates.push(await transition(path
			, sourceAt(dependentCheckedRecordWitArchiveVerifierPredecessor, path)
			, sourceAt(dependentCheckedRecordWitArchiveCompletionCommit, path)
			, reverseDependentCheckedRecordWitArchiveImplementation));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordWitArchiveIntegrationPaths)
		integrationUpdates.push(await transition(path
			, sourceAt(dependentCheckedRecordWitArchiveCompletionCommit, path)
			, await readFile(path, "utf8")
			, reverseDependentCheckedRecordWitArchiveIntegration));
	const integrationUpdatesPaths = names([
		"diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordWitArchiveCompletionCommit, "--"
	]);
	assert.deepEqual(integrationUpdatesPaths
		, [...dependentCheckedRecordWitArchiveIntegrationPaths].sort());
	const additions = [];
	for(const path of [
		...dependentCheckedRecordWitArchiveFoundationAddedPaths
		, ...historyAdditions
	]) additions.push({
		path, currentSha256: sha256(await readFile(path))
	});
	await writeFile(dependentCheckedRecordWitArchiveHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-wit-archive-source-v1"
			, archivePredecessorCommit:
				dependentCheckedRecordWitArchivePredecessor
			, archiveCommit: dependentCheckedRecordWitArchiveCommit
			, archiveCompletionPredecessorCommit:
				dependentCheckedRecordWitArchiveCompletionPredecessor
			, archiveCompletionCommit:
				dependentCheckedRecordWitArchiveCompletionCommit
			, verifierPredecessorCommit:
				dependentCheckedRecordWitArchiveVerifierPredecessor
			, implementationCommit:
				dependentCheckedRecordWitArchiveImplementation
			, scope: "Immutable hosted WIT dependent checked-record evidence retains and independently replays all four routes, exact source roles and every byte of the original GitHub artifact, including the root tool record."
			, archive: {
				root: dependentCheckedRecordWitArchiveRoot
				, indexSha256: dependentCheckedRecordWitArchiveIndexSha256
				, indexedFileCount:
					dependentCheckedRecordWitArchiveIndexedFileCount
				, archiveFileCount:
					dependentCheckedRecordWitArchiveFileCount
				, initialArchiveFileCount:
					dependentCheckedRecordWitArchiveInitialFileCount
				, completedPaths:
					dependentCheckedRecordWitArchiveCompletedPaths
			}
			, implementationUpdates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${archivePaths.length} archive files, `
		+ `${implementationUpdates.length} verifier transitions and `
		+ `${integrationUpdates.length} history integrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
