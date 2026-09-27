/**
 * Authenticate owned Ruby gems, compiled semantics and exact source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { ownedRubyAdapterSources } from "../../src/build/owned-ruby-artifacts.mjs";
import { gmpIdentity } from "../../src/backends/c/gmp.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { ownedPythonExecutionSources, assertOwnedPythonIntegration } from "./owned-python-evidence.mjs";
import { ownedPythonHistoryPath } from "./owned-python-source-history.mjs";
import { assertOwnedRubyConversions } from "./owned-ruby-conversion-evidence.mjs";
import { assertRubyRecursiveFaults } from "./ruby-recursive-callable-install.mjs";
import { assertRubyStructuredFaults } from "./ruby-structured-callable-install.mjs";
import { ownedRubyBaseline, ownedRubyChangedPaths, ownedRubyAddedPaths, ownedRubyExecutionPath, reverseOwnedRubyUpdate, ownedRubyHistoricalBytes } from "./owned-ruby-source-history.mjs";
import { beforeOwnedDotnet, ownedDotnetHistoricalBytes } from "./owned-dotnet-source-history.mjs";

export const ownedRubyScope = { profiles: ["rubygems"]
	, companions: ["c", "cpp", "cargo", "pypi"]
	, paths: ["ordinary-source", "reviewed-ir"], installedPackage: true
	, hostCallbackConstruction: true, hostCallbackLifetime: "call"
	, higherOrderCallbacks: true, boxedRecursion: true, primitives: 19
	, transferredInputs: false, anchoredResults: false, wasm: false
	, promotedCells: 0 };
export const ownedRubyCommands = {
	packages: "LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels LEAN_BRIDGE_OWNED_NATIVE_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-concurrency=1 tests/owned-ruby-packaging.test.mjs tests/owned-ruby-coexistence.test.mjs"
	, copied: "LEAN_BRIDGE_RUBY_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-name-pattern='prepared recursive Ruby gems' tests/ruby-graph-package.test.mjs"
	, callbacks: "LEAN_BRIDGE_RUBY=/tmp/lean-bridge-owned-ruby-CCfjCR/.toolchains/ruby33/bin/ruby LEAN_BRIDGE_GEM=/tmp/lean-bridge-owned-ruby-CCfjCR/.toolchains/ruby33/bin/gem LEAN_BRIDGE_RUBY_CALLABLE_TEST=1 LEAN_BRIDGE_RUBY_STRUCTURED_CALLABLE_TEST=1 LEAN_BRIDGE_RUBY_RECURSIVE_CALLABLE_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-concurrency=1 tests/ruby-callables.test.mjs tests/ruby-structured-callables.test.mjs tests/ruby-recursive-callables.test.mjs"
};
export const ownedRubyExecutionSources = [...new Set([
	...ownedPythonExecutionSources
	, ...ownedRubyAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, ...ownedRubyChangedPaths.filter(path => path.startsWith("src/"))
	, ...["runtime", "values", "layout", "conversions", "gmp", "package", "packaging", "coexistence"].map(name => `tests/owned-ruby-${name}.test.mjs`)
	, ...["callables", "structured-callables", "recursive-callables", "graph-package"].map(name => `tests/ruby-${name}.test.mjs`)
	, ...["copied-model", "copied-values", "copied-conversions", "copied-graph-runtime", "copied-graph-conversions", "copied-graph-package", "callables", "callable-graph-model", "callable-graph-conversions", "callable-graph-package"].map(name => `src/backends/ruby/${name}.mjs`)
	, "docs/consume/ruby.md", "docs/publish/rubygems.md"
	, "tests/helpers/owned-python-scalars-fixture.mjs"
	, "tests/helpers/ruby-recursive-callable-install.mjs"
	, "tests/helpers/ruby-recursive-callable-docs.mjs"
	, "tests/helpers/ruby-structured-callable-install.mjs"
	, "tests/helpers/native-recursive-callable-fixture.mjs"
	, "tests/fixtures/callable-consumers/ruby.rb"
	, ...["ruby", "ruby-values", "ruby-faults", "ruby-recursive", "ruby-recursive-faults", "ruby-recursive-lifetimes", "ruby-recursive-ownership", "ruby-recursive-poison"].map(name => `tests/fixtures/structured-callable-consumers/${name}.rb`)
])].sort();
const referencePaths = ["foundation", "conversions", "gmp", "loading"].map(name => `docs/evidence/owned-ruby-${name}-20260927.json`);
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const identity = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
	assert.doesNotMatch(run.text, /^not ok/mu);
};
const files = value => {
	assert.ok(Object.keys(value).length > 0);
	for(const file of Object.values(value))
	{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
};

/**
 * Reconstruct one installed gem from the recorded compiler input.
 *
 * @param report - Original compilation, installation and relocation report.
 * @param mode - Ordinary source or independently reviewed IR.
 * @param scalar - Whether the fixture covers every primitive field.
 * @param sources - Exact source hashes from the execution record.
 */
