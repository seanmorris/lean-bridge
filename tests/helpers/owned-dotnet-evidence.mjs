/**
 * Authenticate installed ownership-aware C# packages and exact source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import { historicalTypeSurfaceCells as typeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { gmpIdentity } from "../../src/backends/c/gmp.mjs";
import { assertDotnetRecursiveProbes } from "./dotnet-recursive-callable-faults.mjs";
import { assertDotnetStructuredFaults } from "./dotnet-structured-callable-faults.mjs";
import { ownedRubyExecutionSources, assertOwnedRubyIntegration } from "./owned-ruby-evidence.mjs";
import { ownedRubyHistoryPath } from "./owned-ruby-source-history.mjs";
import { ownedDotnetBaseline, ownedDotnetChangedPaths, ownedDotnetAddedPaths, ownedDotnetExecutionPath, reverseOwnedDotnetUpdate } from "./owned-dotnet-source-history.mjs";
import { beforeOwnedDotnetProcess, beforeOwnedDotnetProcessGenerated, ownedDotnetProcessHistoricalBytes } from "./owned-dotnet-process-history.mjs";

export const ownedDotnetScope = { profiles: ["nuget"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: true, hostCallbackLifetime: "call"
	, higherOrderCallbacks: true, boxedRecursion: true, primitives: 19
	, safePublicApi: true, defaultClrProtections: true
	, transferredInputs: false, anchoredResults: false
	, wasm: false, promotedCells: 0 };
export const ownedDotnetCommands = {
	packages: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-dotnet-packaging.test.mjs"
	, coexistence: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-dotnet-coexistence.test.mjs"
	, recursive: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST=1 node --test tests/dotnet-recursive-callables.test.mjs"
	, callbacks: "LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet LEAN_BRIDGE_DOTNET_CALLABLE_TEST=1 LEAN_BRIDGE_DOTNET_STRUCTURED_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/dotnet-callables.test.mjs tests/dotnet-structured-callables.test.mjs"
};
export const ownedDotnetExecutionSources = [...new Set([
	...ownedRubyExecutionSources
	, ...ownedDotnetAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, ...ownedDotnetChangedPaths.filter(path => path.startsWith("src/"))
	, ...["runtime", "layout", "values", "conversions", "callables", "callback-signatures", "package", "packaging", "coexistence"].map(name => `tests/owned-dotnet-${name}.test.mjs`)
	, "tests/helpers/owned-dotnet-installed.mjs"
	, "tests/helpers/owned-dotnet-callback-fixture.mjs"
	, "tests/helpers/owned-dotnet-native.mjs"
	, ...["callables", "structured-callables", "recursive-callables", "graph-package"].map(name => `tests/dotnet-${name}.test.mjs`)
	, ...["acceptance", "consumer", "docs", "faults", "mixed", "ownership", "probes", "types"].map(name => `tests/helpers/dotnet-recursive-callable-${name}.mjs`)
	, "tests/helpers/dotnet-structured-callable-install.mjs"
	, "tests/helpers/dotnet-structured-callable-faults.mjs"
	, "tests/helpers/dotnet-callable-install.mjs"
	, "tests/helpers/dotnet-callable-fixture.mjs"
	, ...["dotnet", "dotnet-values", "dotnet-faults", "dotnet-recursive", "dotnet-recursive-faults", "dotnet-recursive-installed"].map(name => `tests/fixtures/structured-callable-consumers/${name}.cs`)
	, "docs/consume/dotnet.md", "docs/publish/nuget.md"
])].sort();
const json = async path => JSON.parse(await readFile(path, "utf8"));
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const files = value => {
	assert.ok(Object.keys(value).length > 0);
	for(const file of Object.values(value))
	{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
};
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
	assert.doesNotMatch(run.text, /^not ok/mu);
};

/**
 * Reconstruct every generated API and native source from its recorded compiler input.
 *
 * @param report - Original compilation, archive and offline-installation report.
 * @param mode - Ordinary source or independently reviewed IR.
 * @param scalar - Whether this case exercises the all-primitive record.
 * @param sources - Whole source identities from the execution record.
 */
