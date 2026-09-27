/**
 * Bind process-origin hardening to installed execution and exact predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { verifiedDotnetAssets } from "../../src/backends/dotnet/verified-assets.mjs";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { dotnetStructuredRegressionFixtures } from "./dotnet-structured-callable-regression.mjs";
import { ownedDotnetColdProject } from "./owned-dotnet-cold.mjs";
import { assertOwnedDotnetReports, assertOwnedDotnetIntegration } from "./owned-dotnet-evidence.mjs";
import { ownedDotnetHistoryPath, ownedDotnetExecutionPath } from "./owned-dotnet-source-history.mjs";
import { ownedDotnetProcessBaseline, ownedDotnetProcessChangedPaths, ownedDotnetProcessAddedPaths, reverseOwnedDotnetProcess } from "./owned-dotnet-process-history.mjs";
import { beforeNativeForkRepair, nativeForkRepairHistoricalBytes } from "./native-fork-repair-history.mjs";

export const ownedDotnetProcessCommands = {
	admission: "node --test --test-name-pattern='unsupported native targets' tests/owned-c-packaging.test.mjs"
	, packages: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-dotnet-packaging.test.mjs"
	, coexistence: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-dotnet-coexistence.test.mjs"
	, regressions: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_DOTNET_CALLABLE_TEST=1 LEAN_BRIDGE_DOTNET_STRUCTURED_CALLABLE_TEST=1 LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/dotnet-callables.test.mjs tests/dotnet-structured-callables.test.mjs tests/dotnet-recursive-callables.test.mjs"
};
export const ownedDotnetProcessScope = {
	installedParentProfiles: ["owned", "copied", "plain"]
	, coldLoader: "exact-common-loader-with-observable-initializer"
	, defaultClrProtections: true, inheritedRegistryLock: true
	, counterfactual: "child-pid-adoption", generalClrForkSupport: false
	, installedNuget: true, sdkFreeExecution: true, relocated: true
	, transferredInputs: false, anchoredResults: false
	, wasm: false, promotedCells: 0
};
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);

/**
 * Regenerate every old C# file affected by the process-origin change.
 */
export const ownedDotnetProcessGeneratedSources = async () => {
	const result = new Map();
	const append = (model, evidence, previous) => {
		for(const [path, source] of Object.entries(generateOwnedDotnetPackage(model.bindingIr, evidence).files))
		{
			const currentSha256 = sha256(source), previousSha256 = previous[path];
			if(currentSha256 === previousSha256) continue;
			const key = `${path}:${currentSha256}:${previousSha256}`;
			result.set(key, { path, source, currentSha256, previousSha256 });
		}
	};
	const execution = await json(ownedDotnetExecutionPath);
	for(const group of [execution.packages, execution.scalarPackages]) for(const report of Object.values(group))
		append(createCompiledNativeModel(report.input, { ownedGraphs: true, ownedHostCallbacks: true })
			, report.compiledProjection.evidence
			, Object.fromEntries(Object.entries(report.compiledProjection.files).map(([path, item]) => [path, item.sha256])));
	const loading = await json("docs/evidence/owned-dotnet-loading-20260927.json");
	const foundation = await json(loading.foundation.path);
	for(const entry of loading.reports)
	{
		const reviewed = entry.path.endsWith("reviewed.json");
		const input = foundation.compilerInputs.find(item => item.path === `build/owned-aggregate-native/owned-cpp-composition${reviewed ? "-reviewed" : ""}-callbacks-inputs.json`).input;
		append(generateOwnedAggregateCarriers({ ...input, hostCallbacks: true }).model, entry.report.evidence, entry.report.generatedFiles);
	}
	const copied = await json("docs/evidence/dotnet-structured-codegen-regression-20260924.json");
	for(const fixture of copied.fixtures)
	{
		for(const [path, source] of Object.entries(generateCopiedDotnetPackage(dotnetStructuredRegressionFixtures[fixture.name]())))
		{
			const currentSha256 = sha256(source), previousSha256 = fixture.files[path].sha256;
			if(currentSha256 !== previousSha256)
				result.set(`${path}:${currentSha256}:${previousSha256}`, { path, source, currentSha256, previousSha256 });
		}
	}
	return [...result.values()].sort((a, b) => `${a.path}:${a.currentSha256}`.localeCompare(`${b.path}:${b.currentSha256}`));
};

/**
 * Validate generated cold probes, actual installed origins and broken guards.
 *
 * @param cold - Compiled exact-loader and counterfactual observations.
 * @param peers - Authenticated peer manifests and installed execution reports.
 */
