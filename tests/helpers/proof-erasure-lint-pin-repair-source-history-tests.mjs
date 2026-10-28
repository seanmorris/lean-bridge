/**
 * Authenticate the proof erasure fixture lint repair and its type-surface pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeProofErasureLintPinRepairSource
	, proofErasureLintPinRepairAddedPaths
	, proofErasureLintPinRepairCommits
	, proofErasureLintPinRepairHistoryPath
	, proofErasureLintPinRepairImplementation
	, proofErasureLintPinRepairImplementationPaths
	, proofErasureLintPinRepairIntegrationPaths
	, proofErasureLintPinRepairPinCount
	, proofErasureLintPinRepairPinnedPaths
	, proofErasureLintPinRepairPredecessor
	, proofErasureLintPinRepairTypeSurfacePath
	, reverseProofErasureLintPinRepairUpdate
} from "./proof-erasure-lint-pin-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	proofErasureLintPinRepairHistoryPath, "utf8"
));
const digestPattern = /[0-9a-f]{64}/gu;

test("proof erasure lint and pin repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "proof-erasure-lint-pin-repair-source-v1");
	assert.equal(value.predecessorCommit, proofErasureLintPinRepairPredecessor);
	assert.equal(value.implementationCommit, proofErasureLintPinRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, proofErasureLintPinRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, proofErasureLintPinRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, proofErasureLintPinRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${proofErasureLintPinRepairPredecessor}..${proofErasureLintPinRepairImplementation}`]).trim().split("\n")
	, proofErasureLintPinRepairCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, proofErasureLintPinRepairPredecessor
		, proofErasureLintPinRepairImplementation]).trim().split("\n")
	, proofErasureLintPinRepairImplementationPaths);
});

test("proof erasure lint and pin repair reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		if(update.path === proofErasureLintPinRepairTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				proofErasureLintPinRepairImplementation, update.path), update), true);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const current = git(["show"
			, `${proofErasureLintPinRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${proofErasureLintPinRepairPredecessor}:${update.path}`]);
		assert.equal(reverseProofErasureLintPinRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeProofErasureLintPinRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${proofErasureLintPinRepairImplementation}:${update.path}`]);
		assert.equal(reverseProofErasureLintPinRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("proof erasure lint and pin repair changes only type-surface digests to their predecessor sources", async () => {
	const update = (await record()).updates.find(item =>
		item.path === proofErasureLintPinRepairTypeSurfacePath);
	const sources = new Set(proofErasureLintPinRepairPinnedPaths.map(path => sha256(git(["show"
		, `${proofErasureLintPinRepairPredecessor}:${path}`]))));
	const refreshed = new Set();
	let pins = 0;
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		for(const digest of edit.current.match(digestPattern))
		{
			assert.ok(sources.has(digest), digest);
			refreshed.add(digest);
			++pins;
		}
		for(const digest of edit.previous.match(digestPattern))
			assert.ok(!sources.has(digest), digest);
	}
	assert.equal(pins, proofErasureLintPinRepairPinCount);
	assert.deepEqual([...refreshed].sort(), [...sources].sort());
});

test("proof erasure lint and pin repair changes no record, support inventory or product source", () => {
	for(const path of ["docs/evidence", "src", "scripts", ".github"
		, "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${proofErasureLintPinRepairPredecessor}:${path}`])
			, git(["rev-parse", `${proofErasureLintPinRepairImplementation}:${path}`]), path);
});

test("proof erasure lint and pin repair rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path !== proofErasureLintPinRepairTypeSurfacePath);
	const current = git(["show"
		, `${proofErasureLintPinRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseProofErasureLintPinRepairUpdate(current, forged));
	assert.equal(beforeProofErasureLintPinRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