export const assertOwnedDotnetPackageReport = async (report, mode, scalar, sources) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219); assert.equal(report.mode, mode);
	for(const flag of ["compiledLean", "installedNuget", "sourceUnchanged"
		, "sourceFreeInstallation", "sourceFreeRelocatedExecution", "handoffRemoved"
		, "packageCacheRemoved", "sdkFreeExecution", "consumerSourceRemoved"
		, "deterministicReassembly", "safePublicApi"])
		assert.equal(report[flag], true, flag);
	const { input, componentReceipt: component, adapterReceipt: adapter, compiledProjection: compiled, manifest, packageSetReceipt: receipt } = report;
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sources["src/analyze/NativeExports.lean"]);
	assert.equal(input.sourceIdentity.modules[0].source.sha256, sources[`tests/fixtures/onboarding/${scalar ? "owned-scalars" : "owned-dotnet-callables"}/Owned.lean`]);
	const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true });
	const native = generateCompiledNativeLeanAdapters(model), c = generateOwnedCPackage({ ...input, hostCallbacks: true });
	const dotnet = generateOwnedDotnetPackage(model.bindingIr);
	assert.equal(model.schemaVersion, 7); assert.equal(model.exports.length, scalar ? 8 : 51);
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.metadataSha256, sha256(canonicalJson(input.metadata)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, input.sourceIdentity);
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(adapter.schemaVersion, 1); assert.equal(adapter.profile, "native-library-v1");
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.library, `lib${c.values.prefix}_dotnet.so`);
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 2
		, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source)
		, hostCallbacks: model.ownedGraph.hostCallbacks });
	assert.deepEqual(adapter.dotnetValues, dotnet.contract);
	const gmp = "libgmp-lean-bridge.so.10";
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: gmp, binding: "local-symbols" });
	const nativeSources = ownedDotnetAdapterSources(c, dotnet);
	for(const [path, text] of Object.entries(nativeSources)) assert.deepEqual(adapter.files[path], identity(text), path);
	const gmpFiles = ["include/gmp.h", `lib/${gmp}`, "share/lean-bridge/gmp.json"
		, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	assert.deepEqual(Object.keys(adapter.files).sort(), [...Object.keys(nativeSources), `lib/${adapter.library}`, ...gmpFiles.map(path => `gmp/${path}`)].sort());
	assert.equal(adapter.files["gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"].sha256, gmpIdentity.sha256);
	files(adapter.files); files(compiled.files); files(manifest.files);
	const libraries = Object.fromEntries(Object.entries(manifest.files).filter(([path]) => path.startsWith("runtimes/linux-x64/native/"))
		.map(([path, file]) => [path.split("/").at(-1), file.sha256]));
	assert.deepEqual(Object.keys(libraries).sort(), [adapter.library, component.library, gmp, "libleanshared.so", "liblean_bridge_native.so"].sort());
	assert.equal(libraries[adapter.library], adapter.files[`lib/${adapter.library}`].sha256);
	assert.equal(libraries[component.library], component.nativeLibrary.sha256);
	assert.equal(libraries[gmp], adapter.files[`gmp/lib/${gmp}`].sha256);
	const evidence = { runtimeIdentity: component.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, ownedValues: dotnet.contract, library: adapter.library, libraries };
	assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, dotnet.contract);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256); assert.equal(compiled.assembly, dotnet.assembly);
	assert.match(compiled.sdk, /^8\.0\.\d+$/u);
	const generated = generateOwnedDotnetPackage(model.bindingIr, evidence);
	for(const [path, text] of Object.entries(generated.files))
	{
		const original = beforeOwnedDotnetProcessGenerated(path, text, compiled.files[path].sha256);
		assert.deepEqual(compiled.files[path], identity(original), path);
		if(path.startsWith("src/") || path === "binding-manifest.json") assert.deepEqual(manifest.files[`lean-bridge/dotnet/${path}`], identity(original), path);
	}
	assert.deepEqual(compiled.files["global.json"], identity(canonicalJson({ sdk: { version: compiled.sdk, rollForward: "disable", allowPrerelease: false } })));
	for(const extension of ["dll", "xml"])
		assert.deepEqual(manifest.files[`lib/net8.0/${dotnet.assembly}.${extension}`], compiled.files[`lib/net8.0/${dotnet.assembly}.${extension}`]);
	for(const [path, file] of Object.entries(adapter.files).filter(([path]) => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")))
		assert.deepEqual(manifest.files[`lean-bridge/adapter/${path}`], file, path);
	for(const [path, text] of Object.entries({ "native-component.json": canonicalJson(component)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "generated.lean": native.leanSource
		, "component.h": native.header, "callbacks.c": native.callbackSource }))
		assert.deepEqual(manifest.files[`lean-bridge/component/${path}`], identity(text), path);
	assert.deepEqual(manifest.files["lean-bridge/native-dotnet-adapter.json"], identity(canonicalJson(adapter)));
	assert.deepEqual(manifest.files["lean-bridge/native-dotnet.json"], identity(canonicalJson(compiled)));
	assert.equal(manifest.files["lean-bridge/runtime.json"].sha256, component.runtimeIdentity);
	assert.equal(manifest.kind, "lean-bridge-owned-nuget-package"); assert.equal(manifest.ecosystem, "nuget");
	assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.name, "Owned.Values"); assert.equal(manifest.version, "1.2.3");
	assert.deepEqual(manifest.component, model.component); assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256); assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
	assert.equal(manifest.namespace, dotnet.namespace); assert.equal(manifest.assembly, dotnet.assembly);
	assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled))); assert.deepEqual(manifest.ownedValues, dotnet.contract);
	assert.deepEqual(report.observation, scalar ? { checks: 255, primitives: 19, safePublicApi: true }
		: { checks: 630, calls: 20, primitives: 19, safePublicApi: true });
	assert.deepEqual(report.tamperRejected, ["lifetime", "source", "guard", "gmp-receipt", "gmp-source", "library", "unrecorded", "managed-source"]);
	const rejections = ["resource constructor", "raw handle", "sealed resource"
		, ...scalar ? ["typed scalar record"]
			: ["resource field", "immutable record", "typed option", "typed callback", "typed higher-order input", "async callback", "transparent alias", "closed variant"]];
	assert.deepEqual(report.rejectedConsumers.map(item => item.name), rejections);
	for(const rejected of report.rejectedConsumers)
	{ assert.ok(rejected.source.includes(`using ${dotnet.namespace};`)); assert.match(rejected.diagnostic, /^CS\d+(?:\|CS\d+)*$/u); }
	const original = await readFile(`tests/fixtures/structured-types/${scalar ? "owned-installed-dotnet-scalars" : "owned-dotnet-callback-signatures"}.cs`, "utf8");
	assert.equal(report.originalProbeSha256, sha256(original)); digest(report.consumerSha256);
	assert.equal(report.compositionsSha256, sha256(scalar ? "" : await readFile("tests/fixtures/structured-types/owned-installed-dotnet.cs")));
	if(scalar)
	{ assert.equal(report.consumerSha256, sha256(original)); assert.equal(report.documentation, null); }
	else
	{
		const marker = "    private static unsafe void Main(string[] args)";
		assert.equal(original.split(marker).length, 2);
		const consumer = original.slice(0, original.indexOf(marker))
			.replace("using LeanBridge.OwnedAggregates.Interop;\n", "") + `    private static void Main()
    {
        Exception? failure = null;
        var thread = new Thread(() => {
            try { for (int i = 0; i < 3; i++) { calls = 0; Primitives(); HigherOrder(); checks += InstalledCompositions.Run(); } }
            catch (Exception error) { failure = error; }
        });
        thread.Start(); thread.Join();
        if (failure is not null) throw new Exception("Installed C# API failed", failure);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, calls, primitives = 19, safePublicApi = true }));
    }
}
`;
		assert.equal(report.consumerSha256, sha256(consumer));
		const example = (await readFile("docs/consume/dotnet.md", "utf8")).split("### Resource-containing values\n")[1].split("```csharp\n")[1].split("\n```")[0] + "\n";
		assert.deepEqual(report.documentation, { sourceSha256: sha256(example), code: 0, stdout: `${1n << 200n}\n${1n << 200n}\n`, stderr: "" });
	}
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
	assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	assert.equal(receipt.packages.length, 1); const pkg = receipt.packages[0];
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.name, "Owned.Values"); assert.equal(pkg.version, "1.2.3");
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].path, "archives/Owned.Values.1.2.3.nupkg");
	assert.ok(pkg.artifacts[0].bytes > 1_000_000); digest(pkg.artifacts[0].sha256);
};

