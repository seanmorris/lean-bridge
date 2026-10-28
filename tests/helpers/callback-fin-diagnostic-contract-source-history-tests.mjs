/**
 * Authenticate the exact managed callback-Fin diagnostic-contract transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinDiagnosticContractSource
	, callbackFinDiagnosticContractAddedPaths
	, callbackFinDiagnosticContractChangedPaths
	, callbackFinDiagnosticContractHistoryPath
	, callbackFinDiagnosticContractImplementation
	, callbackFinDiagnosticContractIntegrationPaths
	, callbackFinDiagnosticContractPredecessor
	, reverseCallbackFinDiagnosticContractUpdate
} from "./callback-fin-diagnostic-contract-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	callbackFinDiagnosticContractHistoryPath
));

test("callback Fin diagnostic history retains exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "callback-fin-diagnostic-contract-source-v1");
	assert.equal(value.predecessorCommit, callbackFinDiagnosticContractPredecessor);
	assert.equal(value.implementationCommit
		, git(["rev-parse", callbackFinDiagnosticContractImplementation]).trim());
	assert.equal(git(["show", "-s", "--format=%P"
		, value.implementationCommit]).trim(), callbackFinDiagnosticContractPredecessor);
	assert.deepEqual(value.updates.map(item => item.path)
		, callbackFinDiagnosticContractChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, callbackFinDiagnosticContractIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, callbackFinDiagnosticContractAddedPaths);
	for(const addition of value.additions)
		assert.equal(addition.currentSha256, sha256(await readFile(addition.path)));
});

test("callback Fin diagnostic history reverses every exact transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${value.implementationCommit}:${update.path}`]);
		const previous = git(["show", `${value.predecessorCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinDiagnosticContractUpdate(current, update)
			, previous);
		assert.equal(beforeCallbackFinDiagnosticContractSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show", `${value.implementationCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinDiagnosticContractUpdate(current, update)
			, previous);
	}
});

test("callback Fin diagnostic history refuses forgeries and repeat writes", async () => {
	const value = await read(), update = value.updates[0];
	const current = git(["show", `${value.implementationCommit}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinDiagnosticContractUpdate(
		current, forged
	));
	assert.equal(beforeCallbackFinDiagnosticContractSource("unrelated.mjs", current)
		, current);
	const before = await readFile(callbackFinDiagnosticContractHistoryPath);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-diagnostic-contract-source-history.mjs"
	)], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinDiagnosticContractHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinDiagnosticContractHistoryPath.split("/").at(-1)));
});
