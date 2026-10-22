#!/usr/bin/env node
/**
 * Record the owned checked-record PHP-Wasm retained handoff transition.
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
	ownedCheckedRecordPhpWasmRetainedHandoffAddedPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath
	, ownedCheckedRecordPhpWasmRetainedHandoffImplementation
	, ownedCheckedRecordPhpWasmRetainedHandoffImplementationPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffIntegrationPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffModifiedPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor
	, reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate
} from "../tests/helpers/owned-checked-record-php-wasm-retained-handoff-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordPhpWasmRetainedHandoffImplementation
	, "Owned checked-record PHP-Wasm retained handoff history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${ownedCheckedRecordPhpWasmRetainedHandoffImplementation}^`]).trim()
, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor
	, ownedCheckedRecordPhpWasmRetainedHandoffImplementation]).trim().split("\n").sort()
, [...ownedCheckedRecordPhpWasmRetainedHandoffImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-php-wasm-retained-handoff-history-"));
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
	assert.equal(reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordPhpWasmRetainedHandoffModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${ownedCheckedRecordPhpWasmRetainedHandoffPredecessor}:${path}`])
			, git(["show", `${ownedCheckedRecordPhpWasmRetainedHandoffImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedCheckedRecordPhpWasmRetainedHandoffIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${ownedCheckedRecordPhpWasmRetainedHandoffImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRecordPhpWasmRetainedHandoffAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-record-php-wasm-retained-handoff-v1"
			, predecessorCommit: ownedCheckedRecordPhpWasmRetainedHandoffPredecessor
			, implementationCommit: ownedCheckedRecordPhpWasmRetainedHandoffImplementation
			, scope: "Install owned PHP-Wasm package archives from the receipt-only handoff derived from retained evidence, and bind both copies to the verified package report by exact file set and bytes."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
