/**
 * Authenticate the canonical dependent-Python receipt repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDependentPythonReceiptCanonicalSource
	, dependentPythonReceiptCanonicalHistoryAdditions
	, dependentPythonReceiptCanonicalHistoryPath
	, dependentPythonReceiptCanonicalImplementation
	, dependentPythonReceiptCanonicalImplementationPaths
	, dependentPythonReceiptCanonicalIntegrationPaths
	, dependentPythonReceiptCanonicalPredecessor
	, reverseDependentPythonReceiptCanonicalUpdate
} from "./dependent-python-receipt-canonical-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentPythonReceiptCanonicalHistoryPath, "utf8"));

test("dependent Python canonical receipt records one exact repair", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "dependent-python-receipt-canonical-source-v1");
	assert.equal(history.predecessorCommit
		, dependentPythonReceiptCanonicalPredecessor);
	assert.equal(history.implementationCommit
		, dependentPythonReceiptCanonicalImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, [...dependentPythonReceiptCanonicalImplementationPaths]);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, [...dependentPythonReceiptCanonicalIntegrationPaths]);
	assert.equal(history.failedRunId, 40927405318);
	assert.equal(history.failedJobId, 123746156645);
	assert.equal(history.failedRoute, "ordinary-source");
	assert.equal(history.canonicalRoutes, 4);
});

test("dependent Python canonical receipt reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = git(["show"
			, `${dependentPythonReceiptCanonicalImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${dependentPythonReceiptCanonicalPredecessor}:${update.path}`]);
		assert.equal(reverseDependentPythonReceiptCanonicalUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDependentPythonReceiptCanonicalSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${dependentPythonReceiptCanonicalImplementation}:${update.path}`]);
		assert.equal(reverseDependentPythonReceiptCanonicalUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDependentPythonReceiptCanonicalSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("dependent Python canonical receipt authenticates controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, [...dependentPythonReceiptCanonicalHistoryAdditions]);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
	const checker = git(["show"
		, `${dependentPythonReceiptCanonicalImplementation}`
		+ ":scripts/check-dependent-checked-record-python-ci.mjs"]);
	assert.match(checker
		, /process\.stdout\.write\(renderDependentCheckedRecordPythonCiVerification\(result\)\)/u);
	assert.doesNotMatch(checker, /JSON\.stringify\(result/u);
});

test("dependent Python canonical receipt rejects forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${dependentPythonReceiptCanonicalImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseDependentPythonReceiptCanonicalUpdate(
			current, forged));
	}
);

test("dependent Python canonical receipt writer refuses another checkout", () => {
	const result = spawnSync(process.execPath, [
		"scripts/update-dependent-python-receipt-canonical-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
	assert.match(`${result.stdout}${result.stderr}`
		, /dependent-python-receipt-canonical-source-history-20261029\.json/u);
});
