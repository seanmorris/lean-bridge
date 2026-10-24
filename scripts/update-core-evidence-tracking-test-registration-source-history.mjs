#!/usr/bin/env node
/**
 * Record the Core evidence-tracking test registration repair.
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
	coreEvidenceTrackingTestRegistrationAddedPaths
	, coreEvidenceTrackingTestRegistrationChangedPaths
	, coreEvidenceTrackingTestRegistrationHistoryPath
	, coreEvidenceTrackingTestRegistrationImplementation
	, coreEvidenceTrackingTestRegistrationIntegrationPaths
	, coreEvidenceTrackingTestRegistrationPredecessor
	, reverseCoreEvidenceTrackingTestRegistrationUpdate
} from "../tests/helpers/core-evidence-tracking-test-registration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation = coreEvidenceTrackingTestRegistrationImplementation;
const predecessor = coreEvidenceTrackingTestRegistrationPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Core registration history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreEvidenceTrackingTestRegistrationChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreEvidenceTrackingTestRegistrationHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...coreEvidenceTrackingTestRegistrationIntegrationPaths]
	.sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreEvidenceTrackingTestRegistrationAddedPaths])
, [...coreEvidenceTrackingTestRegistrationAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-evidence-registration-history-"
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
	assert.equal(reverseCoreEvidenceTrackingTestRegistrationUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of coreEvidenceTrackingTestRegistrationChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of coreEvidenceTrackingTestRegistrationIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of coreEvidenceTrackingTestRegistrationAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreEvidenceTrackingTestRegistrationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-evidence-tracking-test-registration-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Classify the committed type-surface evidence tracking test in the complete Core contract profile so all six hosted shards execute instead of stopping during manifest construction."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