/**
 * Require real package installs, callback regressions and all peer load orders.
 *
 * @param record - Immutable logs, compiler inputs, package receipts and reports.
 */
export const assertOwnedDotnetExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-dotnet-execution"); assert.equal(record.baselineRevision, ownedDotnetBaseline);
	assert.deepEqual(record.scope, ownedDotnetScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedDotnetCommands).sort());
	for(const [name, count] of Object.entries({ packages: 4, coexistence: 1, recursive: 1, callbacks: 2 })) passing(record.runs[name], ownedDotnetCommands[name], count);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedDotnetExecutionSources);
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedDotnetProcessHistoricalBytes(path, await readFile(path), hash)), hash, path);
	const references = ["foundation", "callbacks", "loading"].map(name => `docs/evidence/owned-dotnet-${name}-20260927.json`);
	assert.deepEqual(record.references.map(item => item.path), references);
	for(const reference of record.references) assert.deepEqual({ bytes: reference.bytes, sha256: reference.sha256 }, identity(await readFile(reference.path)));
	await assertOwnedDotnetReports(record);
};

/**
 * Check complete installed reports against their compiler and package receipts.
 *
 * @param record - Four packages, mixed peer execution and callback regressions.
 */
export const assertOwnedDotnetReports = async record => {
	for(const group of [record.packages, record.scalarPackages]) assert.deepEqual(Object.keys(group).sort(), ["ordinary", "reviewed"]);
	for(const mode of ["ordinary", "reviewed"])
	{
		await assertOwnedDotnetPackageReport(record.packages[mode], mode, false, record.sources);
		await assertOwnedDotnetPackageReport(record.scalarPackages[mode], mode, true, record.sources);
	}
	const peers = record.coexistence;
	assert.equal(peers.schemaVersion, 1); assert.equal(peers.planNode, 1219);
	for(const flag of ["installedNuget", "sourceFreeExecution", "sourceUnchanged", "sdkFreeExecution", "consumerRemoved", "packageCachesRemoved", "relocated"])
		assert.equal(peers[flag], true, flag);
	assert.equal(peers.consumerSha256, record.sources["tests/fixtures/structured-types/owned-dotnet-coexistence.cs"]);
	digest(peers.forkProbeSha256);
	assert.deepEqual(peers.observations, ["copied-first", "owned-first", "plain-first"].flatMap(order =>
		["copied", "owned"].flatMap(retiredBy => [0, 1, 2].map(forkKind => ({
			checks: order === "owned-first" ? 212 : 213, order, retiredBy
			, rejectedCalls: 4, threadedCalls: 64
			, components: 4, runtimeInitializations: 1
			, liveIdentities: 0, forkChecks: 1, forkKind, libraries: 11 })))));
	assert.deepEqual(peers.inputs.map(item => item.name), ["owned-aggregates", "owned-peer", "copied-peer", "plain-peer"]);
	assert.equal(peers.manifests.length, 4); assert.equal(new Set(peers.manifests.map(item => item.runtimeIdentity)).size, 1);
	for(const input of peers.inputs)
	{ assert.equal(input.receipt.packages.length, 1); assert.equal(input.receipt.packages[0].target, "nuget"); digest(input.receipt.packages[0].artifacts[0].sha256); }
	for(const manifest of peers.manifests) files(manifest.files);
	const old = await json("docs/evidence/dotnet-recursive-callables-20260926.json");
	for(const family of ["primitive", "structured", "recursive"])
	{
		const reports = record.regressions[family].reports;
		assert.deepEqual(reports.map(item => item.path), ["ordinary-source", "reviewed-ir"]);
		for(const run of reports)
		{
			assert.equal(run[family === "recursive" ? "producerRemovedBeforeInstall" : "sourceRemovedBeforeInstallation"], true);
			assert.equal(run.packages.length, 1);
			assert.equal(run.packages[0].target, "nuget"); digest(run.packages[0].artifacts[0].sha256);
			const index = run.path === "ordinary-source" ? 0 : 1;
			if(family === "primitive")
			{
				assert.equal(run.checks, 128247); assert.equal(run.compilerFreePath, true); assert.equal(run.offlineInstall, true);
				assert.deepEqual(run.signatures, old.regressions.primitive.reports[index].signatures);
				assert.equal(run.consumerSha256, old.regressions.primitive.reports[index].consumerSha256);
				assert.equal(run.installed.sourceFree, true); assert.equal(run.installed.sourceFreeChecks, run.checks);
				assert.equal(run.installed.sourceFreeExecutions, 2); assert.equal(run.installed.onlyPreparedDependency, true);
				assert.deepEqual(run.installed.rejected, old.regressions.primitive.reports[index].installed.rejected);
			}
			else if(family === "structured")
			{
				const installed = run.installation, previous = old.regressions.structured.reports[index].installation;
				assert.deepEqual(installed.public, previous.public); assertDotnetStructuredFaults(installed.faults);
				assert.equal(installed.faults.faults, 5444);
				for(const flag of ["offlineInstall", "emptyNuGetCache", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "installedSourcesRemoved", "onlyPreparedDependency"])
					assert.equal(installed[flag], true, flag);
				for(const flag of ["deploymentUnchanged", "sdkFreeExecution", "sourceFreeExecution"]) assert.equal(installed.documentation[flag], true);
				assert.equal(installed.documentation.sourceSha256, previous.documentation.sourceSha256);
				assert.equal(installed.documentation.stdout, previous.documentation.stdout);
			}
			else
			{
				assertDotnetRecursiveProbes(run.probes);
				for(const flag of ["freshAuthor", "nugetOnly", "onlyPreparedDependency", "emptyNuGetCache", "handoffRemoved", "installedUnchanged", "sdkFree", "relocated"])
					assert.equal(run[flag], true, flag);
				assert.equal(run.exports, 33); assert.equal(run.signatures, 18); assert.equal(run.public.checks, 15);
				assert.equal(run.acyclic.checks, 274237); assert.equal(run.tamperChecks.length, 4);
				assert.deepEqual(run.originalRecursive.recursive, run.probes.recursive);
				assert.deepEqual(run.originalRecursive.lifetimes, run.probes.lifetimes);
				for(const flag of ["sdkFree", "sourceFree", "relocated"]) assert.equal(run.originalRecursive[flag], true, flag);
				assert.equal(run.originalRecursive.example, "20\n19\n20\n");
			}
		}
	}
	assert.deepEqual(record.regressions.recursive.mixedReports.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const mixed of record.regressions.recursive.mixedReports)
	{
		assert.equal(mixed.exports, 97); assert.equal(mixed.signatures, 59);
		assert.equal(mixed.producerRemovedBeforeInstall, true); assert.equal(mixed.sdkFree, true);
		assert.equal(mixed.mixed.checks, 128266); assert.equal(mixed.mixed.sourceFree, true); assert.equal(mixed.mixed.sdkFree, true);
		assert.equal(mixed.acyclic.checks, 274237); assert.equal(mixed.public.checks, 15);
		assert.equal(mixed.tamperChecks.length, 4); assert.equal(mixed.installedUnchanged, true);
	}
};

