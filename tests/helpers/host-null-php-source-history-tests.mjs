/**
 * Authenticate the complete native PHP and PHP-Wasm HostNull history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullPhpIntegrationSource
	, beforeHostNullPhpSource
	, hostNullPhpAddedPaths
	, hostNullPhpChangedPaths
	, hostNullPhpCommits
	, hostNullPhpExternalHistoryPaths
	, hostNullPhpHistoryPath
	, hostNullPhpImplementation
	, hostNullPhpImplementationAddedPaths
	, hostNullPhpIntegrationPaths
	, hostNullPhpPredecessor
	, hostNullPhpTransitionPaths
	, reverseHostNullPhpUpdate
} from "./host-null-php-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(hostNullPhpHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("PHP HostNull records every exact first-parent state", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-php-source-v1");
	assert.equal(value.predecessorCommit, hostNullPhpPredecessor);
	assert.equal(value.implementationCommit, hostNullPhpImplementation);
	assert.deepEqual(value.commits.map(commit => commit.commit), hostNullPhpCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${hostNullPhpPredecessor}..${hostNullPhpImplementation}`])
		.trim().split("\n"), hostNullPhpCommits);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, hostNullPhpPredecessor, hostNullPhpImplementation])
		.trim().split("\n").sort()
	, [...hostNullPhpChangedPaths, ...hostNullPhpExternalHistoryPaths].sort());
	assert.deepEqual([...new Set(value.updates.map(update => update.path))].sort()
		, [...hostNullPhpTransitionPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, hostNullPhpIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path), hostNullPhpAddedPaths);
	assert.ok(value.updates.every(update =>
		!hostNullPhpExternalHistoryPaths.includes(update.path)));
});

test("PHP HostNull reverses every source and integration transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseHostNullPhpUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullPhpSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(value.integrationParent, update.path);
		assert.equal(reverseHostNullPhpUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullPhpIntegrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("PHP HostNull authenticates every added file at its milestone", async () => {
	for(const addition of (await record()).additions)
	{
		const source = hostNullPhpImplementationAddedPaths.includes(addition.path)
			? sourceAt(hostNullPhpImplementation, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("PHP HostNull closes the consumer workflow gap without duplicating partition 11", async () => {
	const updates = (await record()).updates.filter(update =>
		update.path === ".github/workflows/consumer-matrix.yml");
	assert.deepEqual(updates.map(update => update.commit), hostNullPhpCommits.slice(0, 3));
	assert.ok((await record()).updates.every(update =>
		update.path !== "tests/checked-javascript-partition-11.test.mjs"));
	let current = sourceAt(updates.at(-1).commit, updates.at(-1).path);
	for(const update of [...updates].reverse())
		current = reverseHostNullPhpUpdate(current, update);
	assert.equal(current, sourceAt(hostNullPhpPredecessor, updates[0].path));
});

test("PHP HostNull refuses forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullPhpUpdate(current, forged));
	assert.equal(beforeHostNullPhpSource(update.path, `${current}unknown\n`)
		, `${current}unknown\n`);
});
