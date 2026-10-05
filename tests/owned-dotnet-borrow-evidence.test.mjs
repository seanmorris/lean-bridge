/**
 * Reject fabricated C# borrow observations and preserve prior source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedJvmBorrow, ownedJvmBorrowHistoricalBytes } from "./helpers/owned-jvm-borrow-history.mjs";
import { assertOwnedDotnetBorrowExecution, assertOwnedDotnetBorrowCi } from "./helpers/owned-dotnet-borrow-evidence.mjs";
import { ownedDotnetBorrowPath, ownedDotnetBorrowBaseline, ownedDotnetBorrowPrevious
	, ownedDotnetBorrowAddedPaths, ownedDotnetBorrowChangedPaths
	, beforeOwnedDotnetBorrow, reverseOwnedDotnetBorrowUpdate } from "./helpers/owned-dotnet-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedDotnetBorrowPath, "utf8"));

test("Dotnet borrow evidence authenticates complete source changes without rewriting predecessors", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedDotnetBorrowBaseline);
	assert.deepEqual(record.previous, ownedDotnetBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedDotnetBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedJvmBorrowHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedDotnetBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedJvmBorrow(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedDotnetBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedDotnetBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedDotnetBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedDotnetBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedDotnetBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedDotnetBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedJvmBorrow(path, await readFile(path, "utf8"));
	const prior = JSON.parse(beforeOwnedDotnetBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedJvmBorrowHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	const module = "src/backends/dotnet/owned-borrows.mjs";
	const files = JSON.parse(await readFile("config/cli-package.v1.json", "utf8")).files;
	assert.deepEqual(JSON.parse(await readFile("package.json", "utf8")).files, files);
	assert.ok(files.includes(module));
	assert.ok(JSON.parse(await readFile("nix/perl-engine-source-boundary.json", "utf8")).includedFiles.includes(module));
});

test("Dotnet borrow evidence requires real Lean and installed NuGet packages on both paths", async () => {
	await assertOwnedDotnetBorrowExecution(await read());
});

test("Dotnet borrow evidence rejects missing observations, forged lifetimes and false scope", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerProjections", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.scope.rawResourceViews = "independent"; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[1].stdout = "not run"; }
		, value => { value.borrowOnly.observations[0].nativeProbeSha256 = "0".repeat(64); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observed.identities++; }
		, value => { value.runtime[1].observed.nativeAfter = 0; }
		, value => { value.runtime[1].rejectedMutations.pop(); }
		, value => { value.runtime[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].nativeProbeSha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].relocatedObservation.checks = 0; }
		, value => { value.packages[0].consumerSha256 = "0".repeat(64); }
		, value => { value.packages[1].input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.packages[0].componentReceipt.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapterReceipt.dotnetValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].manifest.ownedValues.resultAnchors.emptyValues = "discarded"; }
		, value => { value.packages[1].manifest.schemaVersion = 2; }
		, value => { value.packages[0].manifest.kind = "unverified-package"; }
		, value => { value.packages[0].manifest.bindingIrSha256 = "0".repeat(64); }
		, value => { value.packages[1].manifest.runtimeIdentity = "0".repeat(64); }
		, value => { value.packages[0].documentation.sourceSha256 = "0".repeat(64); }
		, value => { value.packages[1].tamperRejected.pop(); }
		, value => { value.packages[1].incapableReadersRejected = 0; }
		, value => { value.packages[1].rejectedConsumers.pop(); }
		, value => { value.packages[0].rejectedConsumers[0].diagnostic = "syntax error"; }
		, value => { value.packages[0].rejectedConsumers[0].source = "invalid code"; }
		, value => { value.borrowOnly.observations[1].loaderSha256 = "0".repeat(64); }
		, value => { value.runtime[0].generated["Calls.cs"] = "0".repeat(64); }
		, value => { value.packages[1].sdkFreeExecution = false; }
		, value => { value.packages[1].compiledProjection.schemaVersion = 2; }
		, value => { value.packages[0].documentation.stderr = "failed"; }
		, value => { value.packages[1].adapterReceipt.gmp.binding = "global-symbols"; }
		, value => { value.packages[1].companions.rust = 0; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedDotnetBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("Dotnet borrow CI requires seven enabled tests and all runtime and package reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedDotnetBorrowCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-dotnet-borrows > build/owned-dotnet-borrows.log 2>&1"
		, "          rg '^# pass 7$' build/owned-dotnet-borrows.log"
		, "          rg '^# fail 0$' build/owned-dotnet-borrows.log"
		, "          rg '^# skipped 0$' build/owned-dotnet-borrows.log"
		, "          test -s build/owned-dotnet-borrows/ordinary.json"
		, "          test -s build/owned-dotnet-borrows/reviewed.json"
		, "          test -s build/owned-dotnet-borrows/borrow-only.json"
		, "          test -s build/owned-dotnet-borrow-packaging/ordinary.json"
		, "          test -s build/owned-dotnet-borrow-packaging/reviewed.json"
		, "            build/owned-dotnet-borrows/"
		, "            build/owned-dotnet-borrow-packaging/"
		, "            build/owned-dotnet-borrows.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedDotnetBorrowCi(workflow.replace(line + "\n", ""), manifest));
	}
	const key = "test:owned-dotnet-borrows";
	assert.throws(() => assertOwnedDotnetBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
