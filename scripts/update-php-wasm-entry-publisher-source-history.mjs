#!/usr/bin/env node
/**
 * Record the explicit PHP-Wasm entry publisher.
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
	phpWasmEntryPublisherAddedPaths
	, phpWasmEntryPublisherHistoryAddedPaths
	, phpWasmEntryPublisherImplementationAddedPaths
	, phpWasmEntryPublisherImplementationPaths
	, phpWasmEntryPublisherChangedPaths
	, phpWasmEntryPublisherCommits
	, phpWasmEntryPublisherHistoryPath
	, phpWasmEntryPublisherImplementation
	, phpWasmEntryPublisherIntegrationBase
	, phpWasmEntryPublisherIntegrationPaths
	, phpWasmEntryPublisherPredecessor
	, phpWasmEntryPublisherPins
	, reversePhpWasmEntryPublisherUpdate
} from "../tests/helpers/php-wasm-entry-publisher-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = phpWasmEntryPublisherPredecessor;
const implementation = phpWasmEntryPublisherImplementation;
const integrationBase = phpWasmEntryPublisherIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "PHP-Wasm entry publisher history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, phpWasmEntryPublisherCommits);
for(const [index, revision] of phpWasmEntryPublisherCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : phpWasmEntryPublisherCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmEntryPublisherImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...phpWasmEntryPublisherChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...phpWasmEntryPublisherImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryPublisherHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmEntryPublisherIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryPublisherHistoryAddedPaths])
, [...phpWasmEntryPublisherHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-publisher-history-"
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
	assert.equal(reversePhpWasmEntryPublisherUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of phpWasmEntryPublisherChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of phpWasmEntryPublisherIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmEntryPublisherAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(phpWasmEntryPublisherImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(phpWasmEntryPublisherHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-publisher-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: phpWasmEntryPublisherCommits
			, integrationBaseCommit: integrationBase
			, scope: "Wire the real complete-archive publisher to original-source replay and exact committed-byte authentication before staging an inventory append, four measurement paragraphs and a publication receipt. Require a fixed clean checkout, unchanged committed inventory and documentation baselines, unchanged prepared-package observations and unrelated generated output, bounded disk staging and checked rollback that preserves concurrent edits. Check mode executes the same replay but installs no target files; there is no injected verifier or saved-success shortcut. Conditional generated prose follows one probe-only test reference without creating support-stage bindings. Stream the large inventory and retain only a bounded explicit selection of complete entries so documentation checks still validate the exact original source-contract file set. Refresh only 155 live pins across three changed sources; preserve all older evidence and observations. Document the capture/check/publish workflow in the contributor guide. No hosted probe evidence or measurement paragraphs are published by this source milestone. Actual terminal-run archive acceptance, committed matrix retention, real publication and final hosted/Core/recurring gates remain required under VO #2061/#1828."
			, pins: phpWasmEntryPublisherPins
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
