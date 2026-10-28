/**
 * Authenticate the focused reviewed-Fin producer source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeReviewedFinFocusedProducerSource
	, reverseReviewedFinFocusedProducerUpdate
	, reviewedFinFocusedProducerAddedPaths
	, reviewedFinFocusedProducerHistoryPath
	, reviewedFinFocusedProducerImplementation
	, reviewedFinFocusedProducerImplementationAddedPaths
	, reviewedFinFocusedProducerImplementationPaths
	, reviewedFinFocusedProducerIntegrationAddedPaths
	, reviewedFinFocusedProducerIntegrationPaths
	, reviewedFinFocusedProducerNormalizationPaths
	, reviewedFinFocusedProducerPredecessor
	, reviewedFinFocusedProducerTrigger
	, reviewedFinFocusedProducerTriggerPaths
} from "./reviewed-fin-focused-producer-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	reviewedFinFocusedProducerHistoryPath, "utf8"
));

test("focused reviewed Fin producer records its exact source range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "reviewed-fin-focused-producer-source-v1");
	assert.equal(record.predecessorCommit, reviewedFinFocusedProducerPredecessor);
	assert.equal(record.implementationCommit
		, reviewedFinFocusedProducerImplementation);
	assert.equal(record.triggerCommit, reviewedFinFocusedProducerTrigger);
	assert.equal(git(["rev-parse"
		, `${reviewedFinFocusedProducerImplementation}^`]).trim()
		, reviewedFinFocusedProducerPredecessor);
	assert.equal(git(["rev-parse"
		, `${reviewedFinFocusedProducerTrigger}^`]).trim()
		, reviewedFinFocusedProducerImplementation);
	assert.equal(git(["rev-parse", `${record.integrationCommit}^`]).trim()
		, reviewedFinFocusedProducerTrigger);
	assert.deepEqual(names(["diff", "--name-only"
		, reviewedFinFocusedProducerPredecessor
		, reviewedFinFocusedProducerImplementation]), [
		...reviewedFinFocusedProducerImplementationAddedPaths
		, ...reviewedFinFocusedProducerImplementationPaths
		].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, reviewedFinFocusedProducerImplementation
		, reviewedFinFocusedProducerTrigger])
		, [...reviewedFinFocusedProducerTriggerPaths]);
	assert.deepEqual(names(["diff", "--name-only"
		, reviewedFinFocusedProducerTrigger, record.integrationCommit]), [
		...reviewedFinFocusedProducerIntegrationAddedPaths
		, ...reviewedFinFocusedProducerIntegrationPaths
		].sort());
	assert.deepEqual(record.updates.map(update => update.path)
		, reviewedFinFocusedProducerImplementationPaths);
	assert.deepEqual(record.triggerUpdates.map(update => update.path)
		, reviewedFinFocusedProducerTriggerPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, reviewedFinFocusedProducerIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, reviewedFinFocusedProducerAddedPaths);
});

test("focused reviewed Fin producer closes the stale box oracle", () => {
	const producer = git(["show"
		, `${reviewedFinFocusedProducerImplementation}:tests/helpers/reviewed-fin-wasm-entry-producer.mjs`]);
	const workflow = git(["show"
		, `${reviewedFinFocusedProducerTrigger}:.github/workflows/reviewed-fin-wasm-entry.yml`]);
	assert.match(producer
		, /\["mirror", "label", "rows", "nested", "box"\]/u);
	assert.equal(workflow.match(/nix build \.#universal-core-artifacts/gmu)?.length
		, 1);
	assert.equal(workflow.match(/nix build \.#component-build-engine/gmu)?.length
		, 1);
	assert.match(workflow, /Reviewed Fin Wasm entries/u);
	assert.match(workflow, /steps\.original\.outcome != 'success'/u);
	assert.match(workflow, /steps\.probe\.outcome != 'success'/u);
});

test("focused reviewed Fin producer reverses every source endpoint", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${reviewedFinFocusedProducerImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${reviewedFinFocusedProducerPredecessor}:${update.path}`]);
		assert.equal(reverseReviewedFinFocusedProducerUpdate(current, update)
			, previous);
	}
	for(const update of record.triggerUpdates)
	{
		const current = git(["show"
			, `${reviewedFinFocusedProducerTrigger}:${update.path}`]);
		const previous = git(["show"
			, `${reviewedFinFocusedProducerImplementation}:${update.path}`]);
		assert.equal(reverseReviewedFinFocusedProducerUpdate(current, update)
			, previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeReviewedFinFocusedProducerSource);
		const previous = git(["show"
			, `${reviewedFinFocusedProducerTrigger}:${update.path}`]);
		assert.equal(reverseReviewedFinFocusedProducerUpdate(current, update)
			, previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of reviewedFinFocusedProducerNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("focused reviewed Fin producer leaves product contracts unchanged", () => {
	for(const path of ["docs/type-surface.v1.json"
		, "docs/consumer-support.v1.json", "schema/binding-ir.schema.json"])
		assert.equal(git(["rev-parse"
			, `${reviewedFinFocusedProducerPredecessor}:${path}`])
			, git(["rev-parse"
				, `${reviewedFinFocusedProducerTrigger}:${path}`]), path);
});

test("focused reviewed Fin producer rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${reviewedFinFocusedProducerImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() =>
			reverseReviewedFinFocusedProducerUpdate(current, forged));
});

test("focused reviewed Fin producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-reviewed-fin-producer-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-reviewed-fin-focused-producer-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