export const assertOwnedRubyPackageReport = async (report, mode, scalar, sources) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219); assert.equal(report.mode, mode);
	for(const flag of ["compiledLean", "installedPackage", "sourceUnchanged"
		, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
		, "handoffRemovedBeforeRelocatedExecution", "gemCacheRemoved"
		, "deterministicReassembly", "ordinaryRequire"])
		assert.equal(report[flag], true, flag);
	const { input, componentReceipt: component, adapterReceipt: adapter, packageSetReceipt: receipt, manifest } = report;
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sources["src/analyze/NativeExports.lean"]);
	assert.equal(input.sourceIdentity.modules[0].source.sha256, sources[`tests/fixtures/onboarding/${scalar ? "owned-scalars" : "owned-cpp-composition"}/Owned.lean`]);
	const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true });
	const native = generateCompiledNativeLeanAdapters(model), c = generateOwnedCPackage({ ...input, hostCallbacks: true });
	const ruby = generateOwnedRubyPackage(model.bindingIr);
	assert.equal(model.schemaVersion, 7); assert.equal(model.exports.length, scalar ? 8 : 31);
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.metadataSha256, sha256(canonicalJson(input.metadata)));
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(adapter.schemaVersion, 1); assert.equal(adapter.profile, "native-library-v1");
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 2
		, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source)
		, hostCallbacks: model.ownedGraph.hostCallbacks });
	assert.deepEqual(adapter.rubyValues, ruby.contract);
	const gmp = "libgmp-lean-bridge.so.10";
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: gmp, binding: "local-symbols" });
	const generatedSources = ownedRubyAdapterSources(c, ruby);
	for(const [path, source] of Object.entries(generatedSources)) assert.deepEqual(adapter.files[path], identity(source));
	const gmpFiles = ["include/gmp.h", `lib/${gmp}`, "share/lean-bridge/gmp.json"
		, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	assert.deepEqual(Object.keys(adapter.files).sort(), [...Object.keys(generatedSources), `lib/${adapter.library}`, ...gmpFiles.map(path => `gmp/${path}`)].sort());
	assert.equal(adapter.files["gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"].sha256, gmpIdentity.sha256);
	files(adapter.files); files(manifest.files);
	assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
	assert.equal(manifest.ecosystem, "rubygems"); assert.equal(manifest.name, "owned-values"); assert.equal(manifest.version, "1.2.3");
	assert.deepEqual(manifest.component, model.component); assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256); assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
	assert.equal(manifest.glibcMinimumVersion, "2.36"); assert.deepEqual(manifest.ownedValues, ruby.contract);
	assert.equal(manifest.namespace, ruby.namespace); assert.equal(manifest.requirePath, ruby.requirePath);
	const libraries = Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => path.startsWith(`lib/${ruby.requirePath}/native/linux-x64/`))
		.map(([path, file]) => [path.split("/").at(-1), file.sha256]));
	assert.deepEqual(Object.keys(libraries).sort(), [adapter.library, component.library, gmp, "libleanshared.so", "liblean_bridge_native.so"].sort());
	assert.equal(libraries[adapter.library], adapter.files[`lib/${adapter.library}`].sha256);
	assert.equal(libraries[component.library], component.nativeLibrary.sha256);
	assert.equal(libraries[gmp], adapter.files[`gmp/lib/${gmp}`].sha256);
	const generated = generateOwnedRubyPackage(model.bindingIr, {
		runtimeIdentity: component.runtimeIdentity, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, ownedValues: ruby.contract, library: adapter.library, libraries
	});
	for(const [path, source] of Object.entries(generated.files)) assert.deepEqual(manifest.files[path], identity(source), path);
	for(const [path, file] of Object.entries(adapter.files).filter(([path]) => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")))
		assert.deepEqual(manifest.files[`lean-bridge/adapter/${path}`], file);
	for(const [path, source] of Object.entries({
		"native-component.json": canonicalJson(component)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "generated.lean": native.leanSource, "component.h": native.header
		, "callbacks.c": native.callbackSource
	})) assert.deepEqual(manifest.files[`lean-bridge/component/${path}`], identity(source));
	assert.deepEqual(manifest.files["lean-bridge/native-ruby-adapter.json"], identity(canonicalJson(adapter)));
	assert.equal(manifest.files["lean-bridge/runtime.json"].sha256, component.runtimeIdentity);
	assert.ok(manifest.files["lean-bridge/licenses/Lean-LICENSE"].bytes > 0);
	assert.equal(report.needed[0], gmp); assert.ok(report.needed.includes(component.library)); assert.ok(report.needed.includes("libleanshared.so"));
	assert.deepEqual(report.tamperRejected, ["lifetime", "source", "boundary", "abi", "gmp-receipt", "gmp-source", "library", "unrecorded"]);
	assert.deepEqual(report.loaderRejected, ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]);
	const observation = { checks: scalar ? 147 : 77, ordinaryRequire: true, ...scalar ? { primitives: 19 } : {} };
	assert.deepEqual(report.observation, observation); assert.deepEqual(report.relocatedObservation, observation);
	assert.deepEqual(report.loader, { consumer: observation, liveIdentities: 0
		, runtimeInitializations: 1, componentInitializations: 1
		, privateGmp: true, forkBeforeLock: true, concurrentRequires: 4 });
	const source = (await readFile(`tests/fixtures/structured-types/owned-installed-ruby${scalar ? "-scalars" : ""}.rb`, "utf8"))
		.replaceAll("__REQUIRE__", ruby.requirePath).replaceAll("__NAMESPACE__", ruby.componentName);
	assert.equal(report.consumerSha256, sha256(source));
	assert.equal(report.loaderProbeSha256, sources["tests/fixtures/structured-types/owned-ruby-installed-loader.rb"]);
	const combined = mode === "reviewed" && !scalar;
	assert.deepEqual(report.companions, combined ? { c: 693, cpp: 577, rust: 596, python: 120 } : {});
	if(combined)
	{
		assert.equal(report.dependencies.lockSha256, sha256(await copiedRustLock("owned-values", "1.2.3")));
		assert.equal(report.dependencies.archive, "rust-dependencies.tar.gz"); digest(report.dependencies.sha256);
		for(const dependency of report.dependencies.packages)
		{ digest(dependency.checksum); digest(dependency.manifestSha256); assert.ok(dependency.files > 0); }
	}
	else assert.equal(report.dependencies, null);
	if(scalar) assert.equal(report.documentation, null);
	else
	{
		const example = (await readFile("docs/consume/ruby.md", "utf8")).split("### Resource-containing values\n")[1].split("```ruby\n")[1].split("\n```")[0] + "\n";
		assert.deepEqual(report.documentation, { sha256: sha256(example), stdout: "42\n42\n" });
	}
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
	assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), combined ? ["c", "cargo", "cpp", "pypi", "rubygems"] : ["rubygems"]);
	for(const pkg of receipt.packages) assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
	const pkg = receipt.packages.find(pkg => pkg.target === "rubygems");
	assert.equal(pkg.name, "owned-values"); assert.equal(pkg.version, "1.2.3"); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].path, "archives/owned-values-1.2.3-x86_64-linux.gem");
	assert.ok(pkg.artifacts[0].bytes > 1_000_000); digest(pkg.artifacts[0].sha256);
};

