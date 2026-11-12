/**
 * Authenticate the demo site retained-contract scope repair.
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
	beforeVo1220DemoSiteContractScopeRepairSource
	, reverseVo1220DemoSiteContractScopeRepairUpdate
	, vo1220DemoSiteContractScopeRepairAddedPaths
	, vo1220DemoSiteContractScopeRepairHistoryPath
	, vo1220DemoSiteContractScopeRepairImplementation
	, vo1220DemoSiteContractScopeRepairImplementationPaths
	, vo1220DemoSiteContractScopeRepairIntegrationPaths
	, vo1220DemoSiteContractScopeRepairNormalizationPaths
	, vo1220DemoSiteContractScopeRepairPredecessor
} from "./vo1220-demo-site-contract-scope-repair-source-history.mjs";
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
	vo1220DemoSiteContractScopeRepairHistoryPath, "utf8"));

test("demo site contract scope binds the complete inventory", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-demo-site-contract-scope-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220DemoSiteContractScopeRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220DemoSiteContractScopeRepairImplementation);
	assert.deepEqual(history.sourceInventory, {
		revision: vo1220DemoSiteContractScopeRepairPredecessor
		, sha256: "0d29c661d48ef35f1c3607eeae45c310408bf726c369c4766ce88959e4b1e11d"
		, evidence: 900, occurrences: 369393, paths: 123815
		, objects: 20975, bytes: 27250476635, batches: 240
		, conflicts: 0, missing: 0, mismatches: 0
	});
	assert.deepEqual(history.localValidation, {
		siteTypecheck: "passed"
		, siteTests: { passed: 112, failed: 0, skipped: 0 }
		, demoDocumentation: { passed: 78, failed: 0, skipped: 3 }
		, modelAuthoritySeparation: { passed: 1, failed: 0 }
		, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
	});
	assert.equal(history.refreshedPins, 1);
	assert.deepEqual(history.refreshedSourcePaths
		, ["src/adoption/type-surface.mjs"]);
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220DemoSiteContractScopeRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220DemoSiteContractScopeRepairIntegrationPaths);
});

test("demo site validates the model without claiming evidence authority", () => {
	const previousWorkflow = sourceAt(
		vo1220DemoSiteContractScopeRepairPredecessor
		, ".github/workflows/demos-pages.yml");
	const currentWorkflow = sourceAt(
		vo1220DemoSiteContractScopeRepairImplementation
		, ".github/workflows/demos-pages.yml");
	assert.equal(previousWorkflow.match(
		/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1);
	assert.equal(currentWorkflow.match(
		/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 2);
	assert.match(currentWorkflow
		, /Check the React site and canonical documentation\n\s+env:\n\s+LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/u);
	const previousGenerator = sourceAt(
		vo1220DemoSiteContractScopeRepairPredecessor
		, "scripts/generate-site-content.mjs");
	const currentGenerator = sourceAt(
		vo1220DemoSiteContractScopeRepairImplementation
		, "scripts/generate-site-content.mjs");
	assert.doesNotMatch(previousGenerator, /readTypeSurfaceContract/u);
	assert.match(currentGenerator, /retainedContracts === 'deferred'/u);
	assert.match(currentGenerator
		, /LEAN_BRIDGE_RETAINED_CONTRACTS must be one of: required, deferred/u);
	const adoption = sourceAt(vo1220DemoSiteContractScopeRepairImplementation
		, "src/adoption/type-surface.mjs");
	assert.match(adoption, /export async function readTypeSurfaceContract/u);
	assert.match(adoption
		, /Evidence-byte authority remains the responsibility of readTypeSurface/u);
	assert.match(adoption, /export async function readTypeSurface\(options = \{\}\)/u);
	const coverage = sourceAt(vo1220DemoSiteContractScopeRepairImplementation
		, "site/content.test.mjs");
	assert.match(coverage
		, /sparse site input validates the model without claiming retained evidence/u);
	assert.match(coverage, /assert\.rejects\(readTypeSurface/u);
});

test("demo site contract scope reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220DemoSiteContractScopeRepairImplementation, update.path);
		const previous = sourceAt(
			vo1220DemoSiteContractScopeRepairPredecessor, update.path);
		assert.equal(reverseVo1220DemoSiteContractScopeRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220DemoSiteContractScopeRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220DemoSiteContractScopeRepairImplementation, update.path);
		assert.equal(reverseVo1220DemoSiteContractScopeRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220DemoSiteContractScopeRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("demo site contract scope rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220DemoSiteContractScopeRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(
		vo1220DemoSiteContractScopeRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220DemoSiteContractScopeRepairUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-demo-site-scope-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-demo-site-contract-scope-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
