/**
 * Authenticate the Kotlin compound contract repair for explicit HostNull.
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
	beforeHostNullKotlinCompoundContractRepairSource
	, hostNullKotlinCompoundContractRepairHistoryAdditions
	, hostNullKotlinCompoundContractRepairHistoryPath
	, hostNullKotlinCompoundContractRepairImplementation
	, hostNullKotlinCompoundContractRepairImplementationPaths
	, hostNullKotlinCompoundContractRepairIntegrationPaths
	, hostNullKotlinCompoundContractRepairPredecessor
	, reverseHostNullKotlinCompoundContractRepairUpdate
} from "./host-null-kotlin-compound-contract-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullKotlinCompoundContractRepairHistoryPath, "utf8"));

test("Kotlin HostNull contract repair records its exact lineage", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "host-null-kotlin-compound-contract-repair-source-v1");
	assert.equal(history.predecessorCommit
		, hostNullKotlinCompoundContractRepairPredecessor);
	assert.equal(history.implementationCommit
		, hostNullKotlinCompoundContractRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullKotlinCompoundContractRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullKotlinCompoundContractRepairIntegrationPaths);
	assert.equal(history.semanticImplementationCommit
		, "bbcf283d4ad2fde8b03fd110242326a8510570e8");
	assert.equal(history.hostedProducerRunId, 41040646713);
	assert.equal(history.supportClaimsChanged, false);
});

test("Kotlin HostNull contract repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullKotlinCompoundContractRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullKotlinCompoundContractRepairImplementation}:${update.path}`]);
		assert.equal(reverseHostNullKotlinCompoundContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullKotlinCompoundContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Kotlin HostNull contract repair binds nullable compound checks", () => {
	const source = git(["show"
		, `${hostNullKotlinCompoundContractRepairImplementation}:tests/jvm-kotlin-contract.test.mjs`]);
	assert.match(source, /Option<out T>/u);
	assert.match(source, /Result<out T, out E>/u);
	assert.match(source, /Pair<out A, out B>/u);
	assert.match(source, /requireNonNull/u);
	assert.match(source, /kotlin\\\.Any/u);
});

test("Kotlin HostNull contract repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullKotlinCompoundContractRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("Kotlin HostNull contract repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullKotlinCompoundContractRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseHostNullKotlinCompoundContractRepairUpdate(current, forged));
});

test("Kotlin HostNull contract repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-kotlin-compound-contract-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-kotlin-compound-contract-repair-source-history-20261030\.json/u);
});