const predecessors = async record => {
	assert.deepEqual(record.references.map(item => item.path), referencePaths);
	const records = [];
	for(const reference of record.references)
	{
		const bytes = await readFile(reference.path);
		assert.equal(reference.sha256, sha256(bytes)); assert.equal(reference.bytes, bytes.length);
		records.push(JSON.parse(bytes));
	}
	const [, conversions, gmp, loading] = records;
	await assertOwnedRubyConversions(conversions);
	for(const original of [gmp, loading]) for(const item of original.sources)
	{
		const bytes = ownedRubyHistoricalBytes(item.path, await readFile(item.path), item.sha256);
		assert.deepEqual(identity(bytes), { bytes: item.bytes, sha256: item.sha256 }, item.path);
	}
	assert.equal(gmp.defaultRegression.exitCode, 0); assert.equal(gmp.defaultRegression.report.defaultArtifactsByteIdentical, true);
	assert.equal(gmp.defaultRegression.report.baseline, ownedRubyBaseline);
	assert.equal(gmp.defaultRegression.report.currentSourceSha256, record.sources["src/build/native-gmp.mjs"]);
	passing({ ...gmp.command, text: gmp.command.stdout }, "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-ruby-gmp.test.mjs", 2);
	const observation = gmp.report.report.observation;
	assert.equal(observation.roundTrips, 500); assert.equal(observation.bundledVersion, "6.3.0");
	for(const key of ["privateWithDeepBind", "rubyAllocatorsUnchanged", "privateAllocatorsIndependent", "leanAllocatorsIndependent"])
		assert.equal(observation[key], true);
	assert.equal(gmp.report.sha256, sha256(canonicalJson(gmp.report.report)));
	passing({ ...loading.commands[0], text: loading.commands[0].stdout }, "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-ruby-package.test.mjs", 3);
	assert.deepEqual(loading.reports.map(item => item.path), ["ordinary", "reviewed"].map(mode => `build/owned-ruby-loading/${mode}.json`));
	for(const [index, item] of loading.reports.entries())
	{
		const report = item.report;
		assert.equal(item.sha256, sha256(canonicalJson(report))); assert.equal(report.installedPackage, false);
		for(const key of ["compiledLean", "compilerWorkspaceRemoved", "relocated", "rejectsMnThreads", "rejectsSymlinkLibrary", "rejectsTamperedLibrary", "rejectsUnverifiedPreload"])
			assert.equal(report[key], true);
		assert.deepEqual(report.observation, { checks: 17, forkBeforeLock: true, identities: 0, privateGmp: true });
		const generated = generateOwnedRubyPackage(conversions.reports[index].report.bindingIr, report.evidence);
		assert.deepEqual(generated.contract, report.contract);
		assert.deepEqual(Object.fromEntries(Object.entries(generated.files).map(([path, text]) => [path, sha256(text)])), report.generatedFiles);
	}
};

