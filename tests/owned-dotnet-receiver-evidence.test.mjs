/**
 * Authenticate C# receiver sources without accepting missing package checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeOwnedJvmReceiver, ownedJvmReceiverHistoricalBytes } from "./helpers/owned-jvm-receiver-history.mjs";
import { assertOwnedDotnetReceiverExecution } from "./helpers/owned-dotnet-receiver-evidence.mjs";
import { ownedDotnetReceiverPath, ownedDotnetReceiverBaseline, ownedDotnetReceiverPrevious
	, ownedDotnetReceiverChangedPaths, ownedDotnetReceiverAddedPaths
	, beforeOwnedDotnetReceiver, reverseOwnedDotnetReceiverUpdate } from "./helpers/owned-dotnet-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedDotnetReceiverPath, "utf8"));

test("C# receiver evidence binds exact sources without changing historical receipts or support cells", async () => {
	const record = await read();
	assert.equal(record.acceptance, "passed"); assert.equal(record.kind, "owned-dotnet-receivers");
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedDotnetReceiverBaseline); assert.deepEqual(record.previous, ownedDotnetReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedDotnetReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedJvmReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedDotnetReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedJvmReceiver(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedDotnetReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedDotnetReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedDotnetReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedDotnetReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedDotnetReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedDotnetReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedJvmReceiver(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedDotnetReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedJvmReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-dotnet-receivers", "owned-dotnet-receiver-packaging"
		, "owned-dotnet-receiver-plain", "owned-dotnet-receiver-contract"
		, "owned-dotnet-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("C# receiver evidence requires both compiled and installed source paths", async () => {
	await assertOwnedDotnetReceiverExecution(await read());
});

test("C# receiver evidence rejects partial runs and inflated package claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].restored = false; }
		, value => { value.runtime[0].observed.memberCollections = 0; }
		, value => { value.runtime[1].observed.identities++; }
		, value => { value.runtime[0].rejectedMutations.pop(); }
		, value => { value.runtime[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].rejected.pop(); }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].observed.identities++; }
		, value => { value.plain[2].consuming = false; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[0].sourceFreeRelocatedExecution = false; }
		, value => { value.packages[0].sdkFreeExecution = false; }
		, value => { value.packages[0].packageCacheRemoved = false; }
		, value => { value.packages[0].consumerSourceRemoved = false; }
		, value => { value.packages[1].independentProducerBuild = false; }
		, value => { value.packages[0].cliBuilds.pop(); }
		, value => { value.packages[0].cliInstallation.sourceRemoved = false; }
		, value => { value.packages[0].adapterReceipt.dotnetValues.receiverExports.properties = "mutable-fields"; }
		, value => { value.packages[0].tamperRejected.pop(); }
		, value => { value.packages[0].rejectedConsumers.pop(); }
		, value => { value.packages[0].documentation.stdout = "42\n"; }
		, value => { value.packages[0].loaderRejected.pop(); }
		, value => { value.packages[0].needed[0] = "libgmp.so.10"; }
		, value => { value.packages[0].relocatedObservation.checks--; }
		, value => { value.packages[1].companions.ruby = 0; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedDotnetReceiverExecution(changed), undefined, mutate.toString());
	}
});
