#!/usr/bin/env node
/**
 * Record central registration of the replay-chain memory bound.
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
	replayChainMemoryIntegrationAddedPaths
	, replayChainMemoryIntegrationBase
	, replayChainMemoryIntegrationHistoryPath
	, replayChainMemoryIntegrationPaths
	, reverseReplayChainMemoryIntegrationUpdate
} from "../tests/helpers/replay-chain-memory-integration-source-history.mjs";
import { replayChainMemoryHistoryPath } from "../tests/helpers/replay-chain-memory-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = replayChainMemoryIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), base
	, "Replay-chain memory integration history requires its exact integration base");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${base}:${replayChainMemoryIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...replayChainMemoryIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...replayChainMemoryIntegrationAddedPaths])
, [...replayChainMemoryIntegrationAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-replay-chain-integration-"));
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
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseReplayChainMemoryIntegrationUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const integrationUpdates = [];
	for(const path of replayChainMemoryIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${base}:${path}`]), await readFile(path, "utf8")));
	const additions = [];
	for(const path of replayChainMemoryIntegrationAddedPaths)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(replayChainMemoryIntegrationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "replay-chain-memory-integration-source-v1"
		, integrationBaseCommit: base
		, baseHistory: { path: replayChainMemoryHistoryPath
			, sha256: sha256(await readFile(replayChainMemoryHistoryPath)) }
		, scope: "Register the independently authenticated replay-chain memory bound in the reversible source-history hub and one schedulable Core partition. Preserve every source, evidence and support claim; this seal records only the exact hub and registration transitions."
		, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
