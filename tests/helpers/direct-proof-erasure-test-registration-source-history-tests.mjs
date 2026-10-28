/**
 * Authenticate the direct proof-erasure test-profile registration and its
 * exact type-surface pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDirectProofErasureTestRegistrationSource
	, directProofErasureTestRegistrationAddedPaths
	, directProofErasureTestRegistrationAddedTests
	, directProofErasureTestRegistrationCommits
	, directProofErasureTestRegistrationHistoryPath
	, directProofErasureTestRegistrationImplementation
	, directProofErasureTestRegistrationImplementationPaths
	, directProofErasureTestRegistrationIntegrationPaths
	, directProofErasureTestRegistrationPinCount
	, directProofErasureTestRegistrationPredecessor
	, directProofErasureTestRegistrationProfilePath
	, directProofErasureTestRegistrationTypeSurfacePath
	, reverseDirectProofErasureTestRegistrationUpdate
} from "./direct-proof-erasure-test-registration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureTestRegistrationHistoryPath, "utf8"
));

test("direct proof-erasure test registration records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-test-registration-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureTestRegistrationPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureTestRegistrationImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureTestRegistrationImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureTestRegistrationIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureTestRegistrationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${directProofErasureTestRegistrationPredecessor}..${directProofErasureTestRegistrationImplementation}`]).trim().split("\n")
	, directProofErasureTestRegistrationCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, directProofErasureTestRegistrationPredecessor
		, directProofErasureTestRegistrationImplementation]).trim().split("\n")
	, directProofErasureTestRegistrationImplementationPaths);
});

test("direct proof-erasure test registration reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		if(update.path === directProofErasureTestRegistrationTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				directProofErasureTestRegistrationImplementation, update.path
			), update), true);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const current = git(["show"
			, `${directProofErasureTestRegistrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureTestRegistrationPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureTestRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureTestRegistrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureTestRegistrationImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureTestRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("all direct proof-erasure tests have one contract classification", async () => {
	const value = await record();
	const update = value.updates.find(item =>
		item.path === directProofErasureTestRegistrationProfilePath);
	const current = git(["show"
		, `${directProofErasureTestRegistrationImplementation}:${update.path}`]);
	const previous = reverseDirectProofErasureTestRegistrationUpdate(
		current, update);
	for(const name of directProofErasureTestRegistrationAddedTests)
	{
		const line = `\t\t, "${name}"\n`;
		assert.equal(current.split(line).length, 2, name);
		assert.equal(previous.includes(line), false, name);
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`)
			, "contract", name);
	}
});

test("test registration refreshes exactly its 98 live profile pins", async () => {
	const value = await record();
	const update = value.updates.find(item =>
		item.path === directProofErasureTestRegistrationTypeSurfacePath);
	const previousDigest = sha256(git(["show"
		, `${directProofErasureTestRegistrationPredecessor}:${directProofErasureTestRegistrationProfilePath}`]));
	const currentDigest = sha256(git(["show"
		, `${directProofErasureTestRegistrationImplementation}:${directProofErasureTestRegistrationProfilePath}`]));
	let previousPins = 0, currentPins = 0;
	for(const edit of update.edits)
	{
		previousPins += edit.previous.split(previousDigest).length - 1;
		currentPins += edit.current.split(currentDigest).length - 1;
		assert.equal(edit.current.replaceAll(currentDigest, "")
			, edit.previous.replaceAll(previousDigest, ""));
	}
	assert.equal(previousPins, directProofErasureTestRegistrationPinCount);
	assert.equal(currentPins, directProofErasureTestRegistrationPinCount);
});

test("direct proof-erasure test registration rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === directProofErasureTestRegistrationProfilePath);
	const current = git(["show"
		, `${directProofErasureTestRegistrationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureTestRegistrationUpdate(current, forged));
	assert.equal(beforeDirectProofErasureTestRegistrationSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
