/**
 * Authenticate the release-gate sparse partial-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeVo1220ReleaseGateSparsePartialCheckoutRepairSource
	, reverseVo1220ReleaseGateSparsePartialCheckoutRepairUpdate
	, vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath
	, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
	, vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairNormalizationPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
} from "./vo1220-release-gate-sparse-partial-checkout-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath, "utf8"));

test("release-gate sparse partial checkout binds the complete inventory", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-release-gate-sparse-partial-checkout-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation);
	assert.deepEqual(history.sourceInventory, {
		revision: vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
		, evidence: 900, occurrences: 369393, paths: 123815
		, objects: 20975, bytes: 27250476050, mismatches: 0
	});
	assert.deepEqual(history.localValidation, {
		releaseAuthorization: { passed: 25, failed: 0 }
		, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
	});
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths);
});

test("release checkout excludes retained evidence before materialization", () => {
	const previous = sourceAt(vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
		, ".github/workflows/reproducible-release.yml");
	const current = sourceAt(vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
		, ".github/workflows/reproducible-release.yml");
	assert.match(previous, /filter: blob:none\n\s+persist-credentials: false/u);
	assert.doesNotMatch(previous, /sparse-checkout-cone-mode/u);
	assert.match(current
		, /filter: blob:none\n\s+sparse-checkout: \|\n\s+\/\*\n\s+!\/docs\/evidence\/\n\s+sparse-checkout-cone-mode: false/u);
	const tests = sourceAt(vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
		, "tests/reproducibility-gate.test.mjs");
	assert.match(tests, /"--no-checkout", `file:\/\/\$\{origin\}`/u);
	assert.match(tests
		, /"sparse-checkout", "set", "--no-cone", "\/\*", "!\/docs\/evidence\/"/u);
	assert.match(tests, /docs", "evidence", "current\.txt"/u);
});

test("release-gate sparse partial checkout reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
			, update.path);
		const previous = sourceAt(
			vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220ReleaseGateSparsePartialCheckoutRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ReleaseGateSparsePartialCheckoutRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
			, update.path);
		assert.equal(reverseVo1220ReleaseGateSparsePartialCheckoutRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseGateSparsePartialCheckoutRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release-gate sparse checkout history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(
		vo1220ReleaseGateSparsePartialCheckoutRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseGateSparsePartialCheckoutRepairUpdate(
			current, forged));
	const root = await mkdtemp(
		`${tmpdir()}/vo1220-release-gate-sparse-partial-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-gate-sparse-partial-checkout-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
