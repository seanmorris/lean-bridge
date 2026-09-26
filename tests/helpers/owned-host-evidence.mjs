/**
 * Bind owned callback claims to compiler inputs, fault probes and installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { ownedPackageExecutionSources, assertOwnedPackageIntegration } from "./owned-package-evidence.mjs";
import { ownedPackageHistoryPath } from "./owned-package-source-history.mjs";
import { ownedHostBaseline, ownedHostChangedPaths, ownedHostAddedPaths, ownedHostExecutionPath, reverseOwnedHostUpdate } from "./owned-host-source-history.mjs";
import { beforeOwnedCi, ownedCiHistoricalBytes } from "./owned-ci-source-history.mjs";

export const ownedHostCommands = {
	core: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-host-callbacks.test.mjs"
	, packages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-host-packaging.test.mjs"
	, packageRegressions: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-c-packaging.test.mjs"
	, nixBoundary: "node --test tests/perl-contract.test.mjs"
};
export const ownedHostScope = { profiles: ["c"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: true, hostCallbackLifetime: "call"
	, transferredInputs: false, anchoredResults: false
	, wasm: false, promotedCells: 0 };
export const ownedHostExecutionSources = [...new Set([
	...ownedPackageExecutionSources
	, ...ownedHostChangedPaths.filter(path => path.startsWith("src/"))
	, ...ownedHostAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, "tests/helpers/owned-host-callback-fixture.mjs"
	, "tests/owned-host-callbacks.test.mjs", "tests/owned-host-packaging.test.mjs"
	, "tests/perl-contract.test.mjs", "nix/perl-engine-source-boundary.json"
])].sort();
const source = async path => beforeOwnedCi(path, await readFile(path, "utf8"));
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};

/**
 * Reconstruct callback and package identities and require actual enabled runs.
 *
 * @param record - Original execution logs, compiler inputs and package receipts.
 */
