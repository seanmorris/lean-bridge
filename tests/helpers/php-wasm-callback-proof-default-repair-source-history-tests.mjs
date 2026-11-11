/**
 * Verify the final-activation callback proof-default repair and its reversible
 * source boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforePhpWasmCallbackProofDefaultRepairSource
	, phpWasmCallbackProofDefaultRepairBehavior
	, phpWasmCallbackProofDefaultRepairHistoryAdditions
	, phpWasmCallbackProofDefaultRepairHistoryPath
	, phpWasmCallbackProofDefaultRepairImplementation
	, phpWasmCallbackProofDefaultRepairImplementationPaths
	, phpWasmCallbackProofDefaultRepairIntegrationPaths
	, phpWasmCallbackProofDefaultRepairPredecessor
	, reversePhpWasmCallbackProofDefaultRepairUpdate
} from "./php-wasm-callback-proof-default-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const history = async () => JSON.parse(await readFile(
	phpWasmCallbackProofDefaultRepairHistoryPath, "utf8"));

test("callback proof-default repair records one exact implementation", async () => {
	const value = await history();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "php-wasm-callback-proof-default-repair-source-v1");
	assert.equal(value.predecessorCommit
		, phpWasmCallbackProofDefaultRepairPredecessor);
	assert.equal(value.implementationCommit
		, phpWasmCallbackProofDefaultRepairImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, phpWasmCallbackProofDefaultRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, phpWasmCallbackProofDefaultRepairIntegrationPaths);
	assert.deepEqual(value.behavior
		, phpWasmCallbackProofDefaultRepairBehavior);
	assert.equal(git(["rev-parse"
		, `${phpWasmCallbackProofDefaultRepairImplementation}^`]).trim()
		, phpWasmCallbackProofDefaultRepairPredecessor);
});

test("callback proof-default repair reverses every source", async () => {
	const value = await history();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			phpWasmCallbackProofDefaultRepairImplementation, update.path)
		, update), true, update.path);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(
			phpWasmCallbackProofDefaultRepairImplementation, update.path);
		assert.equal(reversePhpWasmCallbackProofDefaultRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforePhpWasmCallbackProofDefaultRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("callback proof-default repair binds proof-safe generation", async () => {
	const source = blob(phpWasmCallbackProofDefaultRepairImplementation
		, "src/build/component-structured-callable-lean.mjs");
	assert.match(source, /unsafeDefaultIds/u);
	assert.match(source, /proof-preserving source recovery value/u);
	const regression = blob(phpWasmCallbackProofDefaultRepairImplementation
		, "tests/callback-checked-record-native.test.mjs");
	assert.match(regression, /LbErased\\\.Structured\\\.Interval/u);
	assert.match(regression, /doesNotMatch\(source/u);
});

test("callback proof-default history authenticates additions and forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, phpWasmCallbackProofDefaultRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates.find(item => item.edits.length > 0);
		const current = blob(
			phpWasmCallbackProofDefaultRepairImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reversePhpWasmCallbackProofDefaultRepairUpdate(current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-php-wasm-callback-proof-default-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
