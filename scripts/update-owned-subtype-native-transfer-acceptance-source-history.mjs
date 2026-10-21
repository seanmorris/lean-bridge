#!/usr/bin/env node
/**
 * Record the native owned-Subtype transfer acceptance correction.
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
	ownedSubtypeNativeTransferAcceptanceChangedPaths
	, ownedSubtypeNativeTransferAcceptanceHistoryPath
	, ownedSubtypeNativeTransferAcceptanceImplementation
	, ownedSubtypeNativeTransferAcceptanceIntegrationPaths
	, ownedSubtypeNativeTransferAcceptancePredecessor
	, reverseOwnedSubtypeNativeTransferAcceptanceUpdate
} from "../tests/helpers/owned-subtype-native-transfer-acceptance-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = ownedSubtypeNativeTransferAcceptanceImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Native owned-Subtype transfer acceptance history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeNativeTransferAcceptanceHistoryPath]).trim(), "");

const historyAdditions = Object.freeze([
	"scripts/update-owned-subtype-native-transfer-acceptance-source-history.mjs"
	, "tests/helpers/owned-subtype-native-transfer-acceptance-source-history.mjs"
	, "tests/helpers/owned-subtype-native-transfer-acceptance-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(tmpdir(), "owned-native-transfer-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
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
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseOwnedSubtypeNativeTransferAcceptanceUpdate(current, update)
		, previous);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypeNativeTransferAcceptanceChangedPaths)
		updates.push(await transition(path
			, ownedSubtypeNativeTransferAcceptancePredecessor));
	const integrationUpdates = [];
	for(const path of ownedSubtypeNativeTransferAcceptanceIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", implementation, "--", path]).trim()
			, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M", implementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...ownedSubtypeNativeTransferAcceptanceIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "owned-subtype-native-transfer-acceptance-source-v1"
		, predecessorCommit: ownedSubtypeNativeTransferAcceptancePredecessor
		, implementationCommit: implementation
		, scope: "Native owned-Subtype C++ acceptance proves that a successful transfer closes every ordinary alias sharing the transferred lease while an independently retained handle survives subsequent RAII cleanup."
		, updates, integrationUpdates, additions
	};
	await writeFile(ownedSubtypeNativeTransferAcceptanceHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