const regressions = async record => {
	const copied = record.regressions.copied;
	assert.equal(copied.installedPackage, true);
	assert.deepEqual(copied.observations.map(run => run.reviewed), [false, true]);
	for(const run of copied.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.checkedSourceUnchanged, true); assert.equal(run.deterministicReassembly, true);
		assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 4);
		const installed = run.installed;
		assert.deepEqual(installed.public, { checks: 179, functions: 18, rejected: 65, ruby: "3.3.12", threadedCalls: 256 });
		assert.deepEqual(installed.faults, { asynchronousInterruptions: 2
			, checkpoints: 157, checks: 1089, exactlyOnceCleanup: true
			, inputFailures: 93, outputFailures: 64, ownedOutputs: 132 });
		for(const key of ["offlineInstall", "compilerFreeExecution"
			, "relocatedInstallation", "authorSourcesRemoved", "handoffRemoved"
			, "gemCacheRemoved", "buildMetadataNotRequired", "rejectsTamperedAssets"
			, "rejectsSymlinkAssets", "rejectsManyToManyThreads"
			, "installedFilesUnchanged"])
			assert.equal(installed[key], true, key);
		assert.deepEqual(installed.composition.map(item => `${item.order}/${item.mode}`), ["recursive-first/raw", "recursive-first/during", "acyclic-first/raw", "acyclic-first/during"]);
		for(const item of installed.composition)
		{
			assert.equal(item.components, 3); assert.equal(item.handles, 8); assert.equal(item.retirementClears, 1);
			for(const flag of ["crossPackageRetirement", "forkRejection", "forkWithLockHeld", "ractorRejection", "retainedValuesUsable"]) assert.equal(item[flag], true);
		}
		assert.equal(installed.installedPackages.length, 3);
		for(const installedPackage of installed.installedPackages) files(installedPackage.files);
		const example = (await readFile("docs/consume/ruby.md", "utf8")).split("### Recursive values\n")[1].split("```ruby\n")[1].split("\n```")[0] + "\n";
		assert.deepEqual(installed.documentation, { sourceSha256: sha256(example), stdout: "7\n" });
	}
	const old = await json("docs/evidence/ruby-recursive-callables-20260925.json");
	const groups = { primitive: old.regressions.primitive.reports, structured: old.regressions.structured.reports, recursive: old.reports };
	for(const [name, previous] of Object.entries(groups))
	{
		const reports = record.regressions[name].reports;
		assert.deepEqual(reports.map(item => item.path), ["ordinary-source", "reviewed-ir"]);
		for(const [index, run] of reports.entries())
		{
			assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.packages.length, 1);
			assert.equal(run.packages[0].target, "rubygems"); digest(run.packages[0].artifacts[0].sha256);
			if(name === "primitive")
			{
				assert.equal(run.checks, previous[index].checks); assert.equal(run.compilerFreePath, true); assert.equal(run.offlineInstall, true);
				assert.deepEqual(run.signatures, previous[index].signatures);
				assert.equal(run.consumerSha256, record.sources["tests/fixtures/callable-consumers/ruby.rb"]);
			}
			else
			{
				const installed = run.installation;
				assert.deepEqual(installed.public, previous[index].installation.public);
				for(const flag of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "gemCacheRemoved", "repeatExecution", "installedFilesUnchanged"])
					assert.equal(installed[flag], true);
				assert.deepEqual(installed.documentation, previous[index].installation.documentation);
				assert.deepEqual(installed.sourceHashes, previous[index].installation.sourceHashes);
				files(installed.installedFiles); digest(installed.installedReceiptSha256);
				assert.equal(installed.isolatedInMemoryFaultProbe, true);
				assert.deepEqual(installed.faults, previous[index].installation.faults);
				if(name === "recursive")
				{
					assertRubyRecursiveFaults(installed.faults);
					assert.equal(installed.lifetimes.identities, 0); assert.equal(installed.ownershipChecks, 9);
					assert.equal(installed.malformedOutputRetiresRuntime, true); assert.deepEqual(installed.counterfactuals, previous[index].installation.counterfactuals);
					assert.deepEqual(installed.acyclic, record.regressions.structured.reports[index].installation.public);
					assert.equal(installed.lifetimes.creator_exit_rejections, 16); assert.equal(installed.lifetimes.capacity, 4096);
					for(const flag of ["overflow_rejected", "replacement_usable", "finalization_released"]) assert.equal(installed.lifetimes[flag], true);
				}
				else assertRubyStructuredFaults(installed.faults);
			}
		}
	}
};

