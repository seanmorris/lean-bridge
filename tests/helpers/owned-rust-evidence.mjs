/**
 * Authenticate Rust ownership evidence against installed execution and source facts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { compiledPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { ownedRustRuntime } from "../../src/backends/rust/owned-runtime.mjs";
import { generateOwnedRustCallables } from "../../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { ownedCppExecutionSources, assertOwnedCppIntegration } from "./owned-cpp-evidence.mjs";
import { ownedCppHistoryPath } from "./owned-cpp-source-history.mjs";
import { ownedCppOrderHistoryPath } from "./owned-cpp-order-history.mjs";
import { ownedRustBaseline, ownedRustChangedPaths, ownedRustAddedPaths, ownedRustExecutionPath, beforeOwnedRust, reverseOwnedRustUpdate } from "./owned-rust-source-history.mjs";

export const ownedRustCommands = {
	core: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-rust-runtime.test.mjs tests/owned-rust-values.test.mjs"
	, packages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-rust-packaging.test.mjs"
	, contracts: "node --test tests/perl-contract.test.mjs tests/test-profiles.test.mjs tests/checked-javascript.test.mjs tests/cli-package.test.mjs"
};
export const ownedRustScope = { profiles: ["cargo"], companions: ["c", "cpp"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: true, hostCallbackLifetime: "call"
	, higherOrderCallbacks: true, boxedRecursion: true
	, transferredInputs: false, anchoredResults: false, wasm: false
	, promotedCells: 0 };
export const ownedRustExecutionSources = [...new Set([
	...ownedCppExecutionSources
	, ...ownedRustAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, "tests/owned-rust-runtime.test.mjs", "tests/owned-rust-values.test.mjs"
	, "tests/owned-rust-packaging.test.mjs", "docs/consume/rust.md"
	, "src/backends/rust/copied-assets.mjs", "src/backends/rust/copied-values.mjs"
	, "src/backends/rust/copied-model.mjs", "src/backends/rust/dependencies.lock"
	, "tests/helpers/type-corpus-rust.mjs"
])].sort();
const json = async path => JSON.parse(await readFile(path, "utf8"));
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};
const identity = (input, mode, fixture, sources) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sources["src/analyze/NativeExports.lean"]);
	assert.equal(input.sourceIdentity.modules[0].source.sha256, sources[`tests/fixtures/onboarding/${fixture}/Owned.lean`]);
};
const nativeModel = input => createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true });

const packageReport = async (report, mode, sources) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219); assert.equal(report.mode, mode);
	for(const flag of ["compiledLean", "installedPackage", "sourceUnchanged"
		, "sourceFreeInstallation", "sourceFreeRelocatedExecution", "emptyCargoHome"
		, "offlineInstall", "handoffRemovedBeforeRelocatedExecution"
		, "deterministicReassembly"])
		assert.equal(report[flag], true, flag);
	assert.equal(report.checks, 596); assert.equal(report.relocatedChecks, 596);
	assert.deepEqual(report.companions, mode === "reviewed" ? { c: 693, cpp: 577 } : {});
	assert.deepEqual(report.tamperRejected, ["lifetime", "source", "abi", "library"]);
	assert.deepEqual(report.loaderRejected, ["unverified-runtime", "changed-embedded-library"]);
	assert.deepEqual(report.rejected, ["missing-recovery", "wrong-kind", "send", "sync"]);
	assert.equal(report.consumerSha256, sources["tests/fixtures/structured-types/owned-installed-rust.rs"]);
	const docs = await readFile("docs/consume/rust.md", "utf8");
	const example = docs.split("### Resource-containing values\n")[1].split("```rust\n")[1].split("\n```")[0] + "\n";
	assert.equal(report.documentationSha256, sha256(example));
	identity(report.input, mode, "owned-cpp-composition", sources);
	const model = nativeModel(report.input), native = generateCompiledNativeLeanAdapters(model);
	assert.equal(model.schemaVersion, 7); assert.equal(model.exports.length, 31);
	const c = generateOwnedCPackage({ ...report.input, hostCallbacks: true });
	const { componentReceipt: component, adapterReceipt: adapter, compiledReceipt: compiled, manifest } = report;
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.metadataSha256, sha256(canonicalJson(report.input.metadata)));
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(adapter.schemaVersion, 3); assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
	assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	const rust = generateOwnedRustPackage(model.bindingIr, compiled.evidence, { name: "owned-values", version: "1.2.3", metadata: compiledPackageMetadata(model.sourceIdentity) });
	assert.deepEqual(adapter.rustValues, rust.contract); assert.deepEqual(compiled.ownedValues, rust.contract);
	assert.deepEqual(manifest.ownedValues, rust.contract);
	for(const [path, source] of Object.entries({ ...c.files, "internal/rust-abi.h": rust.abiHeader }))
		assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) });
	if(mode === "reviewed") assert.deepEqual(adapter.cppValues, generateOwnedCppPackage(model.bindingIr).contract);
	else assert.equal(adapter.cppValues, undefined);
	assert.equal(compiled.schemaVersion, 2); assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.match(compiled.rustc, /^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u);
	assert.equal(compiled.evidence.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(compiled.evidence.runtimeIdentity, component.runtimeIdentity);
	assert.deepEqual(compiled.evidence.ownedValues, rust.contract);
	assert.equal(manifest.kind, "lean-bridge-owned-cargo-package"); assert.equal(manifest.schemaVersion, 2);
	assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256); assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
	assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	for(const [path, source] of Object.entries(rust.files))
	{
		const expected = { bytes: Buffer.byteLength(source), sha256: sha256(source) };
		assert.deepEqual(compiled.files[path], expected); assert.deepEqual(manifest.files[path], expected);
	}
	const lock = await copiedRustLock("owned-values", "1.2.3");
	assert.equal(report.dependencies.lockSha256, sha256(lock));
	const locked = lock.split("[[package]]").slice(1).flatMap(section => {
		const checksum = section.match(/^checksum = "([a-f0-9]+)"$/mu)?.[1];
		return checksum ? [{ directory: section.match(/^name = "([^"]+)"$/mu)[1] + "-" + section.match(/^version = "([^"]+)"$/mu)[1], checksum }] : [];
	});
	assert.deepEqual(report.dependencies.packages.map(({ directory, checksum }) => ({ directory, checksum })), locked);
	for(const dependency of report.dependencies.packages)
	{
		assert.ok(Number.isSafeInteger(dependency.files) && dependency.files > 0);
		assert.match(dependency.manifestSha256, /^[0-9a-f]{64}$/u);
	}
	assert.deepEqual(manifest.files["Cargo.lock"], { bytes: Buffer.byteLength(lock), sha256: sha256(lock) });
	for(const [name, digest] of Object.entries(compiled.evidence.libraries))
	{
		assert.equal(compiled.files[`native/linux-x64/${name}`].sha256, digest);
		assert.deepEqual(manifest.files[`native/linux-x64/${name}`], compiled.files[`native/linux-x64/${name}`]);
	}
	for(const path of ["lean-bridge/component/callbacks.c", "lean-bridge/licenses/Lean-LICENSE", "lean-bridge/licenses/Lean-LICENSES", "lean-bridge/sources/gmp-6.3.0.tar.xz"])
		assert.ok(manifest.files[path]?.bytes > 0, path);
	const receipt = report.packageSetReceipt;
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
	assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), mode === "reviewed" ? ["c", "cargo", "cpp"] : ["cargo"]);
	const pkg = receipt.packages.find(pkg => pkg.target === "cargo");
	assert.equal(pkg.name, "owned-values"); assert.equal(pkg.version, "1.2.3"); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].path, "archives/owned-values-1.2.3.crate");
	assert.ok(pkg.artifacts[0].bytes > 1_000_000); assert.match(pkg.artifacts[0].sha256, /^[0-9a-f]{64}$/u);
};

/**
 * Require compiled ownership probes and independently installed consumer packages.
 *
 * @param record - Immutable executions, inputs, source digests and package receipts.
 */
