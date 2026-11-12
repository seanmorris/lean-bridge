/**
 * Authenticate the bounded release-gate checkout and stale site-contract repair.
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
	beforeVo1220ReleaseGateStorageRepairSource
	, reverseVo1220ReleaseGateStorageRepairUpdate
	, vo1220ReleaseGateStorageRepairAddedPaths
	, vo1220ReleaseGateStorageRepairHistoryPath
	, vo1220ReleaseGateStorageRepairImplementation
	, vo1220ReleaseGateStorageRepairImplementationPaths
	, vo1220ReleaseGateStorageRepairIntegrationPaths
	, vo1220ReleaseGateStorageRepairNormalizationPaths
	, vo1220ReleaseGateStorageRepairPredecessor
} from "./vo1220-release-gate-storage-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ReleaseGateStorageRepairHistoryPath, "utf8"));

test("release-gate storage repair records both failed PR checks and exact source range", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-release-gate-storage-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseGateStorageRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseGateStorageRepairImplementation);
	assert.deepEqual(history.failedRuns, [
		{ workflow: 43273104746, job: 131374362438, failure: "stale site capability assertion" }
		, { workflow: 43273104917, job: 131374361748, failure: "opaque full object-store clone exit 128" }
	]);
	assert.deepEqual(names(["diff", "--name-only"
		, vo1220ReleaseGateStorageRepairPredecessor
		, vo1220ReleaseGateStorageRepairImplementation])
	, [...vo1220ReleaseGateStorageRepairImplementationPaths].sort());
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseGateStorageRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseGateStorageRepairIntegrationPaths);
});

test("release-gate storage repair closes the complete clone and site assertion cohort", async () => {
	const history = await record();
	const universal = sourceAt(vo1220ReleaseGateStorageRepairImplementation
		, "src/release/reproducibility-gate.mjs");
	const component = sourceAt(vo1220ReleaseGateStorageRepairImplementation
		, "src/release/component-reproducibility-gate.mjs");
	const site = sourceAt(vo1220ReleaseGateStorageRepairImplementation
		, "site/workflows.test.mjs");
	const tests = sourceAt(vo1220ReleaseGateStorageRepairImplementation
		, "tests/reproducibility-gate.test.mjs");
	for(const source of [universal, component])
		assert.doesNotMatch(source, /--no-local|--no-hardlinks/u);
	assert.match(universal, /"clone", "--quiet", "--shared", "--no-checkout"/u);
	assert.match(universal, /"sparse-checkout", "set", "--no-cone", "\/\*", "!\/docs\/evidence\/"/u);
	assert.match(universal, /--is-shallow-repository/u);
	assert.match(universal, /boundedCommandFailureDetails/u);
	assert.match(component, /"clone", "--quiet", "--local", "--no-checkout"/u);
	assert.match(component, /boundedCommandFailureDetails/u);
	assert.match(site, /dependent signatures outside the supported direct earlier-Nat `Fin` parameter form/u);
	assert.match(tests, /source preparation rejects a shallow repository before sharing objects/u);
	assert.match(tests, /both release gates reuse immutable Git objects/u);
	assert.deepEqual(history.storageObservation, {
		packedRepository: "greater than 25 GiB"
		, universalSparseCheckoutBytes: 246367667
		, priorPhysicalObjectCopies: 2
		, currentPhysicalObjectCopies: 0
	});
});

test("release-gate storage repair reverses every authenticated source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(reverseVo1220ReleaseGateStorageRepairUpdate(
			sourceAt(vo1220ReleaseGateStorageRepairImplementation, update.path), update)
		, sourceAt(vo1220ReleaseGateStorageRepairPredecessor, update.path), update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(vo1220ReleaseGateStorageRepairImplementation
			, update.path);
		assert.equal(reverseVo1220ReleaseGateStorageRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeVo1220ReleaseGateStorageRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseGateStorageRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release-gate storage repair rejects forged history and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseGateStorageRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ReleaseGateStorageRepairImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseGateStorageRepairUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-release-gate-storage-guard-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-gate-storage-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
