/**
 * Bind C++ ownership claims to compiled probes and source-free package installs.
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
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { ownedHostExecutionSources, assertOwnedHostIntegration } from "./owned-host-evidence.mjs";
import { ownedHostHistoryPath } from "./owned-host-source-history.mjs";
import { ownedCiHistoryPath } from "./owned-ci-source-history.mjs";
import { ownedCppBaseline, ownedCppChangedPaths, ownedCppAddedPaths, ownedCppExecutionPath, reverseOwnedCppUpdate } from "./owned-cpp-source-history.mjs";
import { ownedCppOrderHistoricalBytes } from "./owned-cpp-order-history.mjs";

export const ownedCppCommands = {
	core: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-cpp-runtime.test.mjs tests/owned-cpp-callables.test.mjs"
	, packages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-cpp-packaging.test.mjs"
	, cPackages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-c-packaging.test.mjs tests/owned-host-packaging.test.mjs"
	, contracts: "node --test tests/perl-contract.test.mjs tests/test-profiles.test.mjs tests/checked-javascript.test.mjs tests/cli-package.test.mjs"
};
export const ownedCppScope = { profiles: ["c", "cpp"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: true, hostCallbackLifetime: "call"
	, higherOrderCallbacks: true, boxedRecursion: true
	, transferredInputs: false, anchoredResults: false
	, wasm: false, promotedCells: 0 };
export const ownedCppExecutionSources = [...new Set([
	...ownedHostExecutionSources
	, ...ownedCppChangedPaths.filter(path => path.startsWith("src/"))
	, ...ownedCppAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, "tests/helpers/owned-cpp-composition-fixture.mjs"
	, "tests/owned-cpp-runtime.test.mjs", "tests/owned-cpp-callables.test.mjs"
	, "tests/owned-cpp-packaging.test.mjs", "src/backends/cpp/boost.mjs"
])].sort();
const json = async path => JSON.parse(await readFile(path, "utf8"));
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};
const startup = report => {
	assert.match(report.startupLeakBaseline, /__gmp_default_allocate/u);
	assert.match(report.startupLeakBaseline, /SUMMARY: AddressSanitizer: 128 byte\(s\) leaked in 12 allocation\(s\)\.\n$/u);
	assert.doesNotMatch(report.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:|suppression/iu);
};
const identity = (input, mode, fixture, sources) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sources["src/analyze/NativeExports.lean"]);
	assert.equal(input.sourceIdentity.modules[0].source.sha256, sources[`tests/fixtures/onboarding/${fixture}/Owned.lean`]);
};
const packageReport = (report, mode, sources, kind) => {
	const cpp = kind === "cpp", callbacks = kind === "callbacks";
	const checks = cpp ? 577 : callbacks ? 693 : 500;
	const fixture = cpp ? "owned-cpp-composition" : callbacks ? "owned-host-callbacks" : "owned-aggregates";
	const consumer = cpp ? "owned-installed-cpp.cpp" : callbacks ? "owned-installed-host-callbacks.c" : "owned-installed-values.c";
	assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219); assert.equal(report.mode, mode);
	for(const flag of ["compiledLean", "installedPackage", "sourceUnchanged"
		, "sourceFreeInstallation", "compilerFreeExecution"
		, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"
		, ...cpp ? ["forgedHeaderRejected", "forgedLifetimeRejected", "forgedBoostRejected", "sharedCAdapter", "boxedRecursion", "nestedOptions", "higherOrderCallbacks"]
			: callbacks ? ["forgedCapabilityRejected", "forgedTrampolineRejected", "forgedAdapterRejected"] : ["forgedHeaderRejected"]])
		assert.equal(report[flag], true, flag);
	assert.deepEqual(report.checks, cpp ? { pkgConfig: checks, cmake: checks, sanitized: checks, c: 693 } : { pkgConfig: checks, cmake: checks });
	assert.equal(report.consumerSha256, sources[`tests/fixtures/structured-types/${consumer}`]);
	identity(report.input, mode, fixture, sources);
	const model = createCompiledNativeModel(report.input, { ownedGraphs: true, ownedHostCallbacks: true });
	assert.equal(model.schemaVersion, 7); assert.equal(model.exports.length, cpp ? 31 : callbacks ? 11 : 22);
	const native = generateCompiledNativeLeanAdapters(model), c = generateOwnedCPackage({ ...report.input, hostCallbacks: true });
	const component = report.componentReceipt, adapter = report.adapterReceipt, manifest = report.manifest;
	assert.equal(component.schemaVersion, 3); assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.metadataSha256, sha256(canonicalJson(report.input.metadata)));
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(adapter.schemaVersion, 3); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
	assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	for(const [path, bytes] of Object.entries(c.files))
		assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
	assert.equal(manifest.schemaVersion, 3); assert.equal(manifest.kind, `lean-bridge-native-${cpp ? "cpp" : "c"}-package`);
	assert.equal(manifest.runtimeIdentity, component.runtimeIdentity); assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter))); assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
	assert.deepEqual(manifest.files[`lib/${component.library}`], component.nativeLibrary);
	assert.deepEqual(manifest.files[`include/${c.values.prefix}.h`], adapter.files[`include/${c.values.prefix}.h`]);
	assert.deepEqual(manifest.files["share/lean-bridge/component/callbacks.c"], { bytes: Buffer.byteLength(native.callbackSource), sha256: sha256(native.callbackSource) });
	for(const path of ["include/gmp.h", "lib/libgmp.so.10", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"])
		assert.deepEqual(manifest.files[path], adapter.files[`gmp/${path}`]);
	if(cpp)
	{
		const generated = generateOwnedCppPackage(model.bindingIr);
		assert.deepEqual(adapter.cppValues, generated.contract); assert.deepEqual(manifest.cppValues, generated.contract);
		assert.equal(manifest.exactIntegers, "boost-multiprecision-1.90.0");
		assert.equal(manifest.cmakePackage, "LeanBridgeOwnedAggregatesCpp"); assert.equal(manifest.cmakeTarget, "LeanBridge::owned_aggregates_cpp");
		for(const [path, bytes] of Object.entries(generated.files))
		{
			const expected = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
			assert.deepEqual(adapter.files[path], expected, path);
			if(!path.startsWith("src/")) assert.deepEqual(manifest.files[path], expected, path);
		}
		startup(report);
	}
	else assert.equal(adapter.cppValues, undefined);
	const set = report.packageSetReceipt; assert.equal(set.packages.length, cpp ? 2 : 1); assert.equal(set.profiles.length, 1);
	assert.deepEqual(set.component, model.component); assert.equal(set.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
	assert.deepEqual(set.profiles[0], { id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: component.runtimeIdentity });
	assert.deepEqual(set.packages.map(entry => entry.target).sort(), cpp ? ["c", "cpp"] : ["c"]);
	for(const entry of set.packages)
	{
		assert.equal(entry.runtimeDelivery, "embedded"); assert.equal(entry.version, "1.2.3"); assert.equal(entry.artifacts.length, 1);
		const name = cpp ? `owned-${entry.target}-values` : callbacks ? "owned-callback-archive" : "owned-archive";
		assert.equal(entry.name, name); assert.equal(entry.artifacts[0].path, `archives/${name}-1.2.3-${entry.target}.tar.gz`);
		assert.match(entry.artifacts[0].sha256, /^[0-9a-f]{64}$/u); assert.ok(entry.artifacts[0].bytes > 1_000_000);
	}
};

/**
 * Reconstruct generated identities and require both compiled source paths.
 *
 * @param record - Original executions, compiler inputs and installed receipts.
 */
