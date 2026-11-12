/**
 * Authenticate the demo job retained-contract scope repair.
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
	beforeVo1220DemoJobScopeRepairSource
	, reverseVo1220DemoJobScopeRepairUpdate
	, vo1220DemoJobScopeRepairAddedPaths
	, vo1220DemoJobScopeRepairHistoryPath
	, vo1220DemoJobScopeRepairImplementation
	, vo1220DemoJobScopeRepairImplementationPaths
	, vo1220DemoJobScopeRepairIntegrationPaths
	, vo1220DemoJobScopeRepairNormalizationPaths
	, vo1220DemoJobScopeRepairPredecessor
} from "./vo1220-demo-job-scope-repair-source-history.mjs";
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
	vo1220DemoJobScopeRepairHistoryPath, "utf8"));

test("demo job scope binds the complete inventory", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-demo-job-scope-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220DemoJobScopeRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220DemoJobScopeRepairImplementation);
	assert.deepEqual(history.sourceInventory, {
		revision: vo1220DemoJobScopeRepairPredecessor
		, sha256: "3203c49f161c7becbc6f31e28972c7b45df45f70e4ee9b2fe65f184aee59597b"
		, evidence: 900, occurrences: 369393, paths: 123815
		, objects: 20975, bytes: 27250477669, batches: 240
		, conflicts: 0, missing: 0, mismatches: 0
	});
	assert.deepEqual(history.hostedFailure, {
		run: 43323785635, job: 131550980549
		, passedBoundary: "Check the React site and canonical documentation"
		, failedBoundary: "Build and verify demo artifacts"
		, missingPath: "docs/evidence/callback-checked-record-browser-20261023/hosted/artifact.zip.parts/0000.part"
	});
	assert.deepEqual(history.localValidation, {
		nestedSiteGeneration: { compiledPages: 79
			, retainedEvidenceFailure: false }
		, focusedWorkflowContract: { passed: 2, failed: 0 }
		, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
	});
	assert.equal(history.refreshedPins, 0);
	assert.deepEqual(history.refreshedSourcePaths, []);
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220DemoJobScopeRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220DemoJobScopeRepairIntegrationPaths);
});

test("demo job scope covers direct and nested site generation", () => {
	const previous = sourceAt(vo1220DemoJobScopeRepairPredecessor
		, ".github/workflows/demos-pages.yml");
	const current = sourceAt(vo1220DemoJobScopeRepairImplementation
		, ".github/workflows/demos-pages.yml");
	assert.equal(previous.match(
		/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 2);
	assert.equal(current.match(
		/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1);
	assert.match(current
		, /jobs:\n {2}build:\n {4}runs-on: ubuntu-24\.04\n {4}timeout-minutes: 45\n {4}env:\n {6}LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/u);
	assert.match(current, /run: npm run demos:verify/u);
	assert.match(current, /run: npm run demos:site/u);
	const contract = sourceAt(vo1220DemoJobScopeRepairImplementation
		, "tests/documentation-demo-api.test.mjs");
	assert.match(contract
		, /LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/u);
	assert.doesNotMatch(contract
		, /Check the React site and canonical documentation\\n \{8\}env/u);
});

test("demo job scope reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220DemoJobScopeRepairImplementation, update.path);
		const previous = sourceAt(
			vo1220DemoJobScopeRepairPredecessor, update.path);
		assert.equal(reverseVo1220DemoJobScopeRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220DemoJobScopeRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220DemoJobScopeRepairImplementation, update.path);
		assert.equal(reverseVo1220DemoJobScopeRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220DemoJobScopeRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("demo job scope rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220DemoJobScopeRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220DemoJobScopeRepairImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220DemoJobScopeRepairUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-demo-job-scope-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-demo-job-scope-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
