#!/usr/bin/env node
/**
 * Record every first-parent transition in the synchronous callback
 * checked-record rollout and its final documentation/history integration.
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
	callbackCheckedRecordPromotionChangedPaths
	, callbackCheckedRecordPromotionCommits
	, callbackCheckedRecordPromotionHistoryPath
	, callbackCheckedRecordPromotionImplementation
	, callbackCheckedRecordPromotionIntegrationPaths
	, callbackCheckedRecordPromotionPredecessor
	, callbackCheckedRecordPromotionPredecessorPaths
	, reverseCallbackCheckedRecordPromotionUpdate
} from "../tests/helpers/callback-checked-record-promotion-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackCheckedRecordPromotionImplementation
	, "Callback checked-record promotion history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordPromotionHistoryPath]).trim(), ""
, "Never rewrite committed callback checked-record promotion history");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${callbackCheckedRecordPromotionPredecessor}..${callbackCheckedRecordPromotionImplementation}`])
	.trim().split("\n"), callbackCheckedRecordPromotionCommits);

const historyAdditions = Object.freeze([
	"scripts/update-callback-checked-record-promotion-source-history.mjs"
	, "tests/helpers/callback-checked-record-promotion-source-history.mjs"
	, "tests/helpers/callback-checked-record-promotion-source-history-tests.mjs"
]);
const lines = value => value.split("\n").filter(Boolean);
const applicationAdditions = lines(git(["diff", "--name-only"
	, "--diff-filter=A", callbackCheckedRecordPromotionPredecessor
	, callbackCheckedRecordPromotionImplementation, "--"]));
const directory = await mkdtemp(join(
	tmpdir(), "callback-checked-record-promotion-history-"
));

const transition = async ({ path, previous, current, commit, parent }) => {
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
	const lineOffsets = values => {
		const offsets = [0];
		for(const value of values)
			offsets.push(offsets.at(-1) + value.length);
		return offsets;
	};
	const currentOffsets = lineOffsets(currentLines);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	if(commit !== undefined) update.commit = commit;
	if(parent !== undefined) update.parent = parent;
	assert.equal(reverseCallbackCheckedRecordPromotionUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	const seenChanged = new Set();
	const commits = [];
	for(const commit of callbackCheckedRecordPromotionCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = lines(git(["diff-tree", "--no-commit-id"
			, "--name-only", "--diff-filter=M", "-r", commit]));
		for(const path of modified)
		{
			assert.ok(callbackCheckedRecordPromotionChangedPaths.includes(path)
				, `Unregistered modified path ${path}`);
			seenChanged.add(path);
			updates.push(await transition({
				path, commit, parent
				, previous: git(["show", `${parent}:${path}`])
				, current: git(["show", `${commit}:${path}`])
			}));
		}
		commits.push({ commit, parent, subject, modified });
	}
	assert.deepEqual([...seenChanged].sort()
		, [...callbackCheckedRecordPromotionChangedPaths].sort());

	const integrationUpdates = [];
	for(const path of callbackCheckedRecordPromotionIntegrationPaths)
		integrationUpdates.push(await transition({
			path
			, previous: git(["show"
				, `${callbackCheckedRecordPromotionImplementation}:${path}`])
			, current: await readFile(path, "utf8")
		}));

	const additions = [];
	for(const path of [...applicationAdditions, ...historyAdditions])
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackCheckedRecordPromotionPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}

	const implementationSurface = JSON.parse(git(["show"
		, `${callbackCheckedRecordPromotionImplementation}:docs/type-surface.v1.json`]));
	const currentSurface = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"));
	const implementationPins = new Map();
	for(const evidence of implementationSurface.evidence)
		for(const file of evidence.files)
			implementationPins.set(`${evidence.id}\0${file.path}`, file.sha256);
	const reconciledTypeSurfacePointers = currentSurface.evidence.reduce(
		(count, evidence) => count + evidence.files.filter(file =>
			implementationPins.get(`${evidence.id}\0${file.path}`)
				!== file.sha256).length, 0);
	assert.ok(reconciledTypeSurfacePointers > 0
		, "Callback promotion must reconcile live source pointers");

	const implemented = lines(git(["diff", "--name-only"
		, callbackCheckedRecordPromotionPredecessor
		, callbackCheckedRecordPromotionImplementation, "--"])).sort();
	assert.deepEqual(implemented, [
		...callbackCheckedRecordPromotionPredecessorPaths
		, ...applicationAdditions
	].sort());
	const modified = lines(git(["diff", "--name-only", "--diff-filter=M"
		, callbackCheckedRecordPromotionImplementation, "--"])).sort();
	assert.deepEqual(modified
		, [...callbackCheckedRecordPromotionIntegrationPaths].sort());

	const record = {
		schemaVersion: 1
		, milestone: "callback-checked-record-promotion-source-v1"
		, predecessorCommit: callbackCheckedRecordPromotionPredecessor
		, implementationCommit: callbackCheckedRecordPromotionImplementation
		, reconciledTypeSurfacePointers
		, scope: "Eight immutable hosted lanes promote exactly 64 synchronous copied checked-record callback cells across sixteen non-PHP-Wasm profiles and both author routes. Every first-parent implementation transition, final generated guide and current-source evidence-pin advance remains independently reversible."
		, commits, updates, integrationUpdates, additions
	};
	await writeFile(callbackCheckedRecordPromotionHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and `
		+ `${reconciledTypeSurfacePointers} source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
