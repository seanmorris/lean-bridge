/**
 * Authenticate Ruby receiver sources without accepting missing package checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedDotnetReceiver, ownedDotnetReceiverHistoricalBytes } from "./helpers/owned-dotnet-receiver-history.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedRubyReceiverExecution } from "./helpers/owned-ruby-receiver-evidence.mjs";
import { ownedRubyReceiverPath, ownedRubyReceiverBaseline, ownedRubyReceiverPrevious
	, ownedRubyReceiverChangedPaths, ownedRubyReceiverAddedPaths
	, beforeOwnedRubyReceiver, reverseOwnedRubyReceiverUpdate } from "./helpers/owned-ruby-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedRubyReceiverPath, "utf8"));

test("Ruby receiver evidence binds exact sources without changing historical receipts or support cells", async () => {
	const record = await read();
	assert.equal(record.acceptance, "passed"); assert.equal(record.kind, "owned-ruby-receivers");
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedRubyReceiverBaseline); assert.deepEqual(record.previous, ownedRubyReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedRubyReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedDotnetReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedRubyReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedDotnetReceiver(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedRubyReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedRubyReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedRubyReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedRubyReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRubyReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedRubyReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedDotnetReceiver(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedRubyReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedDotnetReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-ruby-receivers", "owned-ruby-receiver-packaging"
		, "owned-ruby-receiver-plain", "owned-ruby-receiver-contract"
		, "owned-ruby-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("Ruby receiver evidence requires both compiled and installed source paths", async () => {
	await assertOwnedRubyReceiverExecution(await read());
});

test("Ruby receiver evidence rejects incomplete execution and inflated scope", async () => {
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
			const count = value.runtime[0].observed.checks;
			value.run.text = value.run.text.replace(`"checks":${count}`, `"checks":${count + 1}`); value.run.sha256 = sha256(value.run.text);
		}
		, value => { value.runtime.pop(); }
		, value => { value.runtime[1].observed.identities++; }
		, value => { value.runtime[0].restored = false; }
		, value => { value.runtime[0].rejectedMutations.pop(); }
		, value => { value.runtime[1].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].observed.foreignCloseSchedules.pop(); }
		, value => { value.runtime[0].observed.rubyBefore = 0; }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].observed.identities++; }
		, value => { value.plain[2].model.ownedGraph.inputTransfers = undefined; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[1].independentRebuild = false; }
		, value => { value.packages[0].builds.pop(); }
		, value => { value.packages[1].rejected--; }
		, value => { value.packages[0].adapter.rubyValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.packages[0].adapter.rubyValues.receiverExports.properties = "mutable-fields"; }
		, value => { value.packages[1].documentation.stdout = "42\n"; }
		, value => { value.packages[0].gemCacheRemoved = false; }
		, value => { value.packages[0].loader.liveIdentities++; }
		, value => { value.packages[0].relocatedObservation.checks--; }
		, value => { value.packages[0].needed[0] = "libgmp.so.10"; }
		, value => { value.packages[0].loader.privateGmp = false; }
		, value => { value.packages[0].loaderRejected.pop(); }
		, value => { value.packages[1].companions.rust.probeSha256 = "0".repeat(64); }
		, value => { value.packages[1].companions.python.installation.resolvedOffline = false; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedRubyReceiverExecution(changed), undefined, mutate.toString());
	}
});