const coldExecution = async (cold, peers) => {
	const members = verifiedDotnetAssets(cold.evidence);
	assert.equal(cold.membersSha256, sha256(members));
	assert.equal(cold.sourceSha256, sha256(await readFile("tests/fixtures/structured-types/owned-dotnet-cold.cs")));
	assert.equal(cold.nativeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-dotnet-cold.c")));
	const peer = peers.manifests.find(item => item.name === "owned-peer"); assert.ok(peer);
	assert.equal(sha256(canonicalJson(cold.compiled)), cold.compiledSha256);
	assert.deepEqual(cold.compiled.evidence, cold.evidence);
	assert.equal(cold.compiledSha256, peer.compiledProjectionSha256);
	assert.equal(peer.files["lean-bridge/native-dotnet.json"].sha256, cold.compiledSha256);
	assert.equal(cold.evidence.componentId, peer.component.id);
	assert.equal(cold.evidence.runtimeIdentity, peer.runtimeIdentity);
	for(const [name, hash] of Object.entries(cold.evidence.libraries))
		assert.equal(peer.files[`runtimes/linux-x64/native/${name}`].sha256, hash);
	assert.equal(cold.variants.length, 2);
	for(const [index, variant] of cold.variants.entries())
	{
		assert.equal(variant.counterfactual, index === 1);
		assert.equal(variant.assembly, index === 1 ? "ColdCounter" : "ColdGuard");
		const needle = "global::System.AppDomain.CurrentDomain.GetData(ProcessKey) is int original ? original : CurrentProcess()";
		assert.equal(members.split(needle).length, 2);
		const loader = index === 1 ? members.replace(needle, "CurrentProcess()") : members;
		const generated = `internal static class ColdAssets\n{\n    static ColdAssets() { ColdState.Initialized = true; }\n${loader}}\n`;
		assert.equal(variant.loaderSha256, sha256(generated));
		digest(variant.assemblySha256);
		assert.equal(variant.projectSha256, sha256(ownedDotnetColdProject(peers.inputs.map(item => item.receipt.packages[0]), variant.assembly)));
		assert.deepEqual(Object.keys(variant.files).sort(), ["deps.json", "dll", "runtimeconfig.json"].map(extension => `${variant.assembly}.${extension}`));
		for(const file of Object.values(variant.files))
		{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0); }
		assert.equal(variant.files[`${variant.assembly}.dll`].sha256, variant.assemblySha256);
	}
	assert.notEqual(cold.variants[0].assemblySha256, cold.variants[1].assemblySha256);
	assert.deepEqual(cold.observations, ["owned", "copied", "plain"].flatMap(origin => [false, true].map(counterfactual => ({
		origin, kind: counterfactual ? 1 : 0, installedOrigin: true
		, coldInParent: true, registryLockHeld: true, defaultClrProtections: true
		, counterfactual, childExit: counterfactual ? 1 : 0, exitCode: 0
	}))));
};

/**
 * Require current execution, whole-file history and unchanged original receipts.
 *
 * @param record - Frozen process-origin hardening receipt.
 * @param replay - Also replay the full predecessor evidence chain.
 */
export const assertOwnedDotnetProcess = async (record, replay = true) => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-dotnet-process-origin");
	assert.equal(record.baselineRevision, ownedDotnetProcessBaseline);
	assert.deepEqual(record.scope, ownedDotnetProcessScope);
	assert.deepEqual(record.previous, { path: ownedDotnetHistoryPath
		, sha256: "52dc2f3af8b26b10be3b4a01121b689d5c0a6cfa893c923fb6597564162eafcf" });
	assert.equal(sha256(await readFile(record.previous.path)), record.previous.sha256);
	assert.equal(sha256(await readFile(ownedDotnetExecutionPath)), "3373f92cd65e9518eabe39f880e6a6db87ebcd5ccfabec2c957c4ad79c5e1382");
	const previous = await json(record.previous.path);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedDotnetProcessChangedPaths, ...ownedDotnetProcessAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sources).sort(), paths);
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedDotnetProcessChangedPaths);
	const updates = new Map(record.updates.map(item => [item.path, item]));
	for(const path of paths)
	{
		const bytes = nativeForkRepairHistoricalBytes(path, await readFile(path), record.sources[path]);
		assert.equal(sha256(bytes), record.sources[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.previousSha256, previous.sourceHashes[path]);
			assert.equal(sha256(reverseOwnedDotnetProcess(bytes.toString("utf8"), update)), previous.sourceHashes[path], path);
		}
		else if(previous.sourceHashes[path]) assert.equal(record.sources[path], previous.sourceHashes[path], path);
	}
	const generated = await ownedDotnetProcessGeneratedSources();
	assert.equal(record.generatedUpdates.length, generated.length);
	for(const [index, item] of generated.entries())
	{
		const update = record.generatedUpdates[index];
		assert.equal(update.path, item.path); assert.equal(update.previousSha256, item.previousSha256);
		assert.equal(sha256(reverseOwnedDotnetProcess(item.source, update)), item.previousSha256);
	}
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedDotnetProcessCommands).sort());
	for(const [name, count] of Object.entries({ admission: 1, packages: 4, coexistence: 1, regressions: 3 }))
	{
		const run = record.runs[name];
		assert.equal(run.command, ownedDotnetProcessCommands[name]); assert.equal(run.exitCode, 0);
		assert.equal(run.sha256, sha256(run.text));
		for(const [key, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
			assert.match(run.text, new RegExp(`^# ${key} ${value}$`, "mu"));
		assert.doesNotMatch(run.text, /^not ok/mu);
	}
	await coldExecution(record.coexistence.coldLoading, record.coexistence);
	await assertOwnedDotnetReports(record);
	assert.equal(record.inventory.promoted, 0);
	assert.deepEqual(record.inventory, previous.inventory);
	const { document, ...contracts } = await readTypeSurface();
	const inventory = beforeNativeForkRepair("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), record.sources["docs/type-surface.v1.json"]);
	const old = JSON.parse(reverseOwnedDotnetProcess(inventory, updates.get("docs/type-surface.v1.json")));
	const expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(JSON.parse(inventory), expected);
	assert.deepEqual(typeSurfaceCells(document, contracts), typeSurfaceCells(old, contracts));
	if(replay) await assertOwnedDotnetIntegration(previous);
};