export const assertOwnedCppExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-cpp-execution"); assert.equal(record.baselineRevision, ownedCppBaseline);
	assert.deepEqual(record.scope, ownedCppScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedCppCommands).sort());
	for(const [name, count] of Object.entries({ core: 13, packages: 5, cPackages: 8, contracts: 55 }))
		passing(record.runs[name], ownedCppCommands[name], count);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedCppExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedCppOrderHistoricalBytes(path, await readFile(path))), digest, path);
	for(const collection of [record.runtime, record.packages, record.cPackages.aggregates, record.cPackages.callbacks])
		assert.deepEqual(Object.keys(collection).sort(), ["ordinary", "reviewed"]);
	assert.deepEqual(Object.keys(record.inputs).sort(), ["owned-aggregates", "owned-host-callbacks"]);
	assert.deepEqual(Object.keys(record.callables).sort(), Object.keys(record.inputs).sort());
	for(const [fixture, inputs] of Object.entries(record.inputs))
	{
		assert.deepEqual(Object.keys(inputs).sort(), ["ordinary", "reviewed"]);
		assert.deepEqual(Object.keys(record.callables[fixture]).sort(), ["ordinary", "reviewed"]);
		for(const mode of ["ordinary", "reviewed"])
		{
			const input = inputs[mode], report = record.callables[fixture][mode];
			identity(input, mode, fixture, record.sources);
			const c = generateOwnedCPackage({ ...input, hostCallbacks: true }), generated = generateOwnedCppPackage(c.layout.model.bindingIr);
			assert.equal(report.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
			assert.equal(report.headerSha256, sha256(generated.header)); assert.equal(report.valuesSha256, sha256(generated.valuesHeader));
			assert.equal(report.conversionsSha256, sha256(generated.conversionsHeader));
			assert.equal(report.templateSha256, record.sources["tests/fixtures/structured-types/owned-cpp-callables.cpp"]);
			assert.match(report.probeSha256, /^[0-9a-f]{64}$/u); startup(report);
			const functional = fixture === "owned-aggregates" ? 140 : 141;
			assert.deepEqual(report.result, { checks: functional + 102, faultChecks: 102, allocationFailures: 49, live: 0, identities: 0 });
			assert.deepEqual(report.sanitizedResult, { checks: functional + 94, faultChecks: 94, allocationFailures: 45, live: 0, identities: 0 });
			if(fixture === "owned-host-callbacks")
			{
				const runtime = record.runtime[mode], template = await readFile("tests/fixtures/structured-types/owned-cpp-runtime.cpp", "utf8");
				assert.equal(runtime.sourceIdentitySha256, report.sourceIdentitySha256);
				assert.equal(runtime.headerSha256, report.valuesSha256);
				assert.equal(runtime.templateSha256, sha256(template));
				assert.equal(runtime.probeSha256, sha256(template.replaceAll("TICKET_KIND", generated.types.find(node => node.name === "Ticket").identityTag)));
				assert.deepEqual(runtime.result, { checks: 453, allocationFailures: 4, valueCopyFailures: 3, live: 0, identities: 0 });
				startup(runtime);
			}
		}
	}
	for(const mode of ["ordinary", "reviewed"])
	{
		packageReport(record.packages[mode], mode, record.sources, "cpp");
		packageReport(record.cPackages.aggregates[mode], mode, record.sources, "aggregates");
		packageReport(record.cPackages.callbacks[mode], mode, record.sources, "callbacks");
	}
};

