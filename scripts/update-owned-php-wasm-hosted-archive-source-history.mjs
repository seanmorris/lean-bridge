#!/usr/bin/env node
/**
 * Record the exact owned PHP-Wasm hosted archive history.
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
	ownedPhpWasmHostedArchiveAddedPaths
	, ownedPhpWasmHostedArchiveHistoryPath
	, ownedPhpWasmHostedArchiveImplementation
	, ownedPhpWasmHostedArchiveImplementationAddedPaths
	, ownedPhpWasmHostedArchiveImplementationPaths
	, ownedPhpWasmHostedArchiveIntegrationPaths
	, ownedPhpWasmHostedArchiveModifiedPaths
	, ownedPhpWasmHostedArchivePredecessor
	, reverseOwnedPhpWasmHostedArchiveUpdate
} from "../tests/helpers/owned-php-wasm-hosted-archive-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = ownedPhpWasmHostedArchiveImplementation;
const predecessor = ownedPhpWasmHostedArchivePredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Owned PHP-Wasm hosted archive history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedPhpWasmHostedArchiveImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedPhpWasmHostedArchiveHistoryPath]).trim(), "");

assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedPhpWasmHostedArchiveModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedPhpWasmHostedArchiveImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"])
	, [...ownedPhpWasmHostedArchiveIntegrationPaths].sort()
	, "Only the recorded hub and test registration may change during integration");

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-php-wasm-hosted-archive-"
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
	const currentOffsets = [0];
	for(const line of currentLines)
		currentOffsets.push(currentOffsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseOwnedPhpWasmHostedArchiveUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedPhpWasmHostedArchiveModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedPhpWasmHostedArchiveIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedPhpWasmHostedArchiveAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedPhpWasmHostedArchiveHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-php-wasm-hosted-archive-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Add independent PHP-Wasm owned checked-record hosted archiving with exact per-mode reports, four retained package sets, Node and Chromium execution cells, pinned runtime manifests, original API and ZIP bytes, and producer/consumer/checker/archiver source roles. Bind reported component, binding IR and runtime identities to retained npm and Composer package receipts. Preserve native PHP separation, all older evidence, and live inventory pins. Actual hosted capture and matrix promotion remain separate milestones."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
