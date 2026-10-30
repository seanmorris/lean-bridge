/**
 * Authenticate the final focused HostNull managed and systems gate repair.
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
	beforeHostNullFinalGateRepairSource
	, hostNullFinalGateRepairHistoryAdditions
	, hostNullFinalGateRepairHistoryPath
	, hostNullFinalGateRepairImplementation
	, hostNullFinalGateRepairImplementationPaths
	, hostNullFinalGateRepairIntegrationPaths
	, hostNullFinalGateRepairPredecessor
	, reverseHostNullFinalGateRepairUpdate
} from "./host-null-final-gate-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullFinalGateRepairHistoryPath, "utf8"));

test("final HostNull gate repair records its exact failed run", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "host-null-final-gate-repair-source-v1");
	assert.equal(history.predecessorCommit, hostNullFinalGateRepairPredecessor);
	assert.equal(history.implementationCommit
		, hostNullFinalGateRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullFinalGateRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullFinalGateRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41040646713);
	assert.deepEqual(history.failedJobIds
		, [124021991307, 124021991314, 124021991342, 124028369157]);
	assert.deepEqual(history.diagnosticArtifactIds
		, [12971188224, 12972145611, 12972235145]);
	assert.equal(history.replayedManagedChecks, 132);
	assert.equal(history.supportClaimsChanged, false);
});

test("final HostNull gate repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullFinalGateRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullFinalGateRepairImplementation}:${update.path}`]);
		assert.equal(reverseHostNullFinalGateRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullFinalGateRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("final HostNull gate repair binds both hosted diagnoses", () => {
	const checker = git(["show"
		, `${hostNullFinalGateRepairImplementation}:scripts/check-host-null-managed-ci.mjs`]);
	const systems = git(["show"
		, `${hostNullFinalGateRepairImplementation}:tests/helpers/host-null-systems-installed.mjs`]);
	assert.match(checker
		, /hostNullManagedFixturePaths\[observation\.profile\]/u);
	assert.doesNotMatch(checker, /host-null-consumers\/\$\{extension\}/u);
	assert.match(systems, /bridge-value-3 = option<bridge-value-2>/u);
	assert.match(systems, /bridge-value-4 = option<bridge-value-1>/u);
	assert.doesNotMatch(systems, /option<option<u32>>/u);
});

test("final HostNull gate repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullFinalGateRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("final HostNull gate repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullFinalGateRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullFinalGateRepairUpdate(
		current, forged));
});

test("final HostNull gate repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-final-gate-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-final-gate-repair-source-history-20261030\.json/u);
});
