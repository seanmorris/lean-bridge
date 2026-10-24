#!/usr/bin/env node
/**
 * Record the explicit Feature and archive producer repair.
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
	admissionArchiveProducerRepairAddedPaths
	, admissionArchiveProducerRepairChangedPaths
	, admissionArchiveProducerRepairCommits
	, admissionArchiveProducerRepairHistoryPath
	, admissionArchiveProducerRepairImplementation
	, admissionArchiveProducerRepairIntegrationBase
	, admissionArchiveProducerRepairIntegrationPaths
	, admissionArchiveProducerRepairPredecessor
	, reverseAdmissionArchiveProducerRepairUpdate
} from "../tests/helpers/admission-archive-producer-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = admissionArchiveProducerRepairPredecessor;
const implementation = admissionArchiveProducerRepairImplementation;
const integrationBase = admissionArchiveProducerRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Feature and archive producer history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, admissionArchiveProducerRepairCommits);
for(const [index, revision] of admissionArchiveProducerRepairCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : admissionArchiveProducerRepairCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...admissionArchiveProducerRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, admissionArchiveProducerRepairHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...admissionArchiveProducerRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...admissionArchiveProducerRepairAddedPaths])
, [...admissionArchiveProducerRepairAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-admission-archive-producer-repair-history-"
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
	assert.equal(reverseAdmissionArchiveProducerRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of admissionArchiveProducerRepairChangedPaths)
	{
		const current = git(["show", `${implementation}:${path}`]);
		assert.equal(current, git(["show", `${integrationBase}:${path}`])
			, `Later work changed ${path}; record a composed transition`);
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`]), current));
	}
	const integrationUpdates = [];
	for(const path of admissionArchiveProducerRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of admissionArchiveProducerRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationBase, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(admissionArchiveProducerRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "admission-archive-producer-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: admissionArchiveProducerRepairCommits
			, integrationBaseCommit: integrationBase
			, scope: "Keep current feature-enabled/disabled comparisons live for JavaScript and PHP-Wasm borrows and WIT callbacks, while authenticating frozen byte-compatibility claims with their original feature-admission generators. Bind Rust transfer regeneration and zero-payload PHP archive package-source checks to explicit producer commits. Preserve every receipt hash, ABI, manifest, contract, installed observation and refusal check. Record the exact three-commit range and small source/hash controls. No inventory, runtime implementation or support-state changes; generator and archive acceptance remain hosted gates."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

