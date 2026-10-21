#!/usr/bin/env node
/**
 * Record the remaining-host callback Subtype runtime repair.
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
	callbackSubtypeRemainingRuntimeRepairChangedPaths
	, callbackSubtypeRemainingRuntimeRepairHistoryPath
	, callbackSubtypeRemainingRuntimeRepairImplementation
	, callbackSubtypeRemainingRuntimeRepairIntegrationPaths
	, callbackSubtypeRemainingRuntimeRepairPredecessor
	, reverseCallbackSubtypeRemainingRuntimeRepairUpdate
} from "../tests/helpers/callback-subtype-remaining-runtime-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = callbackSubtypeRemainingRuntimeRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Remaining-host callback Subtype runtime repair history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeRemainingRuntimeRepairHistoryPath]).trim(), "");
const additions = Object.freeze([
	"scripts/update-callback-subtype-remaining-runtime-repair-source-history.mjs"
	, "tests/helpers/callback-subtype-remaining-runtime-repair-source-history.mjs"
	, "tests/helpers/callback-subtype-remaining-runtime-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(tmpdir(), "callback-remaining-repair-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous"), currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u), currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCallbackSubtypeRemainingRuntimeRepairUpdate(current, update), previous);
	return update;
};
try
{
	const updates = [];
	for(const path of callbackSubtypeRemainingRuntimeRepairChangedPaths)
		updates.push(await transition(path, callbackSubtypeRemainingRuntimeRepairPredecessor));
	const integrationUpdates = [];
	for(const path of callbackSubtypeRemainingRuntimeRepairIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only", implementation, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M", implementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...callbackSubtypeRemainingRuntimeRepairIntegrationPaths].sort());
	await writeFile(callbackSubtypeRemainingRuntimeRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-subtype-remaining-runtime-repair-source-v1"
		, predecessorCommit: callbackSubtypeRemainingRuntimeRepairPredecessor
		, implementationCommit: implementation
		, scope: "Native callable graphs preserve the dedicated host-callback result-refinement rejection status through managed frontends, while native PHP author configuration uses the php-native key independently of its Composer build alias."
		, updates, integrationUpdates, additions: added
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations and ${added.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
