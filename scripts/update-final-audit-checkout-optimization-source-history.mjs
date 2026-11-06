#!/usr/bin/env node
/**
 * Record the final audit checkout optimizations and pin reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	auditCurrentSourcePins, previewCurrentSourcePinRefresh
} from "../tests/helpers/current-source-pin-preflight.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	finalAuditCheckoutOptimizationCurrentSources as currentSources
	, finalAuditCheckoutOptimizationHistoryAdditions as historyAdditions
	, finalAuditCheckoutOptimizationHistoryPath as historyPath
	, finalAuditCheckoutOptimizationImplementationAdditions as implementationAdditions
	, finalAuditCheckoutOptimizationIntegrationPaths as integrationPaths
	, finalAuditCheckoutOptimizationOptionalImplementation as optionalImplementation
	, finalAuditCheckoutOptimizationPinRefresh as pinRefresh
	, finalAuditCheckoutOptimizationPredecessor as predecessor
	, finalAuditCheckoutOptimizationValueIndexImplementation as valueIndexImplementation
} from "../tests/helpers/final-audit-checkout-optimization-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-final-audit-checkout-optimization-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), pinRefresh);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), valueIndexImplementation);
assert.equal(git(["rev-parse", `${valueIndexImplementation}^`]).trim()
	, optionalImplementation);
assert.equal(git(["rev-parse", `${optionalImplementation}^`]).trim()
	, predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor
	, optionalImplementation, "--"]), [
	".github/workflows/optional-parameter-complete.yml"
	, "tests/helpers/optional-parameter-complete-ci-tests.mjs"
	].sort());
assert.deepEqual(names(["diff", "--name-only", optionalImplementation
	, valueIndexImplementation, "--"]), [
	".github/workflows/checked-record-value-index-matrix.yml"
	, "tests/checked-record-value-index-matrix.test.mjs"
	, ...implementationAdditions
	].sort());
assert.deepEqual(names(["diff", "--name-only", valueIndexImplementation
	, pinRefresh, "--"]), [inventoryPath]);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${pinRefresh}:${historyPath}`], { stdio: "ignore" }).status, 0);

const before = JSON.parse(git(["show"
	, `${valueIndexImplementation}:${inventoryPath}`]));
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	before, currentSources).sort(), [...currentSources]);
const currentDigests = new Map();
for(const path of currentSources)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	before, currentDigests);
assert.equal(reconciled.refreshed, 26);
assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
	, `${pinRefresh}:${inventoryPath}`])));
const preflightBefore = await auditCurrentSourcePins(before);
assert.deepEqual(preflightBefore.findings.map(item => item.path), currentSources);
assert.deepEqual(previewCurrentSourcePinRefresh(before, preflightBefore)
	, { paths: 4, refreshed: 26 });
const preflightAfter = await auditCurrentSourcePins(reconciled.inventory);
assert.deepEqual(preflightAfter
	, { cohort: 2661, occurrences: 16326, findings: [] });

const implementationUpdates = [];
for(const path of currentSources)
	implementationUpdates.push(await gitSourceHistoryTransition(path, predecessor
		, valueIndexImplementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const pinUpdates = [await gitSourceHistoryTransition(inventoryPath
	, valueIndexImplementation, pinRefresh
	, { maximumEditBytes: 512 * 1024 * 1024 })];
const implementationAddedFiles = [];
for(const path of implementationAdditions)
{
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	implementationAddedFiles.push({ path
		, sha256: sha256(git(["show", `${valueIndexImplementation}:${path}`])) });
}
const exactModels = [predecessor, optionalImplementation
	, valueIndexImplementation, pinRefresh].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const directory = await mkdtemp(join(tmpdir()
	, "lean-final-audit-checkout-history-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", pinRefresh]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", pinRefresh
	], { input: "Authenticate final audit checkout optimizations\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, pinRefresh, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "final-audit-checkout-optimization-v1"
		, predecessorCommit: predecessor
		, optionalImplementationCommit: optionalImplementation
		, valueIndexImplementationCommit: valueIndexImplementation
		, pinRefreshCommit: pinRefresh, integrationCommit
		, scope: "Retain complete Git reachability while materializing only the exact optional-parameter and value-index evidence corpora their recurring audits read. Preserve every replay, inventory, source-history, artifact and support assertion; add fail-closed workflow contracts; refresh only the resulting current-source citations."
		, measurements: {
			optionalRetainedCorpusBytes: 1065300246
			, valueIndexBaselineCheckoutSeconds: 597
			, valueIndexSparseReplayTests: 28
			, valueIndexSparseMissingReads: 0
		}
		, currentSourcePaths: currentSources
		, currentSourceDigests: currentSources.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, preflightBefore, preflightAfter
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, implementationUpdates, pinUpdates, integrationUpdates
		, implementationAdditions: implementationAddedFiles
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${implementationUpdates.length} implementation, `
		+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
