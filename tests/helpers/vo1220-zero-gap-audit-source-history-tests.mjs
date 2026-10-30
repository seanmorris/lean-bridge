/**
 * Authenticate the final VO #1220 zero-gap audit contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeVo1220ZeroGapAuditSource, reverseVo1220ZeroGapAuditUpdate
	, vo1220ZeroGapAuditHistoryAdditions, vo1220ZeroGapAuditHistoryPath
	, vo1220ZeroGapAuditImplementation, vo1220ZeroGapAuditImplementationAdditions
	, vo1220ZeroGapAuditImplementationPaths, vo1220ZeroGapAuditIntegrationPaths
	, vo1220ZeroGapAuditPredecessor
} from "./vo1220-zero-gap-audit-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	vo1220ZeroGapAuditHistoryPath, "utf8"));

test("#1220 zero-gap audit records its exact pre-closure inventory", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-zero-gap-audit-source-v1");
	assert.equal(history.predecessorCommit, vo1220ZeroGapAuditPredecessor);
	assert.equal(history.implementationCommit, vo1220ZeroGapAuditImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, vo1220ZeroGapAuditImplementationPaths);
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, vo1220ZeroGapAuditImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, vo1220ZeroGapAuditIntegrationPaths);
	assert.deepEqual([history.owner, history.cells, history.stageEntries]
		, [1220, 1054, 5270]);
	assert.deepEqual([
		history.currentPassedCells, history.currentGapEntries
		, history.remainingShape, history.remainingCells
	], [884, 850, "host-null", 170]);
	assert.equal(history.closesCurrentInventory, false);
});

test("#1220 zero-gap audit reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			vo1220ZeroGapAuditImplementation, update.path), update), true);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${vo1220ZeroGapAuditImplementation}:${update.path}`]);
		assert.equal(reverseVo1220ZeroGapAuditUpdate(current, update), previous);
		assert.equal(beforeVo1220ZeroGapAuditSource(
			update.path, current, update.previousSha256), previous);
	}
});

test("#1220 zero-gap audit authenticates every addition", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(sha256(git(["show"
			, `${vo1220ZeroGapAuditImplementation}:${addition.path}`]))
		, addition.sha256, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, vo1220ZeroGapAuditHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("#1220 zero-gap audit binds the original scope and refusals", () => {
	const source = git(["show"
		, `${vo1220ZeroGapAuditImplementation}:tests/helpers/vo1220-zero-gap.mjs`]);
	const tests = git(["show"
		, `${vo1220ZeroGapAuditImplementation}:tests/helpers/vo1220-zero-gap-tests.mjs`]);
	assert.match(source, /vo1220CellCount, 1054/u);
	assert.match(source, /vo1220StageEntryCount, 5270/u);
	assert.match(source, /"reviewedExclusions", "invalidEvidence"/u);
	assert.match(tests, /rejects one non-passing stage/u);
	assert.match(tests, /rejects inferred profile coverage/u);
	assert.match(tests, /rejects owner and shape drift/u);
});

test("#1220 zero-gap audit rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${vo1220ZeroGapAuditImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseVo1220ZeroGapAuditUpdate(current, forged));
});

test("#1220 zero-gap audit writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-vo1220-zero-gap-audit-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /vo1220-zero-gap-audit-source-history-20261030\.json/u);
});