/**
 * Require compiled execution, original installed gems and exact generated APIs.
 *
 * @param record - Immutable terminal logs, observations, inputs and receipts.
 */
export const assertOwnedRubyExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219); assert.equal(record.kind, "owned-ruby-execution");
	assert.equal(record.baselineRevision, ownedRubyBaseline); assert.deepEqual(record.scope, ownedRubyScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedRubyCommands).sort());
	for(const [name, count] of Object.entries({ packages: 5, copied: 1, callbacks: 3 })) passing(record.runs[name], ownedRubyCommands[name], count);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedRubyExecutionSources);
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedDotnetHistoricalBytes(path, await readFile(path), hash)), hash, path);
	await predecessors(record);
	for(const collection of [record.packages, record.scalarPackages]) assert.deepEqual(Object.keys(collection).sort(), ["ordinary", "reviewed"]);
	for(const mode of ["ordinary", "reviewed"])
	{
		await assertOwnedRubyPackageReport(record.packages[mode], mode, false, record.sources);
		await assertOwnedRubyPackageReport(record.scalarPackages[mode], mode, true, record.sources);
	}
	const coexistence = record.coexistence;
	assert.equal(coexistence.schemaVersion, 1); assert.equal(coexistence.planNode, 1219);
	for(const flag of ["installedPackage", "authorRemoved", "handoffsRemoved", "gemCachesRemoved", "relocated"]) assert.equal(coexistence[flag], true);
	assert.equal(coexistence.consumerSha256, record.sources["tests/fixtures/structured-types/owned-ruby-coexistence.rb"]);
	assert.deepEqual(coexistence.observations, ["copied-first", "owned-first"].flatMap(order => ["copied", "owned"].map(retiredBy =>
		({ order, retiredBy, rejectedCalls: 3, liveIdentities: 0, components: 3, runtimeInitializations: 1, libraries: 9, threadedCalls: 64 }))));
	assert.deepEqual(coexistence.packageSetReceipts.map(receipt => receipt.component.name), ["owned-aggregates", "owned-peer", "copied-peer"]);
	assert.equal(new Set(coexistence.packageSetReceipts.map(receipt => receipt.profiles[0].runtimeIdentity)).size, 1);
	for(const receipt of coexistence.packageSetReceipts)
	{ assert.equal(receipt.packages.length, 1); assert.equal(receipt.packages[0].target, "rubygems"); digest(receipt.packages[0].artifacts[0].sha256); }
	await regressions(record);
};

