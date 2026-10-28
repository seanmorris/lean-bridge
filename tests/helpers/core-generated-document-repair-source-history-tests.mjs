/**
 * Authenticate the generated consumer-document repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreGeneratedDocumentRepairSource
	, coreGeneratedDocumentRepairAddedPaths
	, coreGeneratedDocumentRepairCommits
	, coreGeneratedDocumentRepairHistoryPath
	, coreGeneratedDocumentRepairImplementation
	, coreGeneratedDocumentRepairImplementationPaths
	, coreGeneratedDocumentRepairIntegrationPaths
	, coreGeneratedDocumentRepairPredecessor
	, reverseCoreGeneratedDocumentRepairUpdate
} from "./core-generated-document-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreGeneratedDocumentRepairHistoryPath, "utf8"
));

test("generated-document repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-generated-document-repair-source-v1");
	assert.equal(value.predecessorCommit, coreGeneratedDocumentRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreGeneratedDocumentRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreGeneratedDocumentRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreGeneratedDocumentRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, coreGeneratedDocumentRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreGeneratedDocumentRepairPredecessor}..${coreGeneratedDocumentRepairImplementation}`]).trim().split("\n")
		, coreGeneratedDocumentRepairCommits);
});

test("generated-document repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreGeneratedDocumentRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreGeneratedDocumentRepairImplementation
			: coreGeneratedDocumentRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreGeneratedDocumentRepairUpdate(current, update)
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

test("generated-document repair changes only ten pages and 28 source pins", () => {
	const previous = JSON.parse(git(["show"
		, `${coreGeneratedDocumentRepairPredecessor}:docs/type-surface.v1.json`]));
	const current = JSON.parse(git(["show"
		, `${coreGeneratedDocumentRepairImplementation}:docs/type-surface.v1.json`]));
	const oldFiles = previous.evidence.flatMap(item => item.files ?? []);
	const newFiles = current.evidence.flatMap(item => item.files ?? []);
	assert.equal(oldFiles.length, newFiles.length);
	let changed = 0;
	for(let index = 0; index < oldFiles.length; ++index)
	{
		assert.equal(oldFiles[index].path, newFiles[index].path);
		if(oldFiles[index].sha256 !== newFiles[index].sha256) changed++;
	}
	assert.equal(changed, 28);
	assert.deepEqual(coreGeneratedDocumentRepairImplementationPaths
		.filter(path => path.endsWith(".md")).length, 10);
});

test("generated-document repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreGeneratedDocumentRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreGeneratedDocumentRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCoreGeneratedDocumentRepairUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCoreGeneratedDocumentRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
