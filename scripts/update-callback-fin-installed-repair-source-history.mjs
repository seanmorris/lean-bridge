#!/usr/bin/env node
/**
 * Record the installed native callback-Fin repair as reversible source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	callbackFinInstalledRepairAddedPaths
	, callbackFinInstalledRepairChangedPaths
	, callbackFinInstalledRepairHistoryPath
	, callbackFinInstalledRepairImplementation
	, callbackFinInstalledRepairImplementationAddedPaths
	, callbackFinInstalledRepairIntegrationPaths
	, callbackFinInstalledRepairPredecessor
	, reverseCallbackFinInstalledRepairUpdate
} from "../tests/helpers/callback-fin-installed-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = callbackFinInstalledRepairPredecessor;
const implementation = callbackFinInstalledRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Installed callback Fin history requires its implementation commit");
assert.equal(git(["show", "-s", "--format=%P", implementation]).trim()
	, predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackFinInstalledRepairChangedPaths
		, ...callbackFinInstalledRepairImplementationAddedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinInstalledRepairHistoryPath]).trim(), "");
for(const path of callbackFinInstalledRepairIntegrationPaths)
	assert.notEqual(git(["diff", "HEAD", "--name-only", "--", path]).trim()
		, "", path);
for(const path of callbackFinInstalledRepairAddedPaths
	.filter(path => !callbackFinInstalledRepairImplementationAddedPaths.includes(path)))
	assert.equal(names(["ls-files", "--others", "--exclude-standard", "--", path]).at(0)
		, path);

const directory = await mkdtemp(join(
	tmpdir(), "lean-callback-fin-installed-repair-history-"
));
const lineOffsets = (source, boundaries) => {
	const result = new Map(); let line = 0, offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1; line++;
		}
		result.set(boundary, offset);
	}
	return result;
};
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
	});
	const previousOffsets = lineOffsets(previous
		, hunks.flatMap(item => [item.previousStart, item.previousEnd]));
	const currentOffsets = lineOffsets(current
		, hunks.flatMap(item => [item.currentStart, item.currentEnd]));
	const edits = hunks.map(item => ({
		start: currentOffsets.get(item.currentStart)
		, previous: previous.slice(previousOffsets.get(item.previousStart)
			, previousOffsets.get(item.previousEnd))
		, current: current.slice(currentOffsets.get(item.currentStart)
			, currentOffsets.get(item.currentEnd))
	}));
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCallbackFinInstalledRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackFinInstalledRepairChangedPaths)
		updates.push(await gitSourceHistoryTransition(
			path, predecessor, implementation
		));
	const integrationUpdates = [];
	for(const path of callbackFinInstalledRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackFinInstalledRepairAddedPaths)
	{
		const existsAtImplementation
			= callbackFinInstalledRepairImplementationAddedPaths.includes(path);
		assert.equal(git(["ls-tree", "--name-only", implementation, "--", path])
			.trim() !== "", existsAtImplementation, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackFinInstalledRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-fin-installed-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Repair the source-free installed callback-Fin matrix at its actual copied-value ABI. Preserve distinct refined callback identities when JVM and WIT erase them to one carrier, admit compiler-only Perl checked/reply annotations without widening native representations, and execute direct copied callbacks in Python, Ruby, Rust, .NET, Java, Kotlin and native PHP. Exercise the generic installed WIT callable API with checked Fin arguments, returned closures, failure recovery, identity release and unchanged public-output counts."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, ${integrationUpdates.length} integration updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
