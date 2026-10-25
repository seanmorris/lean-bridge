#!/usr/bin/env node
/**
 * Record the explicit PHP-Wasm entry diagnostic retention.
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
	phpWasmEntryDiagnosticRetentionAddedPaths
	, phpWasmEntryDiagnosticRetentionHistoryAddedPaths
	, phpWasmEntryDiagnosticRetentionImplementationAddedPaths
	, phpWasmEntryDiagnosticRetentionImplementationPaths
	, phpWasmEntryDiagnosticRetentionChangedPaths
	, phpWasmEntryDiagnosticRetentionCommits
	, phpWasmEntryDiagnosticRetentionHistoryPath
	, phpWasmEntryDiagnosticRetentionImplementation
	, phpWasmEntryDiagnosticRetentionIntegrationBase
	, phpWasmEntryDiagnosticRetentionIntegrationPaths
	, phpWasmEntryDiagnosticRetentionPredecessor
	, reversePhpWasmEntryDiagnosticRetentionUpdate
} from "../tests/helpers/php-wasm-entry-diagnostic-retention-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = phpWasmEntryDiagnosticRetentionPredecessor;
const implementation = phpWasmEntryDiagnosticRetentionImplementation;
const integrationBase = phpWasmEntryDiagnosticRetentionIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "PHP-Wasm entry diagnostic retention history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, phpWasmEntryDiagnosticRetentionCommits);
for(const [index, revision] of phpWasmEntryDiagnosticRetentionCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : phpWasmEntryDiagnosticRetentionCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmEntryDiagnosticRetentionImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...phpWasmEntryDiagnosticRetentionChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...phpWasmEntryDiagnosticRetentionImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryDiagnosticRetentionHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmEntryDiagnosticRetentionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryDiagnosticRetentionHistoryAddedPaths])
, [...phpWasmEntryDiagnosticRetentionHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-diagnostic-retention-history-"
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
	assert.equal(reversePhpWasmEntryDiagnosticRetentionUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of phpWasmEntryDiagnosticRetentionChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of phpWasmEntryDiagnosticRetentionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmEntryDiagnosticRetentionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(phpWasmEntryDiagnosticRetentionImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(phpWasmEntryDiagnosticRetentionHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-diagnostic-retention-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: phpWasmEntryDiagnosticRetentionCommits
			, integrationBaseCommit: integrationBase
			, scope: "Retain original PHP-Wasm artifact ZIP bytes in authenticated Git-safe ranges and preserve every extracted file, with independent reconstruction and closed output comparison. Refuse symlinks, traversal, duplicate entries, encrypted or oversized members, malformed streams, forged byte receipts, missing output and hidden extra files before byte acceptance. Add diagnostic-only capture/check CLIs preserving untouched run/job/artifact APIs, actual source/run/attempt/upload identity and both producer/archiver source snapshots. Live and failed runs remain diagnostic-only with zero replayed routes; malformed containers retain raw API-bound bytes without extraction. Require the archiver exact clean source checkout, fresh destinations, exclusive writes and minimum free space. Register nine focused storage/diagnostic tests. The complete matrix acceptance remains separate required work under VO #2061/#1828; diagnostic-only partial retention must never imply installed or mathematical acceptance. No support inventory, existing workflow, record verifier or historical evidence changes."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
