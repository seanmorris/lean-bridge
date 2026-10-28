/**
 * Authenticate the exact final Fin field/callback promotion source range.
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
	beforeFinCompletionPromotionSource
	, finCompletionPromotionHistoryPath
	, finCompletionPromotionImplementation
	, finCompletionPromotionImplementationPaths
	, finCompletionPromotionIntegrationAddedPaths
	, finCompletionPromotionIntegrationPaths
	, finCompletionPromotionNormalizationPaths
	, finCompletionPromotionPredecessor
	, reverseFinCompletionPromotionUpdate
} from "./fin-completion-promotion-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	finCompletionPromotionHistoryPath, "utf8"
));

test("final Fin promotion records its exact source range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "fin-completion-promotion-source-v1");
	assert.equal(record.predecessorCommit, finCompletionPromotionPredecessor);
	assert.equal(record.implementationCommit
		, finCompletionPromotionImplementation);
	assert.equal(git(["rev-parse"
		, `${finCompletionPromotionImplementation}^`]).trim()
		, finCompletionPromotionPredecessor);
	assert.equal(git(["rev-parse", `${record.integrationCommit}^`]).trim()
		, finCompletionPromotionImplementation);
	assert.deepEqual(names(["diff", "--name-only"
		, finCompletionPromotionPredecessor
		, finCompletionPromotionImplementation])
		, [...finCompletionPromotionImplementationPaths]);
	assert.deepEqual(names(["diff", "--name-only"
		, finCompletionPromotionImplementation, record.integrationCommit]), [
		...finCompletionPromotionIntegrationAddedPaths
		, ...finCompletionPromotionIntegrationPaths
		].sort());
	assert.deepEqual(record.updates.map(update => update.path)
		, finCompletionPromotionImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, finCompletionPromotionIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, finCompletionPromotionIntegrationAddedPaths);
});

test("final Fin promotion adds only its four archives and seven observations"
	, () => {
		const diff = git(["diff", "--numstat"
			, finCompletionPromotionPredecessor
			, finCompletionPromotionImplementation, "--"
			, "docs/type-surface.v1.json"]);
		assert.equal(diff, "700\t0\tdocs/type-surface.v1.json\n");
		const previous = git(["show"
			, `${finCompletionPromotionPredecessor}:docs/type-surface.v1.json`]);
		const current = git(["show"
			, `${finCompletionPromotionImplementation}:docs/type-surface.v1.json`]);
		const ids = [
			"hosted-reviewed-fin-wasm-fields-installed"
			, "hosted-reviewed-callback-fin-browser-installed"
			, "hosted-callback-fin-managed-wit-installed"
			, "hosted-callback-fin-native-languages-installed"
			, "fin-completion-browser-fields-ordinary"
			, "fin-completion-wasm-fields-reviewed"
			, "fin-completion-browser-callbacks-reviewed"
			, "fin-completion-managed-callbacks-ordinary-source"
			, "fin-completion-managed-callbacks-reviewed-ir"
			, "fin-completion-native-callbacks-ordinary-source"
			, "fin-completion-native-callbacks-reviewed-ir"
		];
		for(const id of ids)
		{
			assert.equal(previous.includes(`"id": "${id}"`), false, id);
			assert.equal(current.match(new RegExp(`"id": "${id}"`, "gu"))
				?.length, 1, id);
		}
	}
);

test("final Fin promotion reverses every source endpoint", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${finCompletionPromotionImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${finCompletionPromotionPredecessor}:${update.path}`]);
		assert.equal(reverseFinCompletionPromotionUpdate(current, update)
			, previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeFinCompletionPromotionSource);
		const previous = git(["show"
			, `${finCompletionPromotionImplementation}:${update.path}`]);
		assert.equal(reverseFinCompletionPromotionUpdate(current, update)
			, previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of finCompletionPromotionNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("final Fin promotion rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${finCompletionPromotionImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.json" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() =>
			reverseFinCompletionPromotionUpdate(current, forged));
});

test("final Fin promotion writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-fin-completion-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-fin-completion-promotion-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
