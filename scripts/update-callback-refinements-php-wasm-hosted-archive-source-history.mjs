#!/usr/bin/env node
/**
 * Record the callback-refinement PHP-Wasm hosted archive/verifier milestone.
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
	callbackRefinementsPhpWasmHostedArchiveCommit
	, callbackRefinementsPhpWasmHostedArchiveFileCount
	, callbackRefinementsPhpWasmHostedArchiveFoundation
	, callbackRefinementsPhpWasmHostedArchiveFoundationAddedPaths
	, callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths
	, callbackRefinementsPhpWasmHostedArchiveHistoryPath
	, callbackRefinementsPhpWasmHostedArchiveIndexSha256
	, callbackRefinementsPhpWasmHostedArchiveIndexedFileCount
	, callbackRefinementsPhpWasmHostedArchiveIntegrationPaths
	, callbackRefinementsPhpWasmHostedArchivePredecessor
	, callbackRefinementsPhpWasmHostedArchiveRoot
	, callbackRefinementsPhpWasmHostedArchiveVerifier
	, callbackRefinementsPhpWasmHostedArchiveVerifierAddedPaths
	, callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths
	, reverseCallbackRefinementsPhpWasmHostedArchiveFoundation
	, reverseCallbackRefinementsPhpWasmHostedArchiveIntegration
	, reverseCallbackRefinementsPhpWasmHostedArchiveVerifier
} from "../tests/helpers/callback-refinements-php-wasm-hosted-archive-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const sourceAt = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackRefinementsPhpWasmHostedArchiveVerifier
	, "Callback PHP-Wasm hosted archive history is draft-only at its verifier commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${callbackRefinementsPhpWasmHostedArchiveVerifier}:${callbackRefinementsPhpWasmHostedArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed hosted archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, callbackRefinementsPhpWasmHostedArchiveCommit, "--"
	, callbackRefinementsPhpWasmHostedArchiveRoot]);
const indexPath = `${callbackRefinementsPhpWasmHostedArchiveRoot}/index.json`;
const indexBytes = sourceAt(
	callbackRefinementsPhpWasmHostedArchiveCommit, indexPath);
const index = JSON.parse(indexBytes);
assert.equal(sha256(indexBytes)
	, callbackRefinementsPhpWasmHostedArchiveIndexSha256);
assert.equal(index.files.length
	, callbackRefinementsPhpWasmHostedArchiveIndexedFileCount);
assert.equal(archivePaths.length
	, callbackRefinementsPhpWasmHostedArchiveFileCount);
const indexedPaths = [
	indexPath
	, ...index.files.map(file =>
		`${callbackRefinementsPhpWasmHostedArchiveRoot}/${file.path}`)
].sort();
assert.deepEqual(archivePaths, indexedPaths);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, callbackRefinementsPhpWasmHostedArchiveFoundation
	, callbackRefinementsPhpWasmHostedArchiveCommit]), archivePaths);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=MD"
	, callbackRefinementsPhpWasmHostedArchiveFoundation
	, callbackRefinementsPhpWasmHostedArchiveCommit]), []);
const foundationAdditions = names(["diff", "--name-only", "--diff-filter=A"
	, callbackRefinementsPhpWasmHostedArchivePredecessor
	, callbackRefinementsPhpWasmHostedArchiveFoundation]);
assert.deepEqual(foundationAdditions
	, [...callbackRefinementsPhpWasmHostedArchiveFoundationAddedPaths].sort());
const foundationUpdatesPaths = names(["diff", "--name-only", "--diff-filter=M"
	, callbackRefinementsPhpWasmHostedArchivePredecessor
	, callbackRefinementsPhpWasmHostedArchiveFoundation]);
assert.deepEqual(foundationUpdatesPaths
	, [...callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths].sort());
const verifierAdditions = names(["diff", "--name-only", "--diff-filter=A"
	, callbackRefinementsPhpWasmHostedArchiveCommit
	, callbackRefinementsPhpWasmHostedArchiveVerifier]);
assert.deepEqual(verifierAdditions
	, [...callbackRefinementsPhpWasmHostedArchiveVerifierAddedPaths].sort());
const verifierUpdatesPaths = names(["diff", "--name-only", "--diff-filter=M"
	, callbackRefinementsPhpWasmHostedArchiveCommit
	, callbackRefinementsPhpWasmHostedArchiveVerifier]);
assert.deepEqual(verifierUpdatesPaths
	, [...callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths].sort());

const historyAdditions = Object.freeze([
	"scripts/update-callback-refinements-php-wasm-hosted-archive-source-history.mjs"
	, "tests/helpers/callback-refinements-php-wasm-hosted-archive-source-history.mjs"
	, "tests/helpers/callback-refinements-php-wasm-hosted-archive-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-callback-refinements-hosted-archive-history-"));
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
	const foundationUpdates = [];
	for(const path of callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths)
		foundationUpdates.push(await transition(path
			, sourceAt(callbackRefinementsPhpWasmHostedArchivePredecessor, path)
			, sourceAt(callbackRefinementsPhpWasmHostedArchiveFoundation, path)
			, reverseCallbackRefinementsPhpWasmHostedArchiveFoundation));
	const verifierUpdates = [];
	for(const path of callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths)
		verifierUpdates.push(await transition(path
			, sourceAt(callbackRefinementsPhpWasmHostedArchiveCommit, path)
			, sourceAt(callbackRefinementsPhpWasmHostedArchiveVerifier, path)
			, reverseCallbackRefinementsPhpWasmHostedArchiveVerifier));
	const integrationUpdates = [];
	for(const path of callbackRefinementsPhpWasmHostedArchiveIntegrationPaths)
		integrationUpdates.push(await transition(path
			, sourceAt(callbackRefinementsPhpWasmHostedArchiveVerifier, path)
			, await readFile(path, "utf8")
			, reverseCallbackRefinementsPhpWasmHostedArchiveIntegration));
	const integrationPaths = names(["diff", "--name-only", "--diff-filter=M"
		, callbackRefinementsPhpWasmHostedArchiveVerifier, "--"]);
	assert.deepEqual(integrationPaths
		, [...callbackRefinementsPhpWasmHostedArchiveIntegrationPaths].sort());
	const additions = [];
	for(const path of [
		...callbackRefinementsPhpWasmHostedArchiveFoundationAddedPaths
		, ...callbackRefinementsPhpWasmHostedArchiveVerifierAddedPaths
		, ...historyAdditions
	]) additions.push({
		path, currentSha256: sha256(await readFile(path))
	});
	await writeFile(callbackRefinementsPhpWasmHostedArchiveHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-refinements-php-wasm-hosted-archive-v1"
			, predecessorCommit:
				callbackRefinementsPhpWasmHostedArchivePredecessor
			, foundationCommit:
				callbackRefinementsPhpWasmHostedArchiveFoundation
			, archiveCommit: callbackRefinementsPhpWasmHostedArchiveCommit
			, verifierCommit: callbackRefinementsPhpWasmHostedArchiveVerifier
			, scope: "Immutable hosted PHP-Wasm evidence retains and independently replays ordinary and reviewed Fin and checked-record callback routes, complete package handoffs, exact source roles and every byte of the original GitHub artifact."
			, archive: {
				root: callbackRefinementsPhpWasmHostedArchiveRoot
				, indexSha256:
					callbackRefinementsPhpWasmHostedArchiveIndexSha256
				, indexedFileCount:
					callbackRefinementsPhpWasmHostedArchiveIndexedFileCount
				, archiveFileCount:
					callbackRefinementsPhpWasmHostedArchiveFileCount
			}
			, foundationUpdates, verifierUpdates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${archivePaths.length} archive files, `
		+ `${foundationUpdates.length + verifierUpdates.length} source `
		+ `transitions and ${integrationUpdates.length} integrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
