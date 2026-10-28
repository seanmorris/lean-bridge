#!/usr/bin/env node
/**
 * Record the managed callback-Fin diagnostic contract as reversible history.
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
	callbackFinDiagnosticContractAddedPaths
	, callbackFinDiagnosticContractChangedPaths
	, callbackFinDiagnosticContractHistoryPath
	, callbackFinDiagnosticContractImplementation
	, callbackFinDiagnosticContractIntegrationPaths
	, callbackFinDiagnosticContractPredecessor
	, reverseCallbackFinDiagnosticContractUpdate
} from "../tests/helpers/callback-fin-diagnostic-contract-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = callbackFinDiagnosticContractPredecessor;
const implementation = callbackFinDiagnosticContractImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Callback Fin diagnostic history requires its implementation commit");
assert.equal(git(["show", "-s", "--format=%P", implementation]).trim()
	, predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackFinDiagnosticContractChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinDiagnosticContractHistoryPath]).trim(), "");
for(const path of callbackFinDiagnosticContractIntegrationPaths)
	assert.notEqual(git(["diff", "HEAD", "--name-only", "--", path]).trim()
		, "", path);
for(const path of callbackFinDiagnosticContractAddedPaths)
	assert.equal(names(["ls-files", "--others", "--exclude-standard", "--", path]).at(0)
		, path);

const directory = await mkdtemp(join(tmpdir(), "lean-callback-fin-diagnostic-history-"));
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
	assert.equal(reverseCallbackFinDiagnosticContractUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackFinDiagnosticContractChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of callbackFinDiagnosticContractIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackFinDiagnosticContractAddedPaths)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(callbackFinDiagnosticContractHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-fin-diagnostic-contract-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Align the installed .NET, Java and Kotlin callback-Fin acceptance fixtures with the path-specific diagnostics already emitted by the authenticated native adapter. Retain exact scalar, nested-array and nominal-field rejection text instead of accepting the obsolete generic copied-input message."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, ${integrationUpdates.length} integration updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
