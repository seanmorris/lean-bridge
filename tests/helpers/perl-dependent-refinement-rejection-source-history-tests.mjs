/**
 * Authenticate the Perl dependent-refinement rejection correction.
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
	beforePerlDependentRefinementRejectionSource
	, perlDependentRefinementRejectionAddedPaths
	, perlDependentRefinementRejectionCommits
	, perlDependentRefinementRejectionHistoryPath
	, perlDependentRefinementRejectionImplementation
	, perlDependentRefinementRejectionImplementationPaths
	, perlDependentRefinementRejectionIntegrationPaths
	, perlDependentRefinementRejectionPinCount
	, perlDependentRefinementRejectionPredecessor
	, perlDependentRefinementRejectionTestPath
	, perlDependentRefinementRejectionTypeSurfacePath
	, reversePerlDependentRefinementRejectionUpdate
} from "./perl-dependent-refinement-rejection-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	perlDependentRefinementRejectionHistoryPath, "utf8"
));

test("Perl dependent-refinement rejection records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "perl-dependent-refinement-rejection-source-v1");
	assert.equal(value.predecessorCommit
		, perlDependentRefinementRejectionPredecessor);
	assert.equal(value.implementationCommit
		, perlDependentRefinementRejectionImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, perlDependentRefinementRejectionImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, perlDependentRefinementRejectionIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, perlDependentRefinementRejectionAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${perlDependentRefinementRejectionPredecessor}..${perlDependentRefinementRejectionImplementation}`]).trim().split("\n")
	, perlDependentRefinementRejectionCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, perlDependentRefinementRejectionPredecessor
		, perlDependentRefinementRejectionImplementation]).trim().split("\n")
	, perlDependentRefinementRejectionImplementationPaths);
});

test("Perl dependent-refinement rejection reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		if(update.path === perlDependentRefinementRejectionTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				perlDependentRefinementRejectionImplementation, update.path
			), update), true);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const current = git(["show"
			, `${perlDependentRefinementRejectionImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${perlDependentRefinementRejectionPredecessor}:${update.path}`]);
		assert.equal(reversePerlDependentRefinementRejectionUpdate(
			current, update), previous, update.path);
		assert.equal(beforePerlDependentRefinementRejectionSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${perlDependentRefinementRejectionImplementation}:${update.path}`]);
		assert.equal(reversePerlDependentRefinementRejectionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Perl correction retains adapter refusal and a bounded complete check", async () => {
	const value = await record();
	const testUpdate = value.updates.find(item =>
		item.path === perlDependentRefinementRejectionTestPath);
	const current = git(["show"
		, `${perlDependentRefinementRejectionImplementation}:${testUpdate.path}`]);
	const previous = reversePerlDependentRefinementRejectionUpdate(
		current, testUpdate);
	assert.match(current, /timeout: 300_000/u);
	assert.match(current, /\["dependent", \/bound-checking adapters\//u);
	assert.match(previous, /timeout: 180_000/u);
	assert.match(previous, /\["dependent", \/dependent or implicit\//u);
});

test("Perl correction refreshes exactly its two live source pins", async () => {
	const value = await record();
	const update = value.updates.find(item =>
		item.path === perlDependentRefinementRejectionTypeSurfacePath);
	const previousDigest = sha256(git(["show"
		, `${perlDependentRefinementRejectionPredecessor}:${perlDependentRefinementRejectionTestPath}`]));
	const currentDigest = sha256(git(["show"
		, `${perlDependentRefinementRejectionImplementation}:${perlDependentRefinementRejectionTestPath}`]));
	let previousPins = 0, currentPins = 0;
	for(const edit of update.edits)
	{
		previousPins += edit.previous.split(previousDigest).length - 1;
		currentPins += edit.current.split(currentDigest).length - 1;
		assert.equal(edit.current.replaceAll(currentDigest, "")
			, edit.previous.replaceAll(previousDigest, ""));
	}
	assert.equal(previousPins, perlDependentRefinementRejectionPinCount);
	assert.equal(currentPins, perlDependentRefinementRejectionPinCount);
});

test("Perl dependent-refinement rejection rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === perlDependentRefinementRejectionTestPath);
	const current = git(["show"
		, `${perlDependentRefinementRejectionImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reversePerlDependentRefinementRejectionUpdate(current, forged));
	assert.equal(beforePerlDependentRefinementRejectionSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
