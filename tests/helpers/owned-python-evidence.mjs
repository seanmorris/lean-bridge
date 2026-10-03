/**
 * Authenticate owned Python execution, prepared wheels and source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { generateOwnedPythonConversions } from "../../src/backends/python/owned-conversions.mjs";
import { ownedPythonRuntime } from "../../src/backends/python/owned-runtime.mjs";
import { ownedPythonInstalledProbe } from "./owned-python-installed-probes.mjs";
import { ownedRustExecutionSources, assertOwnedRustIntegration } from "./owned-rust-evidence.mjs";
import { ownedRustHistoryPath, ownedRustExecutionPath } from "./owned-rust-source-history.mjs";
import { ownedPythonBaseline, ownedPythonChangedPaths, ownedPythonAddedPaths, ownedPythonExecutionPath, reverseOwnedPythonUpdate } from "./owned-python-source-history.mjs";
import { beforeOwnedRuby, ownedRubyHistoricalBytes } from "./owned-ruby-source-history.mjs";

export const ownedPythonCommands = {
	core: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-python-runtime.test.mjs tests/owned-python-values.test.mjs"
	, packages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-concurrency=1 tests/owned-python-packaging.test.mjs tests/owned-python-scalar-packaging.test.mjs"
	, contracts: "node --test tests/perl-contract.test.mjs tests/test-profiles.test.mjs tests/checked-javascript.test.mjs tests/cli-package.test.mjs tests/owned-python-package.test.mjs"
};
export const ownedPythonScope = { profiles: ["pypi"]
	, companions: ["c", "cpp", "cargo"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: true, hostCallbackLifetime: "call"
	, higherOrderCallbacks: true, boxedRecursion: true, primitives: 19
	, transferredInputs: false, anchoredResults: false, wasm: false
	, promotedCells: 0 };
export const ownedPythonExecutionSources = [...new Set([
	...ownedRustExecutionSources
	, ...ownedPythonAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, ...["runtime", "values", "package", "packaging", "scalar-packaging"].map(name => `tests/owned-python-${name}.test.mjs`)
	, "docs/consume/python.md", "src/backends/python/copied-model.mjs"
	, "tests/helpers/owned-python-installed-probes.mjs"
	, "tests/helpers/owned-python-scalars-fixture.mjs"
	, "tests/helpers/python-wheel-install.mjs"
	, "tests/fixtures/onboarding/owned-scalars/Owned.lean"
	, "tests/fixtures/onboarding/owned-scalars/lean-bridge.exports.json"
])].sort();
const json = async path => JSON.parse(await readFile(path, "utf8"));
const nativeModel = input => createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true });
const environments = ["3.11-minimum", "3.11-current", "3.12-standard"];
const typing = ["4.6.0", "4.16.0", null];
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};
const fileIdentity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });

const installation = (value, index) => {
	assert.equal(value.resolvedOffline, true);
	assert.equal(value.python, index === 2 ? "3.12.14" : "3.11.16");
	assert.deepEqual(value.requires, ['typing_extensions (<5,>=4.6); python_version < "3.12"']);
	if(index === 2) assert.equal(value.dependency, null);
	else
	{
		assert.equal(value.dependency.name, "typing_extensions");
		assert.equal(value.dependency.version, typing[index]);
		assert.equal(value.dependency.archive, `typing_extensions-${typing[index]}-py3-none-any.whl`);
		assert.ok(value.dependency.bytes > 0); assert.match(value.dependency.sha256, /^[a-f0-9]{64}$/u);
	}
};

const compiled = (report, mode, scalar, sources) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219); assert.equal(report.mode, mode);
	for(const flag of ["compiledLean", "installedPackage", "sourceUnchanged"
		, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
		, "handoffRemovedBeforeRelocatedExecution", "ordinaryImport"])
		assert.equal(report[flag], true, flag);
	const { input, componentReceipt: component, adapterReceipt: adapter, packageSetReceipt: receipt } = report;
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sources["src/analyze/NativeExports.lean"]);
	const fixture = scalar ? "owned-scalars" : "owned-cpp-composition";
	assert.equal(input.sourceIdentity.modules[0].source.sha256, sources[`tests/fixtures/onboarding/${fixture}/Owned.lean`]);
	const model = nativeModel(input), native = generateCompiledNativeLeanAdapters(model);
	assert.equal(model.schemaVersion, 7); assert.equal(model.exports.length, scalar ? 8 : 31);
	const c = generateOwnedCPackage({ ...input, hostCallbacks: true });
	const python = generateOwnedPythonPackage(model.bindingIr);
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.metadataSha256, sha256(canonicalJson(input.metadata)));
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(adapter.schemaVersion, 3); assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
	assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	assert.deepEqual(adapter.pythonValues, python.contract);
	const companions = mode === "reviewed" && !scalar;
	const cpp = companions ? generateOwnedCppPackage(model.bindingIr) : null;
	const rust = companions ? generateOwnedRustPackage(model.bindingIr) : null;
	assert.deepEqual(adapter.cppValues ?? null, cpp?.contract ?? null);
	assert.deepEqual(adapter.rustValues ?? null, rust?.contract ?? null);
	const files = { ...c.files, ...cpp?.files, "internal/python-abi.h": python.abiHeader
		, ...rust ? { "internal/rust-abi.h": rust.abiHeader } : {} };
	for(const [path, source] of Object.entries(files)) assert.deepEqual(adapter.files[path], fileIdentity(source));
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
	assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), companions ? ["c", "cargo", "cpp", "pypi"] : ["pypi"]);
	const pkg = receipt.packages.find(pkg => pkg.target === "pypi");
	assert.equal(pkg.name, scalar ? "owned-scalar-values" : "owned-values");
	assert.equal(pkg.version, "1.2.3"); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(pkg.artifacts.length, 1); assert.match(pkg.artifacts[0].path, /^archives\/owned_(?:scalar_)?values-1\.2\.3-py3-none-manylinux_2_36_x86_64\.whl$/u);
	assert.ok(pkg.artifacts[0].bytes > 1_000_000); assert.match(pkg.artifacts[0].sha256, /^[0-9a-f]{64}$/u);
	return { model, python, component, adapter };
};

const packageReport = async (report, mode, sources) => {
	const { model, python, component, adapter } = compiled(report, mode, false, sources);
	assert.equal(report.deterministicReassembly, true);
	assert.deepEqual(report.companions, mode === "reviewed" ? { c: 693, cpp: 577, rust: 596 } : {});
	assert.deepEqual(report.tamperRejected, ["lifetime", "source", "abi", "library"]);
	assert.equal(report.consumerSha256, sources["tests/fixtures/structured-types/owned-installed-python.py"]);
	assert.equal(report.loaderProbeSha256, sha256(ownedPythonInstalledProbe));
	if(mode === "ordinary") assert.equal(report.dependencies, null);
	else
	{
		const lock = await copiedRustLock("owned-values", "1.2.3");
		assert.equal(report.dependencies.lockSha256, sha256(lock));
		assert.equal(report.dependencies.archive, "rust-dependencies.tar.gz");
		assert.match(report.dependencies.sha256, /^[a-f0-9]{64}$/u);
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
	}
	const docs = await readFile("docs/consume/python.md", "utf8");
	const example = docs.split("### Resource-containing values\n")[1].split("```python\n")[1].split("\n```\n")[0] + "\n";
	assert.equal(report.documentationSha256, sha256(example));
	assert.deepEqual(report.observations.map(item => item.name), environments);
	for(const [index, observed] of report.observations.entries())
	{
		installation(observed.installation, index);
		assert.equal(observed.checks, 120); assert.equal(observed.relocatedChecks, 120); assert.equal(observed.rejectedTypes, 13);
		assert.deepEqual(observed.loaderRejected, ["unverified-runtime", "changed-library", "symlink-library"]);
		assert.deepEqual(observed.loader, { consumer: { checks: 120, ordinaryImport: true }
			, liveIdentities: 0, runtimeInitializations: 1, componentInitializations: 1
			, compatibleImports: 5, concurrentImports: 4
			, conflictingRuntimeRejected: true, forkWithHeldLockRejected: true });
		const manifest = observed.manifest, module = python.packageDir;
		assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.kind, "lean-bridge-owned-python-package");
		assert.equal(manifest.ecosystem, "pypi"); assert.equal(manifest.moduleName, module);
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256); assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
		assert.deepEqual(manifest.ownedValues, python.contract); assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
		assert.equal(manifest.glibcMinimumVersion, "2.36"); assert.equal(manifest.tag, "py3-none-manylinux_2_36_x86_64");
		const libraries = Object.fromEntries(Object.entries(manifest.files).filter(([path]) => path.startsWith(`${module}/native/linux-x64/`)).map(([path, file]) => [path.split("/").at(-1), file.sha256]));
		const evidence = { runtimeIdentity: component.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: python.contract, library: adapter.library, libraries };
		assert.equal(libraries[adapter.library], adapter.files[`lib/${adapter.library}`].sha256);
		assert.equal(libraries[component.library], component.nativeLibrary.sha256);
		assert.equal(libraries["libgmp.so.10"], adapter.files["gmp/lib/libgmp.so.10"].sha256);
		assert.ok(libraries["liblean_bridge_native.so"]); assert.ok(libraries["libleanshared.so"]);
		const generated = generateOwnedPythonPackage(model.bindingIr, evidence);
		for(const [path, source] of Object.entries(generated.files))
			assert.deepEqual(manifest.files[path.startsWith(`${module}/`) ? path : `${module}/lean_bridge/${path}`], fileIdentity(source));
		for(const path of ["component/callbacks.c", "internal/python-abi.h", "sources/gmp-6.3.0.tar.xz"])
			assert.ok(manifest.files[`${module}/lean_bridge/${path}`]?.bytes > 0, path);
		assert.ok(manifest.files["owned_values-1.2.3.dist-info/licenses/Lean-LICENSE"]?.bytes > 0);
	}
};

/**
 * Reject missing executions, changed lifetimes and unsupported installed claims.
 *
 * @param record - Immutable executions, inputs, source identities and receipts.
 */
