#!/usr/bin/env node
/**
 * Record the explicit .NET callback replay.
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
	dotnetCallbackProducerReplayAddedPaths
	, dotnetCallbackProducerReplayHistoryAddedPaths
	, dotnetCallbackProducerReplayImplementationAddedPaths
	, dotnetCallbackProducerReplayImplementationPaths
	, dotnetCallbackProducerReplayChangedPaths
	, dotnetCallbackProducerReplayCommits
	, dotnetCallbackProducerReplayHistoryPath
	, dotnetCallbackProducerReplayImplementation
	, dotnetCallbackProducerReplayIntegrationBase
	, dotnetCallbackProducerReplayIntegrationPaths
	, dotnetCallbackProducerReplayPredecessor
	, reverseDotnetCallbackProducerReplayUpdate
} from "../tests/helpers/dotnet-callback-producer-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = dotnetCallbackProducerReplayPredecessor;
const implementation = dotnetCallbackProducerReplayImplementation;
const integrationBase = dotnetCallbackProducerReplayIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, ".NET callback replay history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, dotnetCallbackProducerReplayCommits);
for(const [index, revision] of dotnetCallbackProducerReplayCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : dotnetCallbackProducerReplayCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...dotnetCallbackProducerReplayImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...dotnetCallbackProducerReplayChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...dotnetCallbackProducerReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dotnetCallbackProducerReplayHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dotnetCallbackProducerReplayIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dotnetCallbackProducerReplayHistoryAddedPaths])
, [...dotnetCallbackProducerReplayHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-dotnet-callback-producer-replay-history-"
));
// Retain only requested hunk boundaries, not millions of per-line strings.
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
};
const transition = async (path, previous, current) => {
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount
		};
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const edits = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseDotnetCallbackProducerReplayUpdate(
		current, update), previous, path);
	return update;
};

try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of dotnetCallbackProducerReplayChangedPaths)
		updates.push(await transition(path, git(["show", predecessor + ":" + path])
			, git(["show", implementation + ":" + path])));
	const integrationUpdates = [];
	for(const path of dotnetCallbackProducerReplayIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of dotnetCallbackProducerReplayAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(dotnetCallbackProducerReplayImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(dotnetCallbackProducerReplayHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dotnet-callback-producer-replay-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: dotnetCallbackProducerReplayCommits
			, integrationBaseCommit: integrationBase
			, scope: "Bind all 26 archived .NET callback reports, including four standalone NuGet packages and both seven-target combined releases, to producer 72d123d69917f1145ec03d8624b6a08c3b2be6bc. Authenticate 189 imports from 29 entry modules, preserve deferred reads at that producer, and pin omitted Boost data and license bytes separately. Keep the current verifiers and every ownership, execution, packaging, sanitizer and relocation assertion. Thread the same producer dependencies through the Python/Ruby combined readers; do not replace current checks with old verifier modules. Preserve live generators for fresh runs and check valid controls before all 14 original report mutations. No inventory, original receipt, archive, runtime implementation or support claim changes. Full historical source acceptance and final Core remain hosted gates. Standalone Python, JVM and PHP-Wasm replay repairs remain separate."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