/**
 * Preserve all predecessor records without promoting unrelated support cells.
 *
 * @param record - Complete exact source deltas and immutable execution linkage.
 */
export const assertOwnedRubyIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-ruby-integration"); assert.equal(record.baselineRevision, ownedRubyBaseline);
	assert.deepEqual(record.scope, ownedRubyScope);
	for(const [entry, path] of [[record.previous, ownedPythonHistoryPath], [record.execution, ownedRubyExecutionPath]])
	{ assert.equal(entry.path, path); assert.equal(sha256(await readFile(path)), entry.sha256); }
	const previous = await json(record.previous.path);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedRubyChangedPaths, ...ownedRubyAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	assert.deepEqual(record.updates.map(update => update.path).sort(), ownedRubyChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedRubyAddedPaths);
	const updates = new Map(record.updates.map(update => [update.path, update])), restored = {};
	for(const path of paths)
	{
		const current = ownedDotnetHistoricalBytes(path, await readFile(path), record.sourceHashes[path]);
		assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update) restored[path] = reverseOwnedRubyUpdate(current.toString("utf8"), update);
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { document: currentDocument, ...contracts } = await readTypeSurface(); void currentDocument;
	const document = JSON.parse(beforeOwnedDotnet("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
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
	await assertOwnedRubyExecution(await json(record.execution.path));
	await assertOwnedPythonIntegration(previous);
};