export const assertOwnedPythonExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-python-execution"); assert.equal(record.baselineRevision, ownedPythonBaseline);
	assert.deepEqual(record.scope, ownedPythonScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedPythonCommands).sort());
	for(const [name, count] of Object.entries({ core: 9, packages: 4, contracts: 57 })) passing(record.runs[name], ownedPythonCommands[name], count);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedPythonExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedRubyHistoricalBytes(path, await readFile(path), digest)), digest, path);
	const historicalRust = await json(ownedRustExecutionPath);
	const foundation = await json("docs/evidence/owned-python-values-20260927.json");
	for(const collection of [record.runtime, record.values, record.scalars, record.packages, record.scalarPackages])
		assert.deepEqual(Object.keys(collection).sort(), ["ordinary", "reviewed"]);
	for(const mode of ["ordinary", "reviewed"])
	{
		const runtime = record.runtime[mode];
		assert.equal(runtime.compiledLean, true); assert.equal(runtime.installedPackage, false);
		assert.equal(runtime.sourceIdentitySha256, sha256(canonicalJson(historicalRust.inputs.runtime[mode].sourceIdentity)));
		assert.equal(runtime.runtimeSha256, sha256(ownedPythonRuntime("owned_aggregates")));
		assert.equal(runtime.probeSha256, record.sources["tests/fixtures/structured-types/owned-python-runtime.py"]);
		assert.deepEqual(runtime.observations, [
			{ python: "3.11.16", checks: 324, pythonFailures: 5, nativeFailures: 4, live: 0, identities: 0 }
			, { python: "3.12.14", checks: 325, pythonFailures: 5, nativeFailures: 4, live: 0, identities: 0 }
		]);
		for(const scalar of [false, true])
		{
			const report = (scalar ? record.scalars : record.values)[mode], fixture = scalar ? "scalars" : "values";
			const original = foundation.reports[`${fixture}${mode === "ordinary" ? "Ordinary" : "Reviewed"}`];
			assert.equal(report.sourceIdentitySha256, original.sourceIdentitySha256);
			assert.deepEqual(report.bindingIr, foundation.bindingInputs[original.bindingIrSha256]);
			const generated = generateOwnedPythonConversions(report.bindingIr);
			assert.equal(report.compiledLean, true); assert.equal(report.installedPackage, false);
			assert.equal(report.runtimeSha256, sha256(ownedPythonRuntime(generated.c.prefix)));
			assert.equal(report.valuesSha256, sha256(generated.valuesSource)); assert.equal(report.conversionsSha256, sha256(generated.source));
			assert.equal(report.probeSha256, record.sources[`tests/fixtures/structured-types/owned-python-${fixture}.py`]);
			const expected = environments.flatMap((name, index) => {
				const base = { name, typing: typing[index], live: 0, identities: 0 };
				return scalar ? [{ ...base, mode: "normal", checks: 353, primitives: 19, pythonFaults: 30, pythonCheckpoints: 30, nativeFaults: 23 }]
					: [{ ...base, mode: "normal", checks: 604, pythonFaults: 104, nativeFaults: 110 }
						, { ...base, mode: "malformed", checks: 216 }
						, { ...base, mode: "callbacks", checks: 392, pythonFaults: 71, pythonCheckpoints: 71, nativeFaults: 101, boundedInvocations: 819 }];
			});
			assert.deepEqual(report.observations, expected);
			if(!scalar) assert.equal(report.callbacksSha256, record.sources["tests/fixtures/structured-types/owned-python-callables.py"]);
		}
		await packageReport(record.packages[mode], mode, record.sources);
		const scalars = record.scalarPackages[mode];
		const { model, python } = compiled(scalars, mode, true, record.sources);
		assert.deepEqual(scalars.bindingIr, model.bindingIr); assert.equal(scalars.primitives, 19);
		const source = (await readFile("tests/fixtures/structured-types/owned-installed-python-scalars.py", "utf8")).replace("__PACKAGE__", python.packageDir);
		assert.equal(scalars.consumerSha256, sha256(source));
		assert.deepEqual(scalars.observations.map(item => item.name), environments);
		for(const [index, observed] of scalars.observations.entries())
		{
			installation(observed.installation, index);
			assert.deepEqual(observed.result, { checks: 146, primitives: 19, ordinaryImport: true });
			assert.equal(observed.relocatedChecks, 146);
		}
	}
};

