/**
 * Authenticate the bounded HostNull promotion source-pin reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import {
	beforeHostNullPromotionPinReconciliationSource
	, hostNullPromotionPinReconciliationHistoryAdditions
	, hostNullPromotionPinReconciliationHistoryPath
	, hostNullPromotionPinReconciliationImplementation
	, hostNullPromotionPinReconciliationImplementationAdditions
	, hostNullPromotionPinReconciliationImplementationPaths
	, hostNullPromotionPinReconciliationIntegrationPaths
	, hostNullPromotionPinReconciliationPredecessor
	, reverseHostNullPromotionPinReconciliationUpdate
} from "./host-null-promotion-pin-reconciliation-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullPromotionPinReconciliationHistoryPath, "utf8"));

test("HostNull promotion pin reconciliation records its exact scope", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "host-null-promotion-pin-reconciliation-source-v1");
	assert.equal(history.predecessorCommit
		, hostNullPromotionPinReconciliationPredecessor);
	assert.equal(history.implementationCommit
		, hostNullPromotionPinReconciliationImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullPromotionPinReconciliationImplementationPaths);
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, hostNullPromotionPinReconciliationImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullPromotionPinReconciliationIntegrationPaths);
	assert.equal(history.typeDocsEvidence, 132);
	assert.equal(history.typeDocsStalePins, 131);
	assert.equal(history.supportClaimsChanged, false);
});

test("HostNull promotion pin reconciliation reverses every changed source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullPromotionPinReconciliationImplementation, update.path
		), update), true, update.path);
	for(const addition of history.implementationAdditions)
		assert.equal(sha256(git(["show"
			, `${hostNullPromotionPinReconciliationImplementation}:${addition.path}`]))
			, addition.sha256, addition.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullPromotionPinReconciliationImplementation}:${update.path}`]);
		assert.equal(reverseHostNullPromotionPinReconciliationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullPromotionPinReconciliationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("HostNull promotion repair is bounded to live-pin reconciliation", () => {
	const source = git(["show"
		, `${hostNullPromotionPinReconciliationImplementation}:scripts/promote-host-null-complete.mjs`]);
	assert.match(source, /reconcileHostNullCompleteSourcePins\(/u);
	assert.match(source, /refreshedPins: reconciliation\.refreshedPins/u);
	assert.match(source, /hostNullCompletePromotionReference\(\)/u);
	assert.doesNotMatch(source, /refreshHostNullPerlEvidence\(/u);
});

test("HostNull promotion pin history additions are exact", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullPromotionPinReconciliationHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("HostNull promotion pin history rejects forgery and duplicate writing", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullPromotionPinReconciliationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullPromotionPinReconciliationUpdate(
		current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-promotion-pin-reconciliation-source-history.mjs"
	], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-promotion-pin-reconciliation-source-history-20261030\.json/u);
});