/**
 * Verify the additive source transition without promoting unrelated host cells.
 *
 * @param record - Exact before/after source identities and execution link.
 */
export const assertOwnedCppIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-cpp-integration"); assert.equal(record.baselineRevision, ownedCppBaseline);
	assert.deepEqual(record.scope, ownedCppScope);
	for(const [entry, path] of [[record.previous, ownedCiHistoryPath], [record.predecessor, ownedHostHistoryPath], [record.execution, ownedCppExecutionPath]])
	{
		assert.equal(entry.path, path); assert.equal(sha256(await readFile(path)), entry.sha256);
	}
	const ci = await json(record.previous.path), predecessor = await json(record.predecessor.path);
	const previousSources = { ...predecessor.sourceHashes, ...ci.additions
		, ...Object.fromEntries(ci.updates.map(update => [update.path, update.currentSha256])) };
	const paths = [...new Set([...Object.keys(previousSources), ...ownedCppChangedPaths, ...ownedCppAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	assert.deepEqual(record.updates.map(update => update.path).sort(), ownedCppChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedCppAddedPaths);
	const updates = new Map(record.updates.map(update => [update.path, update])), restored = {};
	for(const path of paths)
	{
		const current = ownedCppOrderHistoricalBytes(path, await readFile(path)); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.currentSha256, record.sourceHashes[path]);
			restored[path] = reverseOwnedCppUpdate(current.toString("utf8"), update);
		}
		if(previousSources[path]) assert.equal(sha256(restored[path] ?? current), previousSources[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { irSchema, consumers } = await readTypeSurface(), contracts = { irSchema, consumers };
	const document = JSON.parse(ownedCppOrderHistoricalBytes("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json")));
	const previousDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
	const expected = structuredClone(previousDocument);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected); const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(cells, typeSurfaceCells(previousDocument, contracts));
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
	await assertOwnedCppExecution(await json(record.execution.path));
	await assertOwnedHostIntegration(predecessor);
};