/**
 * Preserve predecessor evidence without promoting unrelated support cells.
 *
 * @param record - Complete source deltas and immutable execution linkage.
 */
export const assertOwnedPythonIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-python-integration"); assert.equal(record.baselineRevision, ownedPythonBaseline);
	assert.deepEqual(record.scope, ownedPythonScope);
	for(const [entry, path] of [[record.previous, ownedRustHistoryPath], [record.execution, ownedPythonExecutionPath]])
	{ assert.equal(entry.path, path); assert.equal(sha256(await readFile(path)), entry.sha256); }
	const previous = await json(record.previous.path);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedPythonChangedPaths, ...ownedPythonAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	assert.deepEqual(record.updates.map(update => update.path).sort(), ownedPythonChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedPythonAddedPaths);
	const updates = new Map(record.updates.map(update => [update.path, update])), restored = {};
	for(const path of paths)
	{
		const current = ownedRubyHistoricalBytes(path, await readFile(path), record.sourceHashes[path]);
		assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update) restored[path] = reverseOwnedPythonUpdate(current.toString("utf8"), update);
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { irSchema, consumers } = await readTypeSurface(), contracts = { irSchema, consumers };
	const document = JSON.parse(beforeOwnedRuby("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	const previousDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
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
	await assertOwnedPythonExecution(await json(record.execution.path));
	await assertOwnedRustIntegration(previous);
};
