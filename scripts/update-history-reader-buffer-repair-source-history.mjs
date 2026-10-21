#!/usr/bin/env node
/**
 * Record the exact history-reader buffer repair.
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
	historyReaderBufferRepairChangedPaths
	, historyReaderBufferRepairHistoryPath
	, historyReaderBufferRepairImplementation
	, historyReaderBufferRepairIntegrationPaths
	, historyReaderBufferRepairPredecessor
	, reverseHistoryReaderBufferRepairUpdate
} from "../tests/helpers/history-reader-buffer-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, historyReaderBufferRepairImplementation
	, "History reader buffer repair history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, historyReaderBufferRepairHistoryPath]).trim(), ""
, "Never rewrite committed history reader buffer repair history");

const addedPaths = Object.freeze([
	"scripts/update-history-reader-buffer-repair-source-history.mjs"
	, "tests/helpers/history-reader-buffer-repair-source-history.mjs"
	, "tests/helpers/history-reader-buffer-repair-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const implementationTypeSurface = JSON.parse(git(["show"
	, `${historyReaderBufferRepairImplementation}:${typeSurfacePath}`]));
const actualHashes = new Map();
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		let actual = actualHashes.get(file.path);
		if(actual === undefined)
		{
			actual = sha256(await readFile(file.path));
			actualHashes.set(file.path, actual);
		}
		if(file.sha256 !== actual) file.sha256 = actual;
	}
const implementationHashes = new Map();
for(const evidence of implementationTypeSurface.evidence)
	for(const file of evidence.files)
		implementationHashes.set(`${evidence.id}\0${file.path}`, file.sha256);
const advanced = typeSurface.evidence.reduce((count, evidence) => count
	+ evidence.files.filter(file => implementationHashes.get(
		`${evidence.id}\0${file.path}`
	) !== file.sha256).length, 0);
assert.ok(advanced > 0
	, "Type-surface reconciliation must advance the implementation snapshot");
await writeFile(typeSurfacePath
	, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-history-reader-buffer-repair-history-"
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
		diff = git(["diff", "--histogram", "--no-index"
			, "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0"
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
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseHistoryReaderBufferRepairUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of historyReaderBufferRepairChangedPaths)
		updates.push(await transition(
			path, historyReaderBufferRepairPredecessor
		));
	const integrationUpdates = [];
	for(const path of historyReaderBufferRepairIntegrationPaths)
		integrationUpdates.push(await transition(
			path, historyReaderBufferRepairImplementation
		));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, historyReaderBufferRepairImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, historyReaderBufferRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/type-surface.v1.json"
		, ...historyReaderBufferRepairIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "history-reader-buffer-repair-source-v1"
		, predecessorCommit: historyReaderBufferRepairPredecessor
		, implementationCommit: historyReaderBufferRepairImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "docs/type-surface.v1.json outgrew the 64 MiB git buffers of the source-history readers that reproduce recorded milestones with git show, so those readers now use 512 MiB buffers; the records they verify are unchanged."
		, updates, integrationUpdates, additions
	};
	await writeFile(historyReaderBufferRepairHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} update, ${integrationUpdates.length} integrations, ${additions.length} additions and ${advanced} type-surface pointers.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