/**
 * Verify exact predecessor restoration without promoting unrelated type cells.
 *
 * @param record - Literal source changes and authenticated execution linkage.
 */
export const assertOwnedDotnetIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-dotnet-integration"); assert.equal(record.baselineRevision, ownedDotnetBaseline);
	assert.deepEqual(record.scope, ownedDotnetScope);
	for(const [entry, path] of [[record.previous, ownedRubyHistoryPath], [record.execution, ownedDotnetExecutionPath]])
	{ assert.equal(entry.path, path); assert.equal(sha256(await readFile(path)), entry.sha256); }
	const previous = await json(record.previous.path);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedDotnetChangedPaths, ...ownedDotnetAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	assert.deepEqual(record.updates.map(update => update.path).sort(), ownedDotnetChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedDotnetAddedPaths);
	const updates = new Map(record.updates.map(update => [update.path, update])), restored = {};
	for(const path of paths)
	{
		const current = ownedDotnetProcessHistoricalBytes(path, await readFile(path), record.sourceHashes[path]);
		assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update) restored[path] = reverseOwnedDotnetUpdate(current.toString("utf8"), update);
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { irSchema, consumers } = await readTypeSurface();
	const contracts = { irSchema, consumers };
	const document = JSON.parse(beforeOwnedDotnetProcess("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), record.sourceHashes["docs/type-surface.v1.json"]));
	const old = JSON.parse(restored["docs/type-surface.v1.json"]);
	const expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected); assert.deepEqual(typeSurfaceCells(document, contracts), typeSurfaceCells(old, contracts));
	const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
	await assertOwnedDotnetExecution(await json(record.execution.path));
	await assertOwnedRubyIntegration(previous);
};
