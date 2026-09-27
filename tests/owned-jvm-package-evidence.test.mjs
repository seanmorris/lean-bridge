/**
 * Reject forged owned JVM package, execution and predecessor-history claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeJvmProbeRepair, jvmProbeRepairBaseline, jvmProbeRepairBytes, jvmProbeRepairChangedPaths, jvmProbeRepairPath } from "./helpers/jvm-probe-repair-history.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { jvmStructuredRegressionFixtures } from "./helpers/jvm-structured-callable-regression.mjs";
import { assertOwnedJvmGeneratedHistory, assertOwnedJvmPackageExecution, assertOwnedJvmPackageIntegration } from "./helpers/owned-jvm-package-evidence.mjs";
import { beforeOwnedJvmPackages, beforeOwnedJvmGenerated, ownedJvmHistoricalBytes, ownedJvmHistoryPath, ownedJvmExecutionPath, reverseOwnedJvmUpdate } from "./helpers/owned-jvm-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive JVM probe repair preserves every published predecessor and rejects source drift", async () => {
	const record = await json(jvmProbeRepairPath), previous = await json(ownedJvmHistoryPath);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "jvm-recursive-probe-repair");
	assert.equal(record.baselineRevision, jvmProbeRepairBaseline);
	assert.equal(record.previous.path, ownedJvmHistoryPath);
	assert.equal(sha256(await readFile(record.previous.path)), record.previous.sha256);
	assert.equal(record.productionCodeChanged, false); assert.equal(record.promotedCells, 0);
	assert.equal(record.failure.reproduced, true);
	assert.equal(record.acceptance.status, "passed");
	assert.equal(record.acceptance.command, "LEAN_BRIDGE_JVM_RECURSIVE_CALLABLE_TEST=1 node --test --test-name-pattern='original recursive Maven' tests/jvm-recursive-callables.test.mjs");
	assert.equal(sha256(record.acceptance.output), record.acceptance.outputSha256);
	for(const line of ["# tests 1", "# pass 1", "# fail 0", "# skipped 0"])
		assert.ok(record.acceptance.output.split("\n").includes(line), line);
	assert.deepEqual(record.updates.map(update => update.path).sort(), jvmProbeRepairChangedPaths);
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(await readFile(path)), hash, path);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256);
		assert.equal(update.previousSha256, previous.sources[update.path]);
		const old = beforeJvmProbeRepair(update.path, current);
		assert.equal(sha256(old), update.previousSha256);
		assert.equal(beforeJvmProbeRepair(update.path, old), old);
		assert.equal(beforeJvmProbeRepair(update.path, current, update.currentSha256), current);
		const drift = current + "\nunknown repair drift\n";
		assert.equal(beforeJvmProbeRepair(update.path, drift), drift);
		assert.notEqual(sha256(drift), record.sources[update.path]);
	}
	const probe = await readFile("tests/helpers/jvm-recursive-callable-probes.mjs", "utf8");
	assert.match(probe, /GraphFaultProbe\.symbols=_CallableGraphNative\.fixtureSymbols\(\)/u);
	assert.match(probe, /fixtureSymbols\(\) \{ return _Assets\.lookup\(\); \}/u);
	assert.doesNotMatch(probe, /Path\.of\(System\.getProperty/u);
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(jvmProbeRepairBytes("unrelated.bin", binary), binary);
});

test("owned JVM packages retain exact installed acceptance and immutable predecessors", async () => {
	await assertOwnedJvmPackageIntegration(await json(ownedJvmHistoryPath));
});

test("owned JVM evidence rejects widened scope and forged package or execution claims", async () => {
	const original = await json(ownedJvmExecutionPath);
	for(const change of [
		record => { record.scope.wasm = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.generalJvmForkSupport = true; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { delete record.sources["src/backends/jvm/verified-assets.mjs"]; }
		, record => { record.runs.packages.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.documentation.text += "\nchanged\n"; }
		, record => { record.packages["callbacks-ordinary"].sourceRemovedBeforeInstallation = false; }
		, record => { record.packages["callbacks-ordinary"].cliBuild.result.bindingIrSha256 = "0".repeat(64); }
		, record => { record.packages["callbacks-reviewed"].cliBuild.result.packages[0].sha256 = "0".repeat(64); }
		, record => { record.packages["callbacks-reviewed"].compiledProjection.ownedValues.guardSha256 = "0".repeat(64); }
		, record => { record.packages["callbacks-ordinary"].adapterReceipt.gmp.binding = "global-symbols"; }
		, record => { record.packages["callbacks-ordinary"].tamperRejections.pop(); }
		, record => { record.packages["scalars-reviewed"].observations[1].checks--; }
		, record => { record.packages["scalars-ordinary"].compiledProjection.kotlin.options.pop(); }
		, record => { record.packages["callbacks-ordinary"].observations[0].jvm.inspection.scenarios.pop(); }
		, record => { record.packages["callbacks-ordinary"].observations[0].jvm.inspection.scenarios[0].noAdditionalNativeMappings = false; }
		, record => { record.packages["callbacks-ordinary"].observations[0].jvm.inspection.probeSha256 = "0".repeat(64); }
		, record => { record.packages["callbacks-reviewed"].observations[0].jvm.documentation[0].stdout = "wrong\n"; }
		, record => { record.documentation.observations[0].jvm.documentation[0].sourceSha256 = "0".repeat(64); }
		, record => { record.documentation.sourceHashes.lean = "0".repeat(64); }
		, record => { record.coexistence.foreignResourceRejections.pop(); }
		, record => { record.coexistence.scenarios[0].mappings["libleanshared.so"] = "0".repeat(64); }
		, record => { record.coexistence.scenarios[0].concurrentIterations--; }
		, record => { record.copied.packages.observations[0].jvm.offline = false; }
		, record => { record.ci.requiredReports--; }
		, record => { record.nativeCi.profiles.pop(); }
		, record => { record.runs.ci.exitCode = 1; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedJvmPackageExecution(changed, false), change.toString());
	}
});

test("owned JVM source history reverses exact edits and preserves unknown bytes", async () => {
	for(const update of (await json(ownedJvmHistoryPath)).updates)
	{
		const latest = await readFile(update.path, "utf8");
		const current = beforeJvmProbeRepair(update.path, latest);
		assert.equal(sha256(reverseOwnedJvmUpdate(current, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedJvmPackages(update.path, latest)), update.previousSha256);
		assert.equal(beforeOwnedJvmPackages(update.path, latest, update.currentSha256), current);
		assert.equal(sha256(ownedJvmHistoricalBytes(update.path, Buffer.from(current), update.previousSha256)), update.previousSha256);
		const unknown = current + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedJvmPackages(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJvmUpdate(unknown, update));
		assert.throws(() => reverseOwnedJvmUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedJvmUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const bytes = Buffer.from([0xff, 0xfe, 0, 0x80]);
	assert.equal(ownedJvmHistoricalBytes("unrecorded.bin", bytes), bytes);
});

test("owned JVM generated history retains old APIs and rejects unrecorded changes", async () => {
	const record = await json(ownedJvmHistoryPath);
	const files = Object.assign({}, ...Object.values(jvmStructuredRegressionFixtures)
		.map(fixture => generateCopiedJvmKotlinPackage(fixture())));
	const ir = jvmStructuredRegressionFixtures.collections();
	for(const key of ["declarations", "types"]) ir[key].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const sorted = generateCopiedJvmKotlinPackage(ir);
	for(const [updates, sources] of [[record.generatedUpdates, files], [record.generatedSortedUpdates, sorted]])
	for(const update of updates)
	{
		const source = sources[update.path];
		assert.equal(sha256(beforeOwnedJvmGenerated(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedJvmGenerated(update.path, changed, update.previousSha256), changed);
		assert.equal(beforeOwnedJvmGenerated(update.path, source, "0".repeat(64)), source);
		assert.throws(() => reverseOwnedJvmUpdate(changed, update));
	}
});

test("owned JVM generated history rejects missing or exchanged source-order identities", async () => {
	const original = await json(ownedJvmHistoryPath);
	await assertOwnedJvmGeneratedHistory(original);
	for(const change of [
		record => { record.generatedSortedUpdates.pop(); }
		, record => { record.generatedSortedUpdates.push(record.generatedSortedUpdates[0]); }
		, record => { record.generatedSortedPrevious.sha256 = "0".repeat(64); }
		, record => { record.generatedSortedUpdates[0].currentSha256 = "0".repeat(64); }
		, record => { record.generatedSortedUpdates[0].previousSha256 = "0".repeat(64); }
		, record => { record.generatedSortedUpdates[0].edits[0].previous = "unrecorded"; }
		, record => { record.generatedSortedUpdates[0] = record.generatedUpdates.find(item => item.path === record.generatedSortedUpdates[0].path); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedJvmGeneratedHistory(changed), change.toString());
	}
});
