/**
 * Authenticate the release-ready sparse-checkout repair.
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
	beforeVo1220ReleaseReadySparseCheckoutRepairSource
	, reverseVo1220ReleaseReadySparseCheckoutRepairUpdate
	, vo1220ReleaseReadySparseCheckoutRepairAddedPaths
	, vo1220ReleaseReadySparseCheckoutRepairHistoryPath
	, vo1220ReleaseReadySparseCheckoutRepairImplementation
	, vo1220ReleaseReadySparseCheckoutRepairImplementationPaths
	, vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths
	, vo1220ReleaseReadySparseCheckoutRepairNormalizationPaths
	, vo1220ReleaseReadySparseCheckoutRepairPredecessor
} from "./vo1220-release-ready-sparse-checkout-repair-source-history.mjs";
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
	vo1220ReleaseReadySparseCheckoutRepairHistoryPath, "utf8"));
const sparseCheckoutPattern
	= /filter: blob:none\n\s+sparse-checkout: \|\n\s+\/\*\n\s+!\/docs\/evidence\/\n\s+sparse-checkout-cone-mode: false/gu;

test("release-ready sparse checkout binds the complete inventory", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-release-ready-sparse-checkout-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseReadySparseCheckoutRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseReadySparseCheckoutRepairImplementation);
	assert.deepEqual(history.sourceInventory, {
		revision: vo1220ReleaseReadySparseCheckoutRepairPredecessor
		, evidence: 900, occurrences: 369393, paths: 123815
		, objects: 20975, bytes: 27250476050, mismatches: 0
	});
	assert.deepEqual(history.localValidation, {
		releaseAuthorization: { passed: 25, failed: 0 }
		, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
	});
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseReadySparseCheckoutRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths);
});

test("both release jobs exclude retained evidence independently", () => {
	const previous = sourceAt(vo1220ReleaseReadySparseCheckoutRepairPredecessor
		, ".github/workflows/reproducible-release.yml");
	const current = sourceAt(vo1220ReleaseReadySparseCheckoutRepairImplementation
		, ".github/workflows/reproducible-release.yml");
	assert.equal([...previous.matchAll(sparseCheckoutPattern)].length, 1);
	assert.equal([...current.matchAll(sparseCheckoutPattern)].length, 2);
	assert.match(previous
		, /Check out authorization verifier[\s\S]*?with:\n\s+persist-credentials: false/u);
	assert.doesNotMatch(previous
		, /Check out authorization verifier[\s\S]*?filter: blob:none/u);
	assert.match(current
		, /Check out authorization verifier[\s\S]*?filter: blob:none/u);
	const tests = sourceAt(vo1220ReleaseReadySparseCheckoutRepairImplementation
		, "tests/reproducibility-gate.test.mjs");
	assert.match(tests
		, /checkouts\.map\(checkout => checkout\.name\)/u);
	assert.match(tests, /for\(const checkout of checkouts\)/u);
});

test("release-ready sparse checkout reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220ReleaseReadySparseCheckoutRepairImplementation, update.path);
		const previous = sourceAt(
			vo1220ReleaseReadySparseCheckoutRepairPredecessor, update.path);
		assert.equal(reverseVo1220ReleaseReadySparseCheckoutRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ReleaseReadySparseCheckoutRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220ReleaseReadySparseCheckoutRepairImplementation, update.path);
		assert.equal(reverseVo1220ReleaseReadySparseCheckoutRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseReadySparseCheckoutRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release-ready sparse checkout history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseReadySparseCheckoutRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(
		vo1220ReleaseReadySparseCheckoutRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseReadySparseCheckoutRepairUpdate(current, forged));
	const root = await mkdtemp(
		`${tmpdir()}/vo1220-release-ready-sparse-checkout-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-ready-sparse-checkout-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
