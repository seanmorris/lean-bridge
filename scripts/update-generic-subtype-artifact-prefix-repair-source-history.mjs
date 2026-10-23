#!/usr/bin/env node
/**
 * Record the exact generic-Subtype hosted artifact-prefix repair.
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
	genericSubtypeArtifactPrefixRepairAddedPaths
	, genericSubtypeArtifactPrefixRepairHistoryPath
	, genericSubtypeArtifactPrefixRepairImplementation
	, genericSubtypeArtifactPrefixRepairImplementationPaths
	, genericSubtypeArtifactPrefixRepairIntegrationPaths
	, genericSubtypeArtifactPrefixRepairPredecessor
	, reverseGenericSubtypeArtifactPrefixRepairUpdate
} from "../tests/helpers/generic-subtype-artifact-prefix-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = genericSubtypeArtifactPrefixRepairImplementation;
const predecessor = genericSubtypeArtifactPrefixRepairPredecessor;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Generic Subtype artifact-prefix history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "Generic Subtype artifact-prefix history requires its exact predecessor");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...genericSubtypeArtifactPrefixRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...genericSubtypeArtifactPrefixRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.equal(names(["ls-tree", "--name-only", implementation, "--"
	, genericSubtypeArtifactPrefixRepairHistoryPath]).length, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...genericSubtypeArtifactPrefixRepairIntegrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-generic-subtype-prefix-history-"));
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
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
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
	assert.equal(reverseGenericSubtypeArtifactPrefixRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of genericSubtypeArtifactPrefixRepairImplementationPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of genericSubtypeArtifactPrefixRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(implementation, path), await readFile(path, "utf8")));
	const additions = [];
	for(const path of genericSubtypeArtifactPrefixRepairAddedPaths)
	{
		assert.equal(names(["ls-tree", "--name-only", implementation
			, "--", path]).length, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(genericSubtypeArtifactPrefixRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "generic-subtype-artifact-prefix-repair-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Store generic-Subtype artifact prefixes without a trailing separator so the shared hosted verifier authenticates the exact workflow artifact names."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
