/**
 * Bind C# concurrent-read and receiver-GC repairs to installed package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { assertOwnedDotnetBorrowExecution, assertOwnedDotnetBorrowCi } from "./helpers/owned-dotnet-borrow-evidence.mjs";
import { beforeOwnedDotnetReadRaceGenerated } from "./helpers/owned-dotnet-read-race-generated.mjs";
import { ownedDotnetLifetimePath, ownedDotnetLifetimeBaseline
	, ownedDotnetLifetimePrevious, ownedDotnetLifetimeChangedPaths
	, ownedDotnetLifetimeAddedPaths, beforeOwnedDotnetLifetime
	, reverseOwnedDotnetLifetimeUpdate } from "./helpers/owned-dotnet-lifetime-history.mjs";

const read = async () => JSON.parse(await readFile(ownedDotnetLifetimePath, "utf8"));

test("C# lifetime repair authenticates exact source transitions without rewriting predecessors", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-lifetime-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedDotnetLifetimeBaseline);
	assert.deepEqual(record.previous, ownedDotnetLifetimePrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedDotnetLifetimeAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedDotnetLifetimeChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedDotnetLifetime(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedDotnetLifetime(update.path, prior), prior);
		assert.equal(beforeOwnedDotnetLifetime(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedDotnetLifetime(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedDotnetLifetimeUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedDotnetLifetimeUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedDotnetLifetime(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	assert.equal(classifyRepositoryTest("tests/owned-dotnet-lifetime-evidence.test.mjs"), "contract");
});

test("C# lifetime repair requires optimized runtime checks and original installed NuGet archives", async () => {
	const record = await read();
	assert.equal(record.kind, "owned-dotnet-lifetime-repair");
	await assertOwnedDotnetBorrowExecution(record);
	assertOwnedDotnetBorrowCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json")));
});

test("C# lifetime repair rejects unexecuted races, forged artifacts and false scope", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.kind = "owned-dotnet-borrows"; }
		, value => { value.scope.atomicWholeRead = false; }
		, value => { value.scope.optimizedReceiverGc = false; }
		, ...["receiverAnchors", "callbackResultAnchors", "independentRebuild", "docker"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observed.receiverCollections--; }
		, value => { value.runtime[1].observed.identities++; }
		, value => { value.runtime[1].observed.managedAfter = 61; }
		, value => { value.runtime[0].rejectedMutations.pop(); }
		, value => { value.runtime[1].rejectedMutations.splice(4, 1); }
		, value => { value.runtime[0].rejectedMutations[4].compiled = false; }
		, value => { value.runtime[0].optimizedProject = value.runtime[0].optimizedProject.replace("<Optimize>true", "<Optimize>false"); value.runtime[0].optimizedProjectSha256 = sha256(value.runtime[0].optimizedProject); }
		, value => { value.runtime[1].optimizedProjectSha256 = "0".repeat(64); }
		, value => { value.runtime[0].generated["Values.cs"] = "0".repeat(64); }
		, value => { value.runtime[1].generated["Lifetime.cs"] = "0".repeat(64); }
		, value => { value.runtime[0].probeSha256 = "0".repeat(64); }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[1].stdout = "not run"; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].sdkFreeExecution = false; }
		, value => { value.packages[0].relocatedObservation.checks = 0; }
		, value => { value.packages[1].manifest.ownedValues.runtimeSha256 = "0".repeat(64); }
		, value => { value.packages[0].manifest.ownedValues.valuesSha256 = "0".repeat(64); }
		, value => { value.packages[0].documentation.stdout = "not run"; }
		, value => { value.packages[1].companions.python = 0; }
		, value => { value.packages[1].tamperRejected.pop(); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedDotnetBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("C# predecessor source reconstruction rejects unknown generated edits", async () => {
	const bytes = await readFile("docs/evidence/owned-dotnet-borrows-20260930.json");
	assert.equal(sha256(bytes), "6ea35c6fb18d4d1b0d204186a28635b7a10aa9fd7e2c79a767b0f80dd6295bfe");
	const record = JSON.parse(bytes);
	await assertOwnedDotnetBorrowExecution(record);
	for(const item of record.runtime)
	{
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true
			, ownedHostCallbacks: true, ownedInputTransfers: true
			, ownedAnchoredResults: true });
		const generated = generateOwnedDotnetCalls(model.bindingIr, { transferredInputs: true, anchoredResults: true });
		for(const path of ["Values.cs", "Lifetime.cs"])
		{
			const source = generated.files[path], expected = item.generated[path];
			assert.notEqual(sha256(source), expected);
			const prior = beforeOwnedDotnetReadRaceGenerated(source, expected);
			assert.equal(sha256(prior), expected);
			assert.equal(beforeOwnedDotnetReadRaceGenerated(prior, expected), prior);
			assert.equal(beforeOwnedDotnetReadRaceGenerated(source, "0".repeat(64)), source);
			const unknown = source + "\n/* unrecorded generated edit */\n";
			assert.equal(beforeOwnedDotnetReadRaceGenerated(unknown, expected), unknown);
		}
	}
});
