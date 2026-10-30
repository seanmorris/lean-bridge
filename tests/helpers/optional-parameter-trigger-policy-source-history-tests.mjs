/**
 * Authenticate the optional-parameter trigger-policy repair.
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
	beforeOptionalParameterTriggerPolicySource
	, optionalParameterTriggerPolicyHistoryAdditions
	, optionalParameterTriggerPolicyHistoryPath
	, optionalParameterTriggerPolicyImplementation
	, optionalParameterTriggerPolicyImplementationPaths
	, optionalParameterTriggerPolicyIntegrationPaths
	, optionalParameterTriggerPolicyPredecessor
	, reverseOptionalParameterTriggerPolicyUpdate
} from "./optional-parameter-trigger-policy-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterTriggerPolicyHistoryPath, "utf8"));

test("optional trigger repair records the exact pre-shard refusal", async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "optional-parameter-trigger-policy-source-v1");
		assert.equal(history.predecessorCommit
			, optionalParameterTriggerPolicyPredecessor);
		assert.equal(history.implementationCommit
			, optionalParameterTriggerPolicyImplementation);
		assert.equal(history.supersededRun, 41114133104);
		assert.equal(history.detectedBeforeContractShards, true);
		assert.equal(history.workflow, "optional-parameter-complete.yml");
		assert.deepEqual(history.events, ["pull_request", "push"]);
		assert.equal(history.approvedAutomaticWorkflowCount, 12);
		assert.equal(history.pathScopedAutomaticWorkflowCount, 7);
		assert.deepEqual(history.updates.map(item => item.path)
			, optionalParameterTriggerPolicyImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, optionalParameterTriggerPolicyIntegrationPaths);
});

test("optional trigger repair reverses every modified source", async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				optionalParameterTriggerPolicyImplementation, update.path), update)
			, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterTriggerPolicyImplementation}:${update.path}`]);
			assert.equal(reverseOptionalParameterTriggerPolicyUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterTriggerPolicySource(
				update.path, current, update.previousSha256), previous, update.path);
		}
});

test("optional activation is path scoped and explicitly budgeted", async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, optionalParameterTriggerPolicyHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const source = await readFile("tests/workflow-trigger-policy.test.mjs"
			, "utf8");
		assert.ok(source.includes(
			'["optional-parameter-complete.yml", ["pull_request", "push"]]'));
		assert.ok(source.includes("approvedAutomaticEvents.size, 12"));
		assert.ok(source.includes("pathScopedAutomaticWorkflows.size, 7"));
});

test("optional trigger repair rejects forged transitions", async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${optionalParameterTriggerPolicyImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseOptionalParameterTriggerPolicyUpdate(current, forged));
});

test("optional-parameter trigger history writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-trigger-policy-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /optional-parameter-trigger-policy-source-history-20261030\.json/u);
});
