#!/usr/bin/env node
/**
 * Record the PHP-Wasm entry unreached-source classification.
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
	phpWasmEntryUnreachedSourceAddedPaths
	, phpWasmEntryUnreachedSourceChangedPaths
	, phpWasmEntryUnreachedSourceHistoryPath
	, phpWasmEntryUnreachedSourceImplementation
	, phpWasmEntryUnreachedSourceIntegrationPaths
	, phpWasmEntryUnreachedSourcePredecessor
	, reversePhpWasmEntryUnreachedSourceUpdate
} from "../tests/helpers/php-wasm-entry-unreached-source-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation = phpWasmEntryUnreachedSourceImplementation;
const predecessor = phpWasmEntryUnreachedSourcePredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "PHP-Wasm entry unreached-source history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmEntryUnreachedSourceChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryUnreachedSourceHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmEntryUnreachedSourceIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryUnreachedSourceAddedPaths])
, [...phpWasmEntryUnreachedSourceAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-unreached-source-history-"
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
	assert.equal(reversePhpWasmEntryUnreachedSourceUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of phpWasmEntryUnreachedSourceChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of phpWasmEntryUnreachedSourceIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmEntryUnreachedSourceAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmEntryUnreachedSourceHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-unreached-source-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Classify PHP-Wasm entry sources whose compiled wrapper no call reaches and that delegate to no reduced-arity implementation, and refuse accepted planned calls that would need them."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
