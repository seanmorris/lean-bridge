/**
 * Authenticate receiver sources and reject incomplete Python package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedPythonReceiverExecution } from "./helpers/owned-python-receiver-evidence.mjs";
import { beforeOwnedRubyReceiver, ownedRubyReceiverHistoricalBytes } from "./helpers/owned-ruby-receiver-history.mjs";
import { ownedPythonReceiverPath, ownedPythonReceiverBaseline, ownedPythonReceiverPrevious
	, ownedPythonReceiverChangedPaths, ownedPythonReceiverAddedPaths
	, beforeOwnedPythonReceiver, reverseOwnedPythonReceiverUpdate } from "./helpers/owned-python-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPythonReceiverPath, "utf8"));

test("Python receiver evidence binds exact sources without changing historical receipts or support cells", async () => {
	const record = await read();
	assert.equal(record.acceptance, "passed"); assert.equal(record.kind, "owned-python-receivers");
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedPythonReceiverBaseline); assert.deepEqual(record.previous, ownedPythonReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPythonReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedRubyReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedPythonReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedRubyReceiver(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedPythonReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedPythonReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedPythonReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedPythonReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPythonReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedPythonReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedRubyReceiver(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedPythonReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedRubyReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-python-receivers", "owned-python-receiver-packaging"
		, "owned-python-receiver-plain", "owned-python-receiver-contract"
		, "owned-python-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("Python receiver evidence requires both compiled and installed source paths", async () => {
	await assertOwnedPythonReceiverExecution(await read());
});

test("Python receiver evidence rejects missing execution and inflated scope", async () => {
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
			const count = value.runtime[0].observations[0].checks;
			value.run.text = value.run.text.replace(`"checks":${count}`, `"checks":${count + 1}`); value.run.sha256 = sha256(value.run.text);
		}
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observations.pop(); }
		, value => { value.runtime[1].observations[0].identities++; }
		, value => { value.runtime[0].observations[0].restored = false; }
		, value => { value.runtime[0].observations[1].rejectedMutations.pop(); }
		, value => { value.runtime[1].observations[2].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].observations[0].foreignCloseSchedules.pop(); }
		, value => { value.runtime[0].observations[0].pythonBefore = 0; }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].observations[0].identities++; }
		, value => { value.plain[2].model.ownedGraph.inputTransfers = undefined; }
		, value => { value.typing.observations.pop(); }
		, value => { value.typing.observations[0].rejected.pop(); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[1].independentRebuild = false; }
		, value => { value.packages[0].builds.pop(); }
		, value => { value.packages[1].rejected--; }
		, value => { value.packages[0].adapter.pythonValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.packages[0].adapter.pythonValues.receiverExports.properties = "methods"; }
		, value => { value.packages[1].observations.pop(); }
		, value => { value.packages[1].observations[0].documentation.stdout = "42\n"; }
		, value => { value.packages[0].observations[0].installation.resolvedOffline = false; }
		, value => { value.packages[0].observations[0].loader.liveIdentities++; }
		, value => { value.packages[0].observations[0].relocatedChecks--; }
		, value => { value.packages[1].companions.rust.probeSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPythonReceiverExecution(changed), undefined, mutate.toString());
	}
});
