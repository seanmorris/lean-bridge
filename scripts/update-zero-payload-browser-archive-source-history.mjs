#!/usr/bin/env node
/**
 * Record the exact zero-payload browser archive-tooling milestone.
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
	reverseZeroPayloadBrowserArchiveUpdate
	, zeroPayloadBrowserArchiveChangedPaths
	, zeroPayloadBrowserArchiveHistoryPath
	, zeroPayloadBrowserArchiveImplementation
	, zeroPayloadBrowserArchiveIntegrationPaths
	, zeroPayloadBrowserArchivePredecessor
} from "../tests/helpers/zero-payload-browser-archive-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadBrowserArchiveImplementation
	, "Zero-payload browser archive history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadBrowserArchiveHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload browser archive history");

const applicationAdditions = Object.freeze([
	"scripts/archive-zero-payload-checked-record-browser-evidence.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-browser-archive-source-history.mjs"
	, "tests/helpers/zero-payload-browser-archive-source-history.mjs"
	, "tests/helpers/zero-payload-browser-archive-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-archive-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
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
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseZeroPayloadBrowserArchiveUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadBrowserArchiveChangedPaths)
		updates.push(await transition(path, zeroPayloadBrowserArchivePredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadBrowserArchiveIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadBrowserArchiveImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadBrowserArchivePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadBrowserArchiveImplementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadBrowserArchiveImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadBrowserArchiveIntegrationPaths
		, "tests/zero-payload-checked-record-javascript.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-browser-archive-source-v1"
		, predecessorCommit: zeroPayloadBrowserArchivePredecessor
		, implementationCommit: zeroPayloadBrowserArchiveImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Hosted zero-payload browser evidence can be frozen only from authenticated successful API records and a byte-exact original artifact."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadBrowserArchiveHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and 0 type-surface pointers.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
