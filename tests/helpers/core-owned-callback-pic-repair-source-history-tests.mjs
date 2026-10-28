/**
 * Authenticate the owned callback PIC repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreOwnedCallbackPicRepairSource
	, coreOwnedCallbackPicRepairAddedPaths
	, coreOwnedCallbackPicRepairCommits
	, coreOwnedCallbackPicRepairHistoryPath
	, coreOwnedCallbackPicRepairImplementation
	, coreOwnedCallbackPicRepairImplementationPaths
	, coreOwnedCallbackPicRepairIntegrationPaths
	, coreOwnedCallbackPicRepairPredecessor
	, reverseCoreOwnedCallbackPicRepairUpdate
} from "./core-owned-callback-pic-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreOwnedCallbackPicRepairHistoryPath, "utf8"
));

test("owned callback PIC repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-owned-callback-pic-repair-source-v1");
	assert.equal(value.predecessorCommit, coreOwnedCallbackPicRepairPredecessor);
	assert.equal(value.implementationCommit, coreOwnedCallbackPicRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreOwnedCallbackPicRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreOwnedCallbackPicRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, coreOwnedCallbackPicRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreOwnedCallbackPicRepairPredecessor}..${coreOwnedCallbackPicRepairImplementation}`]).trim().split("\n")
		, coreOwnedCallbackPicRepairCommits);
});

test("owned callback PIC repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreOwnedCallbackPicRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreOwnedCallbackPicRepairImplementation
			: coreOwnedCallbackPicRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreOwnedCallbackPicRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned callback objects are now position independent", () => {
	const previous = git(["show"
		, `${coreOwnedCallbackPicRepairPredecessor}:tests/helpers/owned-aggregate-native.mjs`]);
	const current = git(["show"
		, `${coreOwnedCallbackPicRepairImplementation}:tests/helpers/owned-aggregate-native.mjs`]);
	assert.doesNotMatch(previous
		, /\["-O2", "-g", "-fPIC"\s*, "-I"[^\n]+Callbacks\.c/u);
	assert.match(current
		, /\["-O2", "-g", "-fPIC"\s*, "-I"[\s\S]+?Callbacks\.c/u);
	for(const path of ["src", "docs/type-surface.v1.json", "package.json"])
		assert.equal(git(["rev-parse"
			, `${coreOwnedCallbackPicRepairPredecessor}:${path}`])
		, git(["rev-parse"
			, `${coreOwnedCallbackPicRepairImplementation}:${path}`]), path);
});

test("owned callback PIC repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreOwnedCallbackPicRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreOwnedCallbackPicRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCoreOwnedCallbackPicRepairUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCoreOwnedCallbackPicRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
