#!/usr/bin/env node
/**
 * Record the explicit live-versus-archived value-index browser controls
 * contract repair.
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
	checkedRecordValueIndexBrowserControlsContractAddedPaths
	, checkedRecordValueIndexBrowserControlsContractChangedPaths
	, checkedRecordValueIndexBrowserControlsContractHistoryPath
	, checkedRecordValueIndexBrowserControlsContractImplementation
	, checkedRecordValueIndexBrowserControlsContractIntegrationPaths
	, checkedRecordValueIndexBrowserControlsContractPredecessor
	, reverseCheckedRecordValueIndexBrowserControlsContractUpdate
} from "../tests/helpers/checked-record-value-index-browser-controls-contract-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation
	= checkedRecordValueIndexBrowserControlsContractImplementation;
const predecessor = checkedRecordValueIndexBrowserControlsContractPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Controls-contract history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...checkedRecordValueIndexBrowserControlsContractChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, checkedRecordValueIndexBrowserControlsContractHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...checkedRecordValueIndexBrowserControlsContractIntegrationPaths]
	.sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexBrowserControlsContractAddedPaths])
, [...checkedRecordValueIndexBrowserControlsContractAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-value-index-browser-controls-history-"
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
	assert.equal(
		reverseCheckedRecordValueIndexBrowserControlsContractUpdate(
			current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of checkedRecordValueIndexBrowserControlsContractChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of checkedRecordValueIndexBrowserControlsContractIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of checkedRecordValueIndexBrowserControlsContractAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(checkedRecordValueIndexBrowserControlsContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "checked-record-value-index-browser-controls-contract-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Keep new value-index browser producers and checkers on the complete live controls contract while replaying the immutable 2026-10-19 archive against its exact historical controls contract."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
