/**
 * Bind owned C installation claims to original archives and compiler metadata.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { ownedReviewedExecutionSources, assertOwnedReviewedIntegration } from "./owned-reviewed-evidence.mjs";
import { ownedReviewedHistoryPath } from "./owned-reviewed-source-history.mjs";
import { ownedPackageBaseline, ownedPackageChangedPaths, ownedPackageAddedPaths, ownedPackageExecutionPath, reverseOwnedPackageUpdate } from "./owned-package-source-history.mjs";
import { beforeOwnedHost, ownedHostChangedPaths } from "./owned-host-source-history.mjs";
import { ownedCiChangedPaths } from "./owned-ci-source-history.mjs";

export const ownedPackageCommand = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-c-packaging.test.mjs";
export const ownedPackageRegressionCommand = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/reviewed-owned-source.test.mjs tests/reviewed-source.test.mjs tests/reviewed-callables.test.mjs tests/owned-c-values.test.mjs";
export const ownedPackageScope = { profiles: ["c"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: false, transferredInputs: false
	, anchoredResults: false, wasm: false, promotedCells: 0 };
export const ownedPackageExecutionSources = [...new Set([
	...ownedReviewedExecutionSources
	, ...ownedPackageChangedPaths.filter(path => path.startsWith("src/"))
	, ...ownedPackageAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, "tests/owned-c-packaging.test.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/package-set.mjs", "tests/helpers/lake-workspace.mjs"
	, "src/build/native-gmp.mjs", "src/backends/c/gmp.mjs"
	, "src/release/deterministic-archive.mjs"
	, "src/release/package-set-assembly.mjs"
	, "src/release/package-set-receipt.mjs", "src/release/native-c-family.mjs"
	, "src/release/source-notices.mjs", "src/analyze/package-metadata.mjs"
	, "src/build/canonical-build.mjs"
])].sort();
const source = async path => beforeOwnedHost(path, await readFile(path, "utf8"));
const historicalBytes = async path => {
	const bytes = await readFile(path);
	return ownedHostChangedPaths.includes(path) || ownedCiChangedPaths.includes(path) ? beforeOwnedHost(path, bytes.toString("utf8")) : bytes;
};
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};

/**
 * Reconstruct public and native identities, then verify both installed runs.
 *
 * @param record - Retained compiler inputs, package receipts and enabled test logs.
 */
export const assertOwnedPackageExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-c-package-execution");
	assert.equal(record.baselineRevision, ownedPackageBaseline); assert.deepEqual(record.scope, ownedPackageScope);
	passing(record.run, ownedPackageCommand, 4); passing(record.regressions, ownedPackageRegressionCommand, 52);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedPackageExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await historicalBytes(path)), digest, path);
	assert.deepEqual(Object.keys(record.reports).sort(), ["ordinary", "reviewed"]);
	for(const [mode, report] of Object.entries(record.reports))
	{
		assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219); assert.equal(report.mode, mode);
		for(const flag of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "compilerFreeExecution"
			, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"
			, "forgedHeaderRejected"])
			assert.equal(report[flag], true, flag);
		assert.deepEqual(report.checks, { pkgConfig: 500, cmake: 500 });
		assert.equal(report.consumerSha256, record.sources["tests/fixtures/structured-types/owned-installed-values.c"]);
		const model = createCompiledNativeModel(report.input, { ownedGraphs: true });
		const adapters = generateCompiledNativeLeanAdapters(model), generated = generateOwnedCPackage(report.input);
		assert.equal(model.schemaVersion, 6); assert.equal(model.exports.length, 22);
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(model.sourceIdentity.extractorSha256, record.sources["src/analyze/NativeExports.lean"]);
		assert.equal(model.sourceIdentity.modules[0].source.sha256, record.sources["tests/fixtures/onboarding/owned-aggregates/Owned.lean"]);
		assert.equal(report.nativeModelSha256, sha256(canonicalJson(model)));
		const component = report.componentReceipt, adapter = report.adapterReceipt, manifest = report.manifest;
		assert.equal(component.modelSha256, report.nativeModelSha256); assert.equal(component.bindingIrSha256, model.bindingIrSha256);
		assert.equal(component.metadataSha256, sha256(canonicalJson(report.input.metadata)));
		assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
		assert.equal(component.headerSha256, sha256(adapters.header)); assert.equal(component.adaptersSha256, sha256(adapters.leanSource));
		assert.equal(adapter.schemaVersion, 2); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.runtimeIdentity, component.runtimeIdentity); assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(generated.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(generated.source));
		for(const [path, bytes] of Object.entries(generated.files))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
		assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.kind, "lean-bridge-native-c-package");
		assert.equal(manifest.name, "owned-archive"); assert.equal(manifest.version, "1.2.3");
		assert.equal(manifest.runtimeIdentity, component.runtimeIdentity); assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		assert.equal(manifest.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter))); assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
		assert.deepEqual(manifest.files[`lib/${component.library}`], component.nativeLibrary);
		assert.deepEqual(manifest.files[`include/${generated.values.prefix}.h`], adapter.files[`include/${generated.values.prefix}.h`]);
		for(const path of ["include/gmp.h", "lib/libgmp.so.10", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"])
			assert.deepEqual(manifest.files[path], adapter.files[`gmp/${path}`]);
		const set = report.packageSetReceipt; assert.equal(set.packages.length, 1); assert.equal(set.profiles.length, 1);
		assert.deepEqual(set.component, model.component); assert.equal(set.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(set.profiles[0], { id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: component.runtimeIdentity });
		const pkg = set.packages[0]; assert.equal(pkg.target, "c"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.name, manifest.name); assert.equal(pkg.version, manifest.version); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/owned-archive-1.2.3-c.tar.gz");
		assert.match(pkg.artifacts[0].sha256, /^[0-9a-f]{64}$/u); assert.ok(pkg.artifacts[0].bytes > 1_000_000);
	}
	const workflow = await source(".github/workflows/consumer-matrix.yml");
	assert.ok(workflow.includes("LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-c-packaging.test.mjs"));
};

/**
 * Preserve the full installed matrix and each predecessor's original observations.
 *
 * @param record - Frozen source transition and original execution link.
 */
export const assertOwnedPackageIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-c-package-integration");
	assert.equal(record.baselineRevision, ownedPackageBaseline); assert.deepEqual(record.scope, ownedPackageScope);
	assert.equal(record.previous.path, ownedReviewedHistoryPath); assert.equal(record.execution.path, ownedPackageExecutionPath);
	const previousText = await source(record.previous.path), executionText = await source(record.execution.path);
	assert.equal(sha256(previousText), record.previous.sha256); assert.equal(sha256(executionText), record.execution.sha256);
	const previous = JSON.parse(previousText); await assertOwnedPackageExecution(JSON.parse(executionText));
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedPackageChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedPackageAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedPackageChangedPaths, ...ownedPackageAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	const updates = new Map(record.updates.map(item => [item.path, item])), restored = {};
	for(const path of paths)
	{
		const current = await historicalBytes(path); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.currentSha256, record.sourceHashes[path]);
			restored[path] = reverseOwnedPackageUpdate(current.toString("utf8"), update);
		}
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { document: currentDocument, ...contracts } = await readTypeSurface();
	assert.equal(currentDocument.contractVersion, record.inventory.version);
	const document = JSON.parse(await source("docs/type-surface.v1.json"));
	const old = JSON.parse(restored["docs/type-surface.v1.json"]);
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
	await assertOwnedReviewedIntegration(previous);
};
