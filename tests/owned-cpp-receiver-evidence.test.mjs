/**
 * Authenticate C++ receiver source history and reject partial execution claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedCppReceiverExecution } from "./helpers/owned-cpp-receiver-evidence.mjs";
import { ownedRustReceiverHistoricalBytes } from "./helpers/owned-rust-receiver-history.mjs";
import { ownedCppReceiverPath, ownedCppReceiverBaseline, ownedCppReceiverPrevious
	, ownedCppReceiverChangedPaths, ownedCppReceiverAddedPaths
	, beforeOwnedCppReceiver, reverseOwnedCppReceiverUpdate } from "./helpers/owned-cpp-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedCppReceiverPath, "utf8"));

test("C++ receiver evidence binds complete sources without changing historical receipts or support cells", async () => {
	const record = await read();
	assert.equal(record.acceptance, "passed"); assert.equal(record.kind, "owned-cpp-receivers");
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedCppReceiverBaseline); assert.deepEqual(record.previous, ownedCppReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedCppReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedRustReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedCppReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = ownedRustReceiverHistoricalBytes(update.path, await readFile(update.path), update.currentSha256).toString();
		const prior = beforeOwnedCppReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedCppReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedCppReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedCppReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedCppReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedCppReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = ownedRustReceiverHistoricalBytes(path, await readFile(path), record.sources[path]).toString();
	const prior = JSON.parse(beforeOwnedCppReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedRustReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-cpp-receivers", "owned-cpp-receiver-packaging"
		, "owned-cpp-receiver-plain", "owned-cpp-receiver-contract"
		, "owned-cpp-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("C++ receiver evidence requires compiled, sanitized and installed execution", async () => {
	await assertOwnedCppReceiverExecution(await read());
});

test("C++ receiver evidence rejects missing work and inflated scope", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace('"checks":948', '"checks":949'); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].restored = false; }
		, value => { value.runtime[0].mutations.pop(); }
		, value => { value.runtime[1].mutations[0].compiled = false; }
		, value => { value.runtime[1].result.identities++; }
		, value => { value.runtime[0].sanitizer.after = 0; }
		, value => { value.runtime[0].contract.receiverExports.properties = "fields"; }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].result.identities++; }
		, value => { value.plain[2].model.ownedGraph.inputTransfers = undefined; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[1].independentRebuild = false; }
		, value => { value.packages[0].builds.pop(); }
		, value => { value.packages[1].rejected--; }
		, value => { value.packages[0].adapter.cppValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.packages[0].manifest.cppValues.receiverExports.members = "camelCase"; }
		, value => { value.packages[1].documentation.stdout = "42\n"; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedCppReceiverExecution(changed), undefined, mutate.toString());
	}
});
