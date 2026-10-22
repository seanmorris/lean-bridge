#!/usr/bin/env node
/**
 * Record the returned-closure refusal-diagnostic implementation.
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
	callableClosureRefusalAddedPaths, callableClosureRefusalChangedPaths
	, callableClosureRefusalHistoryPath, callableClosureRefusalImplementation
	, callableClosureRefusalImplementationPaths, callableClosureRefusalPredecessor
	, reverseCallableClosureRefusalUpdate
} from "../tests/helpers/callable-closure-refusal-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callableClosureRefusalImplementation
	, "returned-closure refusal history requires its implementation commit");
assert.equal(git(["rev-parse", `${callableClosureRefusalImplementation}^`]).trim()
	, callableClosureRefusalPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callableClosureRefusalPredecessor
	, callableClosureRefusalImplementation]).trim().split("\n").sort()
, [...callableClosureRefusalImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callableClosureRefusalHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callable-closure-refusal-history-"));
const transitionSources = async (path, previous, current) => {
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
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseCallableClosureRefusalUpdate(current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${callableClosureRefusalPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of callableClosureRefusalChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, callableClosureRefusalPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of callableClosureRefusalChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of callableClosureRefusalAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callableClosureRefusalPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callableClosureRefusalHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "callable-closure-refusal-v1"
		, predecessorCommit: callableClosureRefusalPredecessor
		, implementationCommit: callableClosureRefusalImplementation
		, scope: "Returned Lean closures carrying Subtype, Fin, checked-record and nested checked arguments retain one compiler-derived validation order across Lean and native adapters. A refusing call identifies the first rejected argument and leaf through a private, one-shot thread-local diagnostic. Compiled controls establish exact refusal, stale-state clearing, recovery, disposal, and ordinary-call byte identity; this source milestone makes no installed-package or hosted-runtime claim."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