export const assertOwnedRustExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-rust-execution"); assert.equal(record.baselineRevision, ownedRustBaseline);
	assert.deepEqual(record.scope, ownedRustScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedRustCommands).sort());
	for(const [name, count] of Object.entries({ core: 6, packages: 4, contracts: 55 })) passing(record.runs[name], ownedRustCommands[name], count);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedRustExecutionSources);
	for(const [path, digest] of Object.entries(record.sources))
		assert.equal(sha256(beforeOwnedRust(path, await readFile(path, "utf8"), digest)), digest, path);
	for(const collection of [record.inputs.runtime, record.inputs.values, record.runtime, record.values, record.packages])
		assert.deepEqual(Object.keys(collection).sort(), ["ordinary", "reviewed"]);
	for(const mode of ["ordinary", "reviewed"])
	{
		const input = record.inputs.runtime[mode], runtime = record.runtime[mode];
		identity(input, mode, "owned-host-callbacks", record.sources);
		const c = generateOwnedCPackage({ ...input, hostCallbacks: true });
		assert.equal(runtime.compiledLean, true); assert.equal(runtime.installedPackage, false);
		assert.equal(runtime.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
		assert.equal(runtime.runtimeSha256, sha256(ownedRustRuntime(c.values.prefix)));
		assert.equal(runtime.templateSha256, record.sources["tests/fixtures/structured-types/owned-rust-runtime.rs"]);
		assert.equal(runtime.sendRejected, true); assert.equal(runtime.syncRejected, true);
		assert.deepEqual(runtime.result, { checks: 184, allocationFailures: 4, live: 0, identities: 0 });
		const valuesInput = record.inputs.values[mode], values = record.values[mode];
		identity(valuesInput, mode, "owned-cpp-composition", record.sources);
		const generated = generateOwnedRustCallables(nativeModel(valuesInput).bindingIr);
		assert.equal(values.compiledLean, true); assert.equal(values.installedPackage, false);
		assert.equal(values.sourceIdentitySha256, sha256(canonicalJson(valuesInput.sourceIdentity)));
		for(const [key, source] of Object.entries({ valuesSha256: generated.valuesSource, apiSha256: generated.apiSource, conversionsSha256: generated.source }))
			assert.equal(values[key], sha256(source));
		assert.equal(values.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-rust-values.rs", "utf8") + await readFile("tests/fixtures/structured-types/owned-rust-callables.rs", "utf8")));
		assert.deepEqual(values.result, { checks: 3025, rustFaults: 342, nativeFaults: 254, live: 0, identities: 0 });
		assert.deepEqual(values.rejected, ["missing-recovery", "wrong-callback-result", "wrong-resource-kind"]);
		await packageReport(record.packages[mode], mode, record.sources);
	}
};

/**
 * Preserve predecessor receipts and reject unrelated support promotions.
 *
 * @param record - Complete before/after source identities and execution linkage.
 */
export const assertOwnedRustIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-rust-integration"); assert.equal(record.baselineRevision, ownedRustBaseline);
	assert.deepEqual(record.scope, ownedRustScope);
	for(const [entry, path] of [[record.previous, ownedCppOrderHistoryPath], [record.predecessor, ownedCppHistoryPath], [record.execution, ownedRustExecutionPath]])
	{ assert.equal(entry.path, path); assert.equal(sha256(await readFile(path)), entry.sha256); }
	const order = await json(record.previous.path), cpp = await json(record.predecessor.path);
	const previousSources = { ...cpp.sourceHashes, ...order.additions, ...Object.fromEntries(order.updates.map(update => [update.path, update.currentSha256])) };
	const paths = [...new Set([...Object.keys(previousSources), ...ownedRustChangedPaths, ...ownedRustAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	assert.deepEqual(record.updates.map(update => update.path).sort(), ownedRustChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedRustAddedPaths);
	const updates = new Map(record.updates.map(update => [update.path, update])), restored = {};
	for(const path of paths)
	{
		const current = await readFile(path); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update) restored[path] = reverseOwnedRustUpdate(current.toString("utf8"), update);
		if(previousSources[path]) assert.equal(sha256(restored[path] ?? current), previousSources[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { document, ...contracts } = await readTypeSurface(), previousDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
	const expected = structuredClone(previousDocument);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected); assert.deepEqual(typeSurfaceCells(document, contracts), typeSurfaceCells(previousDocument, contracts));
	const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
	await assertOwnedRustExecution(await json(record.execution.path));
	await assertOwnedCppIntegration(cpp);
};
