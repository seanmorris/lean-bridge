#!/usr/bin/env node
/**
 * Record the complete zero-payload checked-record matrix closure transition.
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
	reverseZeroPayloadMatrixClosureUpdate
	, zeroPayloadMatrixClosureAddedPaths
	, zeroPayloadMatrixClosureHistoryPath
	, zeroPayloadMatrixClosureImplementation
	, zeroPayloadMatrixClosureImplementationPaths
	, zeroPayloadMatrixClosureIntegrationPaths
	, zeroPayloadMatrixClosureModifiedPaths
	, zeroPayloadMatrixClosurePredecessor
} from "../tests/helpers/zero-payload-matrix-closure-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadMatrixClosureImplementation
	, "Zero-payload matrix-closure history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${zeroPayloadMatrixClosureImplementation}^`]).trim()
, zeroPayloadMatrixClosurePredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, zeroPayloadMatrixClosurePredecessor
	, zeroPayloadMatrixClosureImplementation]).trim().split("\n").sort()
, [...zeroPayloadMatrixClosureImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadMatrixClosureHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-matrix-closure-history-"));
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
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseZeroPayloadMatrixClosureUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadMatrixClosureModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${zeroPayloadMatrixClosurePredecessor}:${path}`])
			, git(["show", `${zeroPayloadMatrixClosureImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of zeroPayloadMatrixClosureIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${zeroPayloadMatrixClosureImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of zeroPayloadMatrixClosureAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadMatrixClosurePredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(zeroPayloadMatrixClosureHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "zero-payload-checked-record-matrix-closure-v1"
		, predecessorCommit: zeroPayloadMatrixClosurePredecessor
		, implementationCommit: zeroPayloadMatrixClosureImplementation
		, scope: "Bind eleven independent immutable host archives, 44 route evidence identities, seventeen profiles, 68 copied parameter/result cells, exact recurring workflows and explicit unsupported positions into one fail-closed documentation and audit ledger."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
