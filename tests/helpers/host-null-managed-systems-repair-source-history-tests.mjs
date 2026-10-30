/**
 * Authenticate the focused HostNull managed and systems producer repair.
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
	beforeHostNullManagedSystemsRepairSource
	, hostNullManagedSystemsRepairHistoryAdditions
	, hostNullManagedSystemsRepairHistoryPath
	, hostNullManagedSystemsRepairImplementation
	, hostNullManagedSystemsRepairImplementationPaths
	, hostNullManagedSystemsRepairIntegrationPaths
	, hostNullManagedSystemsRepairPredecessor
	, reverseHostNullManagedSystemsRepairUpdate
} from "./host-null-managed-systems-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullManagedSystemsRepairHistoryPath, "utf8"));

test("focused HostNull producer repair records its exact failed run", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "host-null-managed-systems-repair-source-v1");
	assert.equal(history.predecessorCommit
		, hostNullManagedSystemsRepairPredecessor);
	assert.equal(history.implementationCommit
		, hostNullManagedSystemsRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullManagedSystemsRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullManagedSystemsRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41034251688);
	assert.deepEqual(history.failedJobIds
		, [124003451593, 124003451626, 124003451779]);
});

test("focused HostNull producer repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullManagedSystemsRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullManagedSystemsRepairImplementation}:${update.path}`]);
		assert.equal(reverseHostNullManagedSystemsRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullManagedSystemsRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("focused HostNull producer repair binds all three diagnoses", () => {
	const managed = git(["show"
		, `${hostNullManagedSystemsRepairImplementation}:tests/helpers/host-null-managed-installed.mjs`]);
	const jvm = git(["show"
		, `${hostNullManagedSystemsRepairImplementation}:src/build/compile-jvm-sources.mjs`]);
	const systems = git(["show"
		, `${hostNullManagedSystemsRepairImplementation}:scripts/run-host-null-systems-ci.sh`]);
	assert.match(managed, /host-null-consumers\/dotnet\.cs/u);
	assert.match(managed, /host-null-consumers\/java\.java/u);
	assert.match(managed, /host-null-consumers\/kotlin\.kt/u);
	assert.match(jvm, /join\(lib, "annotations-13\.0\.jar"\)\]\.join\(delimiter\)/u);
	assert.match(systems, /mkdir -p build/u);
	assert.doesNotMatch(systems, /mkdir -p "\$output"/u);
});

test("focused HostNull producer repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullManagedSystemsRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("focused HostNull producer repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullManagedSystemsRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseHostNullManagedSystemsRepairUpdate(current, forged));
});

test("focused HostNull producer repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-managed-systems-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-managed-systems-repair-source-history-20261030\.json/u);
});
