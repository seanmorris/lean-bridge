/**
 * Authenticate Rust receiver source history and reject incomplete execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedRustReceiverExecution } from "./helpers/owned-rust-receiver-evidence.mjs";
import { ownedPythonReceiverHistoricalBytes } from "./helpers/owned-python-receiver-history.mjs";
import { ownedRustReceiverPath, ownedRustReceiverBaseline, ownedRustReceiverPrevious
	, ownedRustReceiverChangedPaths, ownedRustReceiverAddedPaths
	, beforeOwnedRustReceiver, reverseOwnedRustReceiverUpdate } from "./helpers/owned-rust-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedRustReceiverPath, "utf8"));

test("Rust receiver evidence binds complete sources without changing historical receipts or support cells", async () => {
	const record = await read();
	assert.equal(record.acceptance, "passed"); assert.equal(record.kind, "owned-rust-receivers");
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedRustReceiverBaseline); assert.deepEqual(record.previous, ownedRustReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedRustReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedPythonReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedRustReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = ownedPythonReceiverHistoricalBytes(update.path, await readFile(update.path), update.currentSha256).toString();
		const prior = beforeOwnedRustReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedRustReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedRustReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedRustReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRustReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedRustReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = ownedPythonReceiverHistoricalBytes(path, await readFile(path), record.sources[path]).toString();
	const prior = JSON.parse(beforeOwnedRustReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPythonReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-rust-receivers", "owned-rust-receiver-packaging"
		, "owned-rust-receiver-plain", "owned-rust-receiver-contract"
		, "owned-rust-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("Rust receiver evidence requires compiled and installed execution on both paths", async () => {
	await assertOwnedRustReceiverExecution(await read());
});

test("Rust receiver evidence rejects missing work and inflated scope", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => {
			const count = value.runtime[0].result.checks;
			value.run.text = value.run.text.replace(`"checks":${count}`, `"checks":${count + 1}`); value.run.sha256 = sha256(value.run.text);
		}
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].restored = false; }
		, value => { value.runtime[0].mutations.pop(); }
		, value => { value.runtime[1].mutations[0].compiled = false; }
		, value => { value.runtime[1].result.identities++; }
		, value => { value.runtime[0].result.panicFaults = 0; }
		, value => { value.runtime[0].rejected.pop(); }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].result.identities++; }
		, value => { value.plain[2].model.ownedGraph.inputTransfers = undefined; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[1].independentRebuild = false; }
		, value => { value.packages[0].builds.pop(); }
		, value => { value.packages[1].rejected--; }
		, value => { value.packages[0].adapter.rustValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.packages[0].compiled.ownedValues.receiverExports.members = "camelCase"; }
		, value => { value.packages[1].documentation.stdout = "42\n"; }
		, value => { value.packages[1].linkerSha256 = "0".repeat(64); }
		, value => { value.packages[0].manifest.compiledProjectionSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedRustReceiverExecution(changed), undefined, mutate.toString());
	}
});
