/**
 * Authenticate the hub hook of the WIT frozen-closure integration history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeWitFrozenClosureHubHookSource
	, reverseWitFrozenClosureHubHookUpdate
	, witFrozenClosureHubHookAddedPaths
	, witFrozenClosureHubHookCommits
	, witFrozenClosureHubHookHistoryPath
	, witFrozenClosureHubHookImplementation
	, witFrozenClosureHubHookImplementationPaths
	, witFrozenClosureHubHookIntegrationPaths
	, witFrozenClosureHubHookPredecessor
} from "./wit-frozen-closure-hub-hook-source-history.mjs";
import {
	witCallbackFrozenClosureIntegrationImplementation
} from "./wit-callback-frozen-closure-integration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	witFrozenClosureHubHookHistoryPath, "utf8"
));
const hubPath = "tests/helpers/fin-refinement-source-history.mjs";

test("WIT frozen-closure hub hook records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "wit-frozen-closure-hub-hook-source-v1");
	assert.equal(value.predecessorCommit, witFrozenClosureHubHookPredecessor);
	assert.equal(value.implementationCommit, witFrozenClosureHubHookImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, witFrozenClosureHubHookImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, witFrozenClosureHubHookIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, witFrozenClosureHubHookAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${witFrozenClosureHubHookPredecessor}..${witFrozenClosureHubHookImplementation}`]).trim().split("\n")
	, witFrozenClosureHubHookCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, witFrozenClosureHubHookPredecessor
		, witFrozenClosureHubHookImplementation]).trim().split("\n")
	, witFrozenClosureHubHookImplementationPaths);
});

test("WIT frozen-closure hub hook reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${witFrozenClosureHubHookImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${witFrozenClosureHubHookPredecessor}:${update.path}`]);
		assert.equal(reverseWitFrozenClosureHubHookUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeWitFrozenClosureHubHookSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${witFrozenClosureHubHookImplementation}:${update.path}`]);
		assert.equal(reverseWitFrozenClosureHubHookUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("WIT frozen-closure hub hook lets the hub walk past the integrated WIT hub state", async () => {
	const integrated = git(["show"
		, `${witCallbackFrozenClosureIntegrationImplementation}:${hubPath}`]);
	const base = git(["show"
		, `${witCallbackFrozenClosureIntegrationImplementation}~1:${hubPath}`]);
	assert.equal(beforeFinRefinementSource(hubPath, integrated, sha256(base))
		, base);
	assert.equal(sha256(await sourceAtFinHistoryMilestone(hubPath, sha256(base)))
		, sha256(base));
});

test("WIT frozen-closure hub hook changes no record, support inventory, pin or product source", () => {
	for(const path of ["docs/type-surface.v1.json", "docs/evidence", "src"
		, "scripts", ".github", "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${witFrozenClosureHubHookPredecessor}:${path}`])
			, git(["rev-parse", `${witFrozenClosureHubHookImplementation}:${path}`]), path);
});

test("WIT frozen-closure hub hook rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${witFrozenClosureHubHookImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseWitFrozenClosureHubHookUpdate(current, forged));
	assert.equal(beforeWitFrozenClosureHubHookSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
