#!/usr/bin/env node
/**
 * Record the PHP-Wasm recursive evidence replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileDependentCheckedRecordSourcePins } from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	phpWasmRecursiveEvidenceReplayRepairAddedPaths
	, phpWasmRecursiveEvidenceReplayRepairHistoryPath
	, phpWasmRecursiveEvidenceReplayRepairImplementation
	, phpWasmRecursiveEvidenceReplayRepairIntegrationPaths
	, phpWasmRecursiveEvidenceReplayRepairModifiedPaths
	, phpWasmRecursiveEvidenceReplayRepairPredecessor
	, reversePhpWasmRecursiveEvidenceReplayRepairUpdate
} from "../tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation = phpWasmRecursiveEvidenceReplayRepairImplementation;
const predecessor = phpWasmRecursiveEvidenceReplayRepairPredecessor;
const inventoryPath = "docs/type-surface.v1.json";
const initialIntegrationPaths
	= phpWasmRecursiveEvidenceReplayRepairIntegrationPaths.filter(
		path => path !== inventoryPath);

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmRecursiveEvidenceReplayRepairModifiedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${phpWasmRecursiveEvidenceReplayRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...initialIntegrationPaths].sort());

const inventory = JSON.parse(git(["show"
	, `${implementation}:${inventoryPath}`]));
const liveDigests = new Map();
for(const path of [...phpWasmRecursiveEvidenceReplayRepairModifiedPaths
	, ...initialIntegrationPaths])
	liveDigests.set(path, sha256(await readFile(path)));
const pinned = reconcileDependentCheckedRecordSourcePins(
	inventory, liveDigests);
assert.equal(pinned.refreshed, 9);
await writeFile(inventoryPath
	, JSON.stringify(pinned.inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmRecursiveEvidenceReplayRepairIntegrationPaths].sort());

const directory = await mkdtemp(join(tmpdir()
	, "lean-php-wasm-recursive-replay-history-"));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reversePhpWasmRecursiveEvidenceReplayRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of phpWasmRecursiveEvidenceReplayRepairModifiedPaths)
		updates.push(await transition(path, git(["show"
			, `${predecessor}:${path}`]), git(["show"
			, `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of phpWasmRecursiveEvidenceReplayRepairIntegrationPaths)
		integrationUpdates.push(await transition(path, git(["show"
			, `${implementation}:${path}`]), await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmRecursiveEvidenceReplayRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRecursiveEvidenceReplayRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-recursive-evidence-replay-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Reconstruct the complete PHP-Wasm recursive generator tree at its authenticated implementation commit, stop source readers at exact milestones, preserve the older copied-package closure, and refresh only affected live inventory pins."
			, pinCount: pinned.refreshed
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions with `
		+ `${pinned.refreshed} refreshed live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
