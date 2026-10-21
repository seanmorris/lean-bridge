/**
 * Authenticate dependent generic-Subtype recurring CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeDependentGenericSubtypeCiSource
	, dependentGenericSubtypeCiChangedPaths
	, dependentGenericSubtypeCiHistoryPath
	, dependentGenericSubtypeCiImplementation
	, dependentGenericSubtypeCiIntegrationPaths
	, dependentGenericSubtypeCiPredecessor
	, reverseDependentGenericSubtypeCiUpdate
} from "./dependent-generic-subtype-ci-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent generic Subtype CI runs the complete foundation contract", async () => {
	const workflow = await readFile(
		".github/workflows/generic-subtype-native-perl.yml", "utf8");
	for(const text of [
		"dependent-foundation:"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_SELECTION_TEST=1"
		, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
		, "tests/helpers/dependent-generic-subtype-source-history-tests.mjs"
		, "npm run typecheck"
		, "name: dependent-generic-subtype-${{ github.sha }}"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(text), text);
});

test("dependent generic Subtype CI history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentGenericSubtypeCiHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "dependent-generic-subtype-ci-source-v1");
	assert.equal(record.predecessorCommit, dependentGenericSubtypeCiPredecessor);
	assert.equal(record.implementationCommit, dependentGenericSubtypeCiImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentGenericSubtypeCiChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentGenericSubtypeCiIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentGenericSubtypeCiSource);
		const previous = reverseDependentGenericSubtypeCiUpdate(current, update);
		assert.equal(previous, sourceAt(
			dependentGenericSubtypeCiPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentGenericSubtypeCiSource);
		assert.equal(reverseDependentGenericSubtypeCiUpdate(current, update)
			, sourceAt(dependentGenericSubtypeCiImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("dependent generic Subtype CI history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentGenericSubtypeCiHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentGenericSubtypeCiSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentGenericSubtypeCiUpdate(current, update));
});

test("dependent generic Subtype CI history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-generic-subtype-ci-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-generic-subtype-ci-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