export const assertOwnedHostExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-host-callback-execution");
	assert.equal(record.baselineRevision, ownedHostBaseline); assert.deepEqual(record.scope, ownedHostScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedHostCommands).sort());
	for(const [name, count] of Object.entries({ core: 5, packages: 4, packageRegressions: 4, nixBoundary: 48 }))
		passing(record.runs[name], ownedHostCommands[name], count);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedHostExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedCiHistoricalBytes(path, await readFile(path))), digest, path);
	for(const collection of [record.inputs, record.core, record.packages, record.packageRegressions])
		assert.deepEqual(Object.keys(collection).sort(), ["ordinary", "reviewed"]);
	for(const mode of ["ordinary", "reviewed"])
	{
		const input = record.inputs[mode], report = record.core[mode];
		const generated = generateOwnedCPackage({ ...input, hostCallbacks: true });
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.extractorSha256, record.sources["src/analyze/NativeExports.lean"]);
		assert.equal(input.sourceIdentity.modules[0].source.sha256, record.sources["tests/fixtures/onboarding/owned-host-callbacks/Owned.lean"]);
		assert.equal(report.bindingIrSha256, generated.layout.model.bindingIrSha256);
		assert.equal(report.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
		assert.equal(report.headerSha256, sha256(generated.publicHeader)); assert.equal(report.adapterSha256, sha256(generated.source));
		assert.equal(report.probeSha256, record.sources["tests/fixtures/structured-types/owned-host-callbacks.c"]);
		assert.deepEqual(report.hostCallbacks, generated.carriers.hostCallbacks);
		assert.deepEqual(report.result, { checks: 4635, failures: 642, live: 0, identities: 0 });
		assert.equal(report.noLeanGlobalCopyRelocation, true);
		assert.match(report.startupLeakBaseline, /__gmp_default_allocate/u);
		assert.match(report.startupLeakBaseline, /SUMMARY: AddressSanitizer: 128 byte\(s\) leaked in 12 allocation\(s\)\.\n$/u);
		assert.doesNotMatch(report.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:|suppression/iu);
		for(const [kind, checks, fixture, name] of [
			["packages", 693, "owned-installed-host-callbacks", "owned-callback-archive"]
			, ["packageRegressions", 500, "owned-installed-values", "owned-archive"]
		]) {
			const pkg = record[kind][mode], callbacks = kind === "packages";
			assert.equal(pkg.schemaVersion, 1); assert.equal(pkg.planNode, 1219); assert.equal(pkg.mode, mode);
			for(const flag of ["compiledLean", "installedPackage", "sourceUnchanged"
				, "sourceFreeInstallation", "compilerFreeExecution"
				, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"
				, ...(callbacks ? ["forgedCapabilityRejected", "forgedTrampolineRejected", "forgedAdapterRejected"] : ["forgedHeaderRejected"])])
				assert.equal(pkg[flag], true, flag);
			assert.deepEqual(pkg.checks, { pkgConfig: checks, cmake: checks });
			assert.equal(pkg.consumerSha256, record.sources[`tests/fixtures/structured-types/${fixture}.c`]);
			const model = createCompiledNativeModel(pkg.input, { ownedGraphs: true, ownedHostCallbacks: true });
			const adapters = generateCompiledNativeLeanAdapters(model);
			const publicC = generateOwnedCPackage({ ...pkg.input, hostCallbacks: true });
			assert.equal(model.schemaVersion, 7); assert.equal(model.ownedGraph.schemaVersion, 2);
			assert.equal(model.exports.length, callbacks ? 11 : 22);
			assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
			assert.equal(model.sourceIdentity.extractorSha256, record.sources["src/analyze/NativeExports.lean"]);
			assert.equal(model.sourceIdentity.modules[0].source.sha256, record.sources[`tests/fixtures/onboarding/${callbacks ? "owned-host-callbacks" : "owned-aggregates"}/Owned.lean`]);
			assert.equal(pkg.nativeModelSha256, sha256(canonicalJson(model)));
			const component = pkg.componentReceipt, adapter = pkg.adapterReceipt, manifest = pkg.manifest;
			assert.equal(component.schemaVersion, 3); assert.equal(component.modelSha256, pkg.nativeModelSha256);
			assert.equal(component.bindingIrSha256, model.bindingIrSha256);
			assert.equal(component.metadataSha256, sha256(canonicalJson(pkg.input.metadata)));
			assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
			assert.equal(component.headerSha256, sha256(adapters.header)); assert.equal(component.adaptersSha256, sha256(adapters.leanSource));
			assert.equal(component.callbackSourceSha256, sha256(adapters.callbackSource));
			assert.equal(adapter.schemaVersion, 3); assert.equal(adapter.ownedValues.schemaVersion, 2);
			assert.equal(adapter.bindingIrSha256, model.bindingIrSha256); assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
			assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
			assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
			assert.equal(adapter.ownedValues.headerSha256, sha256(publicC.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(publicC.source));
			for(const [path, bytes] of Object.entries(publicC.files))
				assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
			assert.equal(manifest.schemaVersion, 3); assert.equal(manifest.kind, "lean-bridge-native-c-package");
			assert.equal(manifest.name, name); assert.equal(manifest.version, "1.2.3");
			assert.equal(manifest.runtimeIdentity, component.runtimeIdentity); assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
			assert.equal(manifest.componentReceiptSha256, sha256(canonicalJson(component)));
			assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter))); assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
			assert.deepEqual(manifest.files[`lib/${component.library}`], component.nativeLibrary);
			assert.deepEqual(manifest.files[`include/${publicC.values.prefix}.h`], adapter.files[`include/${publicC.values.prefix}.h`]);
			assert.deepEqual(manifest.files["share/lean-bridge/component/callbacks.c"], { bytes: Buffer.byteLength(adapters.callbackSource), sha256: sha256(adapters.callbackSource) });
			for(const path of ["include/gmp.h", "lib/libgmp.so.10", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"])
				assert.deepEqual(manifest.files[path], adapter.files[`gmp/${path}`]);
			const set = pkg.packageSetReceipt; assert.equal(set.packages.length, 1); assert.equal(set.profiles.length, 1);
			assert.deepEqual(set.component, model.component); assert.equal(set.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
			assert.deepEqual(set.profiles[0], { id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: component.runtimeIdentity });
			const entry = set.packages[0]; assert.equal(entry.target, "c"); assert.equal(entry.runtimeDelivery, "embedded");
			assert.equal(entry.name, name); assert.equal(entry.version, "1.2.3"); assert.equal(entry.artifacts.length, 1);
			assert.equal(entry.artifacts[0].path, `archives/${name}-1.2.3-c.tar.gz`);
			assert.match(entry.artifacts[0].sha256, /^[0-9a-f]{64}$/u); assert.ok(entry.artifacts[0].bytes > 1_000_000);
		}
	}
};

/**
 * Verify this source transition and preserve each predecessor's original claims.
 *
 * @param record - Immutable source history and original execution link.
 */
export const assertOwnedHostIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-host-callback-integration");
	assert.equal(record.baselineRevision, ownedHostBaseline); assert.deepEqual(record.scope, ownedHostScope);
	assert.equal(record.previous.path, ownedPackageHistoryPath); assert.equal(record.execution.path, ownedHostExecutionPath);
	const previousText = await source(record.previous.path), executionText = await source(record.execution.path);
	assert.equal(sha256(previousText), record.previous.sha256); assert.equal(sha256(executionText), record.execution.sha256);
	const previous = JSON.parse(previousText); await assertOwnedHostExecution(JSON.parse(executionText));
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedHostChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedHostAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedHostChangedPaths, ...ownedHostAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	const updates = new Map(record.updates.map(item => [item.path, item])), restored = {};
	for(const path of paths)
	{
		const current = ownedCiHistoricalBytes(path, await readFile(path)); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.currentSha256, record.sourceHashes[path]);
			restored[path] = reverseOwnedHostUpdate(current.toString("utf8"), update);
		}
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { document: currentDocument, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	const document = JSON.parse(await source("docs/type-surface.v1.json"));
	assert.equal(currentDocument.contractVersion, document.contractVersion);
	const expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected); const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(cells, typeSurfaceCells(old, contracts));
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
	await assertOwnedPackageIntegration(previous);
};
