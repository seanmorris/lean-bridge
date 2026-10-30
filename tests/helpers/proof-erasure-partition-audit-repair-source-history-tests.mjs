/**
 * Authenticate the proof-erasure partition audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeProofErasurePartitionAuditRepairSource
	, proofErasurePartitionAuditRepairHistoryAdditions
	, proofErasurePartitionAuditRepairHistoryPath
	, proofErasurePartitionAuditRepairImplementation
	, proofErasurePartitionAuditRepairImplementationPaths
	, proofErasurePartitionAuditRepairIntegrationPaths
	, proofErasurePartitionAuditRepairPredecessor
	, reverseProofErasurePartitionAuditRepairUpdate
} from "./proof-erasure-partition-audit-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	proofErasurePartitionAuditRepairHistoryPath, "utf8"));

test("partition audit repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "proof-erasure-partition-audit-repair-source-v1");
	assert.equal(history.predecessorCommit
		, proofErasurePartitionAuditRepairPredecessor);
	assert.equal(history.implementationCommit
		, proofErasurePartitionAuditRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, proofErasurePartitionAuditRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, proofErasurePartitionAuditRepairIntegrationPaths);
	assert.deepEqual(history.repairedTests, [
		"complete optional-parameter promotion changes only exact cells"
		, "complete optional-parameter promotion refuses partial and overlap"
		, "global Fin history reaches both WIT/lint branch parents"
		, "complete optional-parameter docs state the exact omission boundary"
		, "complete optional-parameter docs reject missing and repeated markers"
	]);
});

test("partition audit repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			proofErasurePartitionAuditRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${proofErasurePartitionAuditRepairImplementation}:${update.path}`]);
		assert.equal(reverseProofErasurePartitionAuditRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeProofErasurePartitionAuditRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("partition audit repair binds tests to the immutable milestone", () => {
	const promotion = git(["show"
		, `${proofErasurePartitionAuditRepairImplementation}:tests/helpers/optional-parameter-complete-promotion-tests.mjs`]);
	const documentation = git(["show"
		, `${proofErasurePartitionAuditRepairImplementation}:tests/helpers/optional-parameter-complete-documentation-tests.mjs`]);
	const history = git(["show"
		, `${proofErasurePartitionAuditRepairImplementation}:tests/helpers/fin-refinement-source-history.mjs`]);
	assert.ok(promotion.includes(
		"${optionalParameterCompletePromotionPredecessor}:docs/type-surface"
	));
	assert.ok(documentation.includes(
		"${optionalParameterCompletePromotionPredecessor}:${path}"
	));
	assert.ok(history.indexOf("beforeDirectProofErasureNpmRouteBinderRepairSource(")
		< history.indexOf("beforeOptionalParameterPinTestMilestoneSource("));
});

test("partition audit repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, proofErasurePartitionAuditRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("partition audit repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${proofErasurePartitionAuditRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseProofErasurePartitionAuditRepairUpdate(current, forged));
});

test("partition audit repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-proof-erasure-partition-audit-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /proof-erasure-partition-audit-repair-source-history-20261030\.json/u);
});
