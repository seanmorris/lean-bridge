#!/usr/bin/env node
/**
 * Record the producer-bound C transfer and JVM runtime verifier replays and
 * this layer's added files from exact Git blobs. Hub integration is recorded
 * separately by the integrating seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	ownedProducerReplayAddedPaths
	, ownedProducerReplayChangedPaths
	, ownedProducerReplayCommits
	, ownedProducerReplayHistoryPath
	, ownedProducerReplayImplementation
	, ownedProducerReplayPredecessor
	, reverseOwnedProducerReplayUpdate
} from "../tests/helpers/owned-producer-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = ownedProducerReplayPredecessor;
const implementation = ownedProducerReplayImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), ownedProducerReplayCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of ownedProducerReplayCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : ownedProducerReplayCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${ownedProducerReplayHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedProducerReplayChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...ownedProducerReplayChangedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedProducerReplayAddedPaths])
, [...ownedProducerReplayAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-owned-producer-replay-"));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--unified=0", previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
		path
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseOwnedProducerReplayUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedProducerReplayChangedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const additions = [];
	for(const path of ownedProducerReplayAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedProducerReplayHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-producer-replay-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits: ownedProducerReplayCommits
		, scope: "Regenerate the staged C transfer (27e0eac) and owned JVM runtime (7ee68a3) evidence with the exact producer modules each receipt names, binding the replayed C module closure to that receipt's recorded sources, instead of normalizing today's generator output. Every recorded binding, header, source, native, runtime, probe, fixture and mutation check is unchanged; present-day generator behavior stays covered by the current suites. No evidence, observation or support claim changes. Hub and registration integration are recorded by the integrating seal."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
