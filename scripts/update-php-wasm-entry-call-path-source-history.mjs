#!/usr/bin/env node
/**
 * Record the compiler-derived PHP-Wasm entry call-path oracle.
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
	phpWasmEntryCallPathAddedPaths
	, phpWasmEntryCallPathChangedPaths
	, phpWasmEntryCallPathHistoryPath
	, phpWasmEntryCallPathImplementation
	, phpWasmEntryCallPathImplementationAdditions
	, phpWasmEntryCallPathIntegrationPaths
	, phpWasmEntryCallPathPredecessor
	, reversePhpWasmEntryCallPathUpdate
} from "../tests/helpers/php-wasm-entry-call-path-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation = phpWasmEntryCallPathImplementation;
const predecessor = phpWasmEntryCallPathPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "PHP-Wasm entry call-path history requires its exact implementation commit");
// Diagnostics and the plan oracle are two adjacent implementation commits.
assert.equal(git(["rev-parse", `${implementation}~2`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...phpWasmEntryCallPathChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...phpWasmEntryCallPathImplementationAdditions].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryCallPathHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmEntryCallPathIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryCallPathAddedPaths])
, [...phpWasmEntryCallPathAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-call-path-history-"
));
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
	for(const line of currentLines)
		offsets.push(offsets.at(-1) + line.length);
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
	assert.equal(reversePhpWasmEntryCallPathUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of phpWasmEntryCallPathChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of phpWasmEntryCallPathIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of [...phpWasmEntryCallPathImplementationAdditions, ...phpWasmEntryCallPathAddedPaths])
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmEntryCallPathHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-call-path-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Plan installed PHP-Wasm entry probes from compiler-derived call paths: per-position graph validators in generated conversion order, module-initialized and reduced-arity entries classified from retained compiler inputs, owned lease closure on every call, and bounded failed-consumer diagnostics with a retained failed deployment."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
