/**
 * Bind owned JVM package claims to original archives, sources and terminal tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { jvmProbeRepairBytes } from "./jvm-probe-repair-history.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { gmpIdentity } from "../../src/backends/c/gmp.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { generateCopiedJvmKotlinPackage } from "../../src/backends/jvm/copied-kotlin.mjs";
import { ownedJvmAdapterSources } from "../../src/build/owned-jvm-artifacts.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { ownedJvmInstalledFixture, ownedJvmDocumentationExamples } from "./owned-jvm-installed.mjs";
import { assertOwnedJvmCalls, ownedJvmCallReceipt, ownedJvmCallSources } from "./owned-jvm-call-evidence.mjs";
import { ownedJvmConversionSources } from "./owned-jvm-conversion-evidence.mjs";
import { ownedJvmRuntimeSources } from "./owned-jvm-runtime-evidence.mjs";
import { assertOwnedJvmCi } from "./owned-jvm-ci.mjs";
import { assertNativeCiIsolation } from "./native-ci-isolation.mjs";
import { assertJvmGraphPackageReports } from "./jvm-graph-receipt.mjs";
import { jvmStructuredRegressionFixtures } from "./jvm-structured-callable-regression.mjs";
import { assertManagedCiIsolationEvidence } from "./managed-ci-isolation-evidence.mjs";
import { managedCiIsolationPath } from "./managed-ci-isolation-history.mjs";
import { ownedJvmBaseline, ownedJvmExecutionPath, ownedJvmChangedPaths, ownedJvmAddedPaths, ownedJvmGeneratedPaths, ownedJvmSortedGeneratedPaths, reverseOwnedJvmUpdate } from "./owned-jvm-source-history.mjs";

const predecessor = JSON.parse(readFileSync(managedCiIsolationPath, "utf8"));
export const ownedJvmExecutionSources = [...new Set([
	...Object.keys(predecessor.sources).filter(path => path.startsWith("src/"))
	, ...ownedJvmRuntimeSources, ...ownedJvmConversionSources
	, ...ownedJvmCallSources
	, ...ownedJvmAddedPaths.filter(path => /^(src|tests)\//u.test(path))
	, ...ownedJvmChangedPaths.filter(path => /^(src|tests)\//u.test(path))
	, ...["owned-scalars", "owned-dotnet-callables"].flatMap(name =>
		["Owned.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"]
			.map(file => "tests/fixtures/onboarding/" + name + "/" + file))
	, "scripts/lean-bridge.mjs", "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/publish/maven.md", "docs/contributing/testing.md"
	, "docs/architecture/binding-ir.md", "docs/lean/export-decisions.md"
])].sort();
export const ownedJvmPackageScope = {
	profiles: ["java", "kotlin"], paths: ["ordinary-source", "reviewed-ir"]
	, installedMaven: true, cliIntegrated: true, compilerFreeExecution: true
	, privateGmp: true, nativeThreadExit: true, synchronousCallbacks: true
	, higherOrderClosures: true, primitives: 19, boxedRecursion: true
	, transferredInputs: false, anchoredResults: false, wasm: false
	, generalJvmForkSupport: false, promotedCells: 0
};
export const ownedJvmPackageCommands = {
	packages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-packaging.test.mjs"
	, coexistence: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-jvm-coexistence.test.mjs"
	, documentation: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-jvm-documentation.test.mjs"
	, loaders: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/verified-jvm-assets.test.mjs"
	, ci: "node --test tests/owned-jvm-ci.test.mjs tests/managed-ci-isolation.test.mjs tests/native-ci-isolation.test.mjs"
	, copied: "LEAN_BRIDGE_JVM_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_JVM_GRAPH_INSTALLED_TEST=1 LEAN_BRIDGE_JVM_GRAPH_REPRO_TEST=1 LEAN_BRIDGE_JVM_GRAPH_LOADING_TEST=1 node --test --test-name-pattern='install offline|independent recursive|shared-runtime|before cold' tests/jvm-graph-package.test.mjs"
};
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const digest = hash => assert.match(hash, /^[a-f0-9]{64}$/u);
const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};
const files = inventory => {
	assert.ok(Object.keys(inventory).length > 0);
	for(const [path, file] of Object.entries(inventory))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
	}
};
const passing = (run, command, count) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(run.sha256, sha256(run.text));
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp("^# " + name + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok/mu);
};
const nativeFiles = manifest => Object.fromEntries(Object.entries(manifest.files)
	.filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/"))
	.map(([path, file]) => [basename(path), file.sha256]));
const archive = pkg => {
	assert.equal(pkg.target, "maven"); assert.equal(pkg.ecosystem, "maven");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.role, "component"); assert.equal(pkg.artifacts.length, 2);
	const jar = pkg.artifacts.find(file => file.path.endsWith(".jar"));
	const pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
	for(const file of [jar, pom])
	{ digest(file.sha256); assert.ok(file.bytes > 0); }
	return { jar, pom };
};
const installed = (run, pkg) => {
	const { jvm, observation, profile } = run, { jar, pom } = archive(pkg);
	assert.equal(observation.profile, profile); assert.deepEqual(observation.errors, []);
	flags(jvm, [
		"offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly"
		, "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution"
		, "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly"
		, "runtimeOverridesDisabled", "exactPublicSignatures"
		, "handoffRemovedBeforeExecution"]);
	assert.equal(jvm.archiveSha256, jar.sha256); assert.equal(jvm.pomSha256, pom.sha256);
	assert.deepEqual(jvm.deployment["package.jar"], { bytes: jar.bytes, sha256: jar.sha256 });
	assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]);
	assert.equal(jvm.javacVersion, "javac 22.0.2");
	assert.deepEqual(observation.nativeLibraries, jvm.nativeLibraries);
	assert.equal(observation.nativeRootCount, 1); assert.equal(Object.keys(jvm.nativeLibraries).length, 5);
	files(jvm.deployment); files(jvm.runtimeFiles); files(jvm.dependencies.files);
	for(const dependency of jvm.resolvedDependencies)
	{
		assert.equal(jvm.dependencies.files[dependency.mavenPath].sha256, dependency.sha256);
		assert.equal(jvm.deployment["dependencies/" + basename(dependency.mavenPath)].sha256, dependency.sha256);
	}
	assert.deepEqual(jvm.resolvedDependencies.map(item => item.mavenPath), [
		"org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"
		, "org/jetbrains/annotations/13.0/annotations-13.0.jar"
	]);
	for(const [key, value] of Object.entries(jvm)) if(key.endsWith("Sha256")) digest(value);
};

/**
 * Reconstruct native and managed sources and check both installed consumers.
 *
 * @param report - Original CLI build and offline installation observations.
 * @param scalar - Whether the package contains the all-primitive packet.
 * @param reviewed - Whether the author used independently reviewed IR.
 */
export const assertOwnedJvmPackageReport = async (report, scalar, reviewed) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.planNode, 1219);
	assert.equal(report.scalar, scalar); assert.equal(report.reviewed, reviewed);
	flags(report, [
		"compiledLean", "installedMaven", "cliIntegrated", "deterministicReassembly"
		, "receiptVerifiedWithoutProducer", "sourceUnchanged"
		, "sourceRemovedBeforeInstallation"]);
	const { input, componentReceipt: component, adapterReceipt: adapter, compiledProjection: compiled, manifest, package: pkg } = report;
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), reviewed);
	assert.equal(input.sourceIdentity.extractorSha256, sha256(jvmProbeRepairBytes(
		"src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), input.sourceIdentity.extractorSha256)));
	assert.equal(input.sourceIdentity.modules[0].source.sha256, sha256(await readFile(
		"tests/fixtures/onboarding/" + (scalar ? "owned-scalars" : "owned-dotnet-callables") + "/Owned.lean")));
	const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true });
	const native = generateCompiledNativeLeanAdapters(model), c = generateOwnedCPackage({ ...input, hostCallbacks: true });
	const projection = generateOwnedJvmPackage(model.bindingIr), generated = generateOwnedJvmPackage(model.bindingIr, compiled.evidence);
	assert.equal(model.exports.length, scalar ? 8 : 51);
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.metadataSha256, sha256(canonicalJson(input.metadata)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(component.sourceIdentity, input.sourceIdentity);
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(adapter.jvmValues, projection.contract);
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 2
		, hostCallbacks: model.ownedGraph.hostCallbacks
		, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) });
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
	const nativeSources = ownedJvmAdapterSources(c, projection);
	for(const [path, source] of Object.entries(nativeSources)) assert.deepEqual(adapter.files[path], identity(source), path);
	const gmpPaths = ["include/gmp.h", "lib/libgmp-lean-bridge.so.10"
		, "share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => "share/lean-bridge/licenses/GMP-" + name)];
	assert.deepEqual(Object.keys(adapter.files).sort(), [
		...Object.keys(nativeSources), "lib/" + adapter.library
		, ...gmpPaths.map(path => "gmp/" + path)
	].sort());
	assert.equal(adapter.files["gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"].sha256, gmpIdentity.sha256);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.namespace, projection.namespace);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(compiled.ownedValues, projection.contract);
	validateKotlinCompilation(compiled.kotlin, projection.namespace, { ownedValues: true });
	assert.match(compiled.compiler, /^javac 22(?:[.+ -]|$)/u);
	files(adapter.files); files(compiled.files); files(manifest.files);
	const libraries = nativeFiles(manifest), gmp = "libgmp-lean-bridge.so.10";
	assert.deepEqual(Object.keys(libraries).sort(), [adapter.library, component.library, gmp, "libleanshared.so", "liblean_bridge_native.so"].sort());
	assert.equal(libraries[adapter.library], adapter.files["lib/" + adapter.library].sha256);
	assert.equal(libraries[component.library], component.nativeLibrary.sha256);
	assert.equal(libraries[gmp], adapter.files["gmp/lib/" + gmp].sha256);
	assert.deepEqual(compiled.evidence, { runtimeIdentity: component.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, ownedValues: projection.contract, library: adapter.library, libraries });
	for(const [path, source] of Object.entries(generated.files))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.deepEqual(manifest.files["META-INF/lean-bridge/jvm/" + path], identity(source), path);
	}
	for(const [path, file] of Object.entries(compiled.files).filter(([path]) => path.startsWith("classes/")))
		assert.deepEqual(manifest.files[path.slice(8)], file, path);
	assert.equal(manifest.kind, "lean-bridge-owned-maven-package"); assert.equal(manifest.ecosystem, "maven");
	assert.equal(manifest.namespace, projection.namespace); assert.equal(manifest.name, pkg.name);
	assert.equal(manifest.version, pkg.version); assert.equal(manifest.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(manifest.ownedValues, projection.contract);
	assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
	assert.deepEqual(manifest.files["META-INF/lean-bridge/native-jvm.json"], identity(canonicalJson(compiled)));
	assert.deepEqual(manifest.files["META-INF/lean-bridge/native-jvm-adapter.json"], identity(canonicalJson(adapter)));
	assert.equal(manifest.files["META-INF/lean-bridge/runtime.json"].sha256, component.runtimeIdentity);
	for(const [path, source] of Object.entries({
		"native-component.json": canonicalJson(component)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "generated.lean": native.leanSource, "component.h": native.header
		, "callbacks.c": native.callbackSource
	})) assert.deepEqual(manifest.files["META-INF/lean-bridge/component/" + path], identity(source), path);
	assert.deepEqual(report.packageSetReceipt.packages, [pkg]);
	assert.equal(report.cliBuild.status, "ok"); assert.equal(report.cliBuild.result.backend, "owned-jvm-v1");
	const cli = report.cliBuild.result;
	assert.equal(cli.schemaVersion, 1); assert.equal(cli.ecosystem, "maven");
	assert.equal(cli.profile, "native-library-v1"); assert.deepEqual(cli.targets, ["maven"]);
	assert.deepEqual(cli.component, model.component);
	assert.equal(cli.bindingIrSha256, model.bindingIrSha256);
	assert.equal(cli.configurationSha256, input.sourceIdentity.exportConfigurationSha256);
	assert.equal(cli.namespace, projection.namespace);
	assert.equal(cli.runtimeIdentity, component.runtimeIdentity);
	assert.equal(cli.nativeRuntimeIdentity, component.runtimeIdentity);
	assert.equal(cli.glibcMinimumVersion, manifest.glibcMinimumVersion);
	assert.match(cli.glibcMinimumVersion, /^2\.\d+$/u);
	assert.deepEqual(cli.packages, pkg.artifacts.map(file => ({
		archive: basename(file.path), bytes: file.bytes, sha256: file.sha256
		, compilerAccess: false, name: pkg.name, version: pkg.version
	})));
	assert.deepEqual(report.tamperRejections, [
		"lifetime", "source", "guard", "gmp-receipt", "gmp-source"
		, "library", "unrecorded", "managed-source", "compiler-options"
		, "managed-lifetime"]);
	const fixture = await ownedJvmInstalledFixture(scalar, projection.namespace, projection.functions.map(fn => fn.publicName));
	assert.deepEqual(report.observations.map(item => item.profile), ["java", "kotlin"]);
	for(const run of report.observations)
	{
		installed(run, pkg);
		const { profile, observation, jvm } = run;
		assert.equal(run.checks, scalar ? profile === "java" ? 13 : 8 : profile === "java" ? 104 : 67);
		assert.equal(Number(observation.results.find(item => item.id === "owned/checks").observed.integer), run.checks);
		assert.equal(Number(observation.results.find(item => item.id === "owned/signatures").observed.integer), scalar ? 8 : 51);
		assert.deepEqual(jvm.nativeLibraries, libraries);
		assert.equal(jvm.consumerSourceSha256, sha256(fixture.source(profile)));
		assert.equal(jvm.signaturesSha256, sha256(fixture.signatures(profile)));
		assert.equal(jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
		assert.equal(jvm.compiledProjectionSha256, manifest.compiledProjectionSha256);
		assert.deepEqual(jvm.dependencies, report.dependencies);
		const rejected = observation.results.filter(item => item.status === "rejected-at-compile-time");
		assert.equal(rejected.length, 2);
		for(const [index, expected] of fixture.rejections(profile).entries())
		{
			assert.equal(rejected[index].id, expected.id); assert.equal(rejected[index].sourceSha256, sha256(expected.source));
			assert.deepEqual(rejected[index].diagnostics.map(item => item.code), [expected.expectation.diagnostic]);
		}
		if(!scalar) assert.deepEqual(jvm.documentation, fixture.examples(profile).map(example => ({
			id: example.id, sourceSha256: sha256(example.source), stdout: example.stdout
			, archiveSha256: jvm.archiveSha256, sourceFreeExecution: true
			, runtimeOnlyExecution: true, normalExitCleanup: true
		})));
	}
	if(!scalar && !reviewed)
	{
		const inspection = report.observations[0].jvm.inspection;
		assert.equal(inspection.originalArchiveSha256, archive(pkg).jar.sha256);
		assert.equal(inspection.probeSha256, sha256(await readFile("tests/fixtures/structured-types/OwnedInstalledAssetsProbe.java")));
		flags(inspection, ["recomputedMutableReceipt", "runtimeOnlyExecution", "normalExitCleanup"]);
		const paths = Object.keys(manifest.files).filter(path => path.startsWith("META-INF/lean-bridge/native/linux-x64/"));
		assert.equal(inspection.scenarios.length, 40);
		assert.deepEqual(inspection.scenarios.map(item => [item.path, item.mutation, item.profile, item.mode]),
			paths.flatMap(path => ["missing", "tampered"].flatMap(mutation => ["java", "kotlin"]
				.flatMap(profile => ["cold", "warm"].map(mode => [path, mutation, profile, mode])))));
		for(const scenario of inspection.scenarios)
		{
			flags(scenario, ["rejected", "noAdditionalNativeMappings"]);
			assert.equal(scenario.existingPackageUsable, scenario.mode === "warm");
			assert.deepEqual(scenario.nativeLibraries, scenario.mode === "warm" ? libraries : {});
			digest(scenario.archiveSha256); assert.notEqual(scenario.archiveSha256, inspection.originalArchiveSha256);
			const message = scenario.mutation === "missing" ? "Missing packaged native asset " : "Packaged native library differs from compiled evidence: ";
			assert.ok(scenario.diagnostic.includes(message + basename(scenario.path)));
		}
	}
};

/**
 * Require independently installed packages and all recorded loading orders.
 *
 * @param report - Real owned/copied coexistence observations.
 */
export const assertOwnedJvmCoexistence = async report => {
	flags(report, [
		"offlineInstall", "emptyRepository", "sourceFreeExecution"
		, "compilerFreeExecution"
		, "sharedRetirement", "sharedPrivateGmp", "nestedCrossComponentCalls"]);
	assert.deepEqual(report.packages.map(item => item.name), ["owned_one", "owned_two", "graph_one", "graph_peer"]);
	assert.equal(new Set(report.packages.map(item => item.package.runtimeIdentity)).size, 1);
	assert.equal(report.receipts.length, 4); files(report.deployment); files(report.runtimeFiles);
	assert.deepEqual(report.runtimeModules, ["java.base@22.0.2"]);
	const expected = {};
	for(const [index, item] of report.packages.entries())
	{
		const { jar } = archive(item.package), { receipt, sha256: receiptHash } = report.receipts[index];
		assert.equal(receiptHash, sha256(canonicalJson(receipt)));
		assert.equal(receipt.kind, item.owned ? "lean-bridge-owned-maven-package" : "lean-bridge-ordinary-maven-package");
		assert.equal(receipt.name, item.package.name); assert.equal(receipt.runtimeIdentity, item.package.runtimeIdentity);
		assert.equal(item.authorInputsUnchanged, true);
		assert.deepEqual(report.deployment["component" + index + ".jar"], { bytes: jar.bytes, sha256: jar.sha256 });
		for(const [name, hash] of Object.entries(nativeFiles(receipt)))
		{ if(expected[name]) assert.equal(expected[name], hash); expected[name] = hash; }
	}
	assert.deepEqual(report.scenarios.map(item => item.profile + "/" + item.mode), ["java", "kotlin"].flatMap(profile =>
		["owned-first", "second-owned-first", "graph-first", "peer-first"].map(mode => profile + "/" + mode)));
	for(const run of report.scenarios)
	{
		assert.equal(run.concurrentIterations, 64); flags(run, ["deploymentUnchanged", "normalExitCleanup"]);
		assert.deepEqual(run.mappings, expected);
		assert.equal(run.stdout, Object.entries(run.mappings).map(([name, hash]) => "mapped:" + name + ":" + hash + "\n").join("")
			+ run.profile + "-" + run.mode + "-ok\n");
	}
	for(const [file, hash] of Object.entries(report.sourceHashes))
		assert.equal(hash, sha256(await readFile("tests/fixtures/structured-types/" + file)));
	assert.deepEqual(report.foreignResourceRejections.map(item => [item.profile, item.id]), ["java", "kotlin"]
		.flatMap(profile => ["direct", "nested"].map(kind => [profile, "owned/foreign-" + kind])));
	for(const item of report.foreignResourceRejections)
	{
		const java = item.profile === "java", suffix = java ? "" : ".kotlin";
		const one = "org.leanbridge.owned_one" + suffix, two = "org.leanbridge.owned_two" + suffix;
		const expression = item.id.endsWith("-nested")
			? (java ? "new " : "") + one + ".Parcel(value, " + (java ? "new byte[0]" : "byteArrayOf()") + ")"
			: one + ".Api.read(value)";
		const source = java ? "class Invalid { void invalid(" + two + ".Ticket value) { " + expression + "; } }\n"
			: "fun invalid(value: " + two + ".Ticket) { " + expression + " }\n";
		assert.equal(item.sourceSha256, sha256(source)); assert.equal(item.diagnostics.length, 1);
		assert.equal(item.diagnostics[0].code, item.profile === "java" ? "compiler.err.cant.apply.symbol" : "ARGUMENT_TYPE_MISMATCH");
		assert.match(item.diagnostics[0].message, /Ticket/u);
	}
};

/**
 * Authenticate terminal current executions without expanding their ownership scope.
 *
 * @param record - New immutable execution record.
 * @param replay - Also validate the earlier converter/callable evidence.
 */
export const assertOwnedJvmPackageExecution = async (record, replay = true) => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-jvm-package-execution"); assert.equal(record.baselineRevision, ownedJvmBaseline);
	assert.deepEqual(record.scope, ownedJvmPackageScope);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedJvmExecutionSources);
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(jvmProbeRepairBytes(path, await readFile(path))), hash, path);
	assert.deepEqual(record.previous, { path: ownedJvmCallReceipt, sha256: "87b8d27a6d0a0cc4cd9b7a193a323fa574ec0043eea69b2afaef6bda803471e3" });
	const previous = await readFile(record.previous.path); assert.equal(sha256(previous), record.previous.sha256);
	for(const [name, count] of Object.entries({ packages: 4, coexistence: 1, documentation: 1, loaders: 2, ci: 7, copied: 5 }))
		passing(record.runs[name], ownedJvmPackageCommands[name], count);
	const loading = JSON.parse(record.runs.loaders.text.match(/^# (\{"fixtureLibraries":[^]*?\})$/mu)?.[1]);
	assert.equal(loading.fixtureLibraries, true); assert.equal(loading.compiledLean, false);
	assert.equal(loading.installedMaven, false);
	assert.deepEqual(loading.observations.map(item => item.mode), [
		"shared", "isolation", "preload", "runtime", "component", "hash"
		, "missing", "tampered", "broken", "warm-origin", "cold-origin"
	]);
	for(const item of loading.observations) assert.ok(item.checks > 0);
	assert.deepEqual(Object.keys(record.packages).sort(), ["callbacks-ordinary", "callbacks-reviewed", "scalars-ordinary", "scalars-reviewed"]);
	for(const [name, report] of Object.entries(record.packages))
		await assertOwnedJvmPackageReport(report, name.startsWith("scalars-"), name.endsWith("-reviewed"));
	await assertOwnedJvmCoexistence(record.coexistence);
	assertJvmGraphPackageReports(record.copied);
	for(const name of ["composition", "conflicts"])
		for(const [file, hash] of Object.entries(record.copied[name].sourceHashes))
			assert.equal(hash, sha256(await readFile("tests/fixtures/structured-types/" + file)));
	const docs = record.documentation, examples = await ownedJvmDocumentationExamples("org.leanbridge.owned_aggregates");
	assert.equal(docs.schemaVersion, 1); assert.equal(docs.planNode, 1219);
	flags(docs, ["cliIntegrated", "sourceRemovedBeforeInstallation"]);
	const guide = (await readFile("docs/publish/maven.md", "utf8")).split("## Owned resources and aggregates\n")[1].split("\n## ")[0];
	for(const [name, language] of [["lean", "lean"], ["config", "json"]])
		assert.equal(docs.sourceHashes[name], sha256(guide.match(new RegExp("```" + language + "\\n([^]*?)\\n```"))[1] + "\n"));
	assert.deepEqual(docs.observations.map(item => item.profile), ["java", "kotlin"]);
	for(const run of docs.observations)
	{
		installed(run, docs.packageSetReceipt.packages[0]);
		assert.equal(run.observation.results[0].observed.integer, "42");
		assert.deepEqual(run.jvm.documentation, examples[run.profile].map(example => ({
			id: example.id, sourceSha256: sha256(example.source), stdout: example.stdout
			, archiveSha256: run.jvm.archiveSha256, sourceFreeExecution: true
			, runtimeOnlyExecution: true, normalExitCleanup: true
		})));
	}
	assert.deepEqual(record.ci, assertOwnedJvmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8")));
	assert.deepEqual(record.nativeCi, assertNativeCiIsolation(
		await readFile(".github/workflows/consumer-matrix.yml", "utf8")
		, JSON.parse(await readFile("tests/fixtures/ci/native-acceptance-before-isolation.json"))));
	if(replay) await assertOwnedJvmCalls(JSON.parse(previous));
};

/**
 * Preserve every frozen predecessor, refresh source inventories and add no cells.
 *
 * @param record - Exact source history and current execution reference.
 */
export const assertOwnedJvmPackageIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-jvm-package-integration"); assert.equal(record.baselineRevision, ownedJvmBaseline);
	assert.deepEqual(record.previous, { path: managedCiIsolationPath, sha256: "a78e95102c811dacbd80446a8ab3a19559ba2b43a6a22da787a876e95e7e7dfd" });
	const previousBytes = await readFile(record.previous.path); assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes);
	assert.equal(record.execution.path, ownedJvmExecutionPath);
	const execution = await readFile(record.execution.path); assert.equal(sha256(execution), record.execution.sha256);
	const paths = [...new Set([...Object.keys(previous.sources), ...ownedJvmChangedPaths, ...ownedJvmAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sources).sort(), paths);
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedJvmChangedPaths);
	const updates = new Map(record.updates.map(item => [item.path, item]));
	for(const path of paths)
	{
		const bytes = jvmProbeRepairBytes(path, await readFile(path));
		assert.equal(sha256(bytes), record.sources[path], path);
		const update = updates.get(path);
		if(update)
		{
			const restored = reverseOwnedJvmUpdate(bytes.toString("utf8"), update);
			if(previous.sources[path]) assert.equal(sha256(restored), previous.sources[path], path);
		}
		else if(previous.sources[path]) assert.equal(record.sources[path], previous.sources[path], path);
	}
	const { document: currentDocument, irSchema, consumers } = await readTypeSurface(), contracts = { irSchema, consumers };
	const source = jvmProbeRepairBytes("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json")).toString("utf8");
	const document = JSON.parse(source);
	assert.deepEqual(typeSurfaceCells(currentDocument, contracts), typeSurfaceCells(document, contracts));
	const old = JSON.parse(reverseOwnedJvmUpdate(source, updates.get("docs/type-surface.v1.json")));
	const expected = structuredClone(old);
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected);
	assert.deepEqual(typeSurfaceCells(document, contracts), typeSurfaceCells(old, contracts));
	assert.deepEqual(record.inventory, previous.inventory);
	await assertOwnedJvmGeneratedHistory(record);
	const nativeBaseline = JSON.parse(await readFile("tests/fixtures/ci/native-acceptance-before-isolation.json"));
	assert.equal(nativeBaseline.workflowSha256, updates.get(".github/workflows/consumer-matrix.yml").previousSha256);
	await assertOwnedJvmPackageExecution(JSON.parse(execution));
	await assertManagedCiIsolationEvidence(previous);
};

/**
 * Authenticate exact generated changes for fixture and compiler-ordered APIs.
 *
 * @param record - Integration history containing both immutable predecessors.
 */
export const assertOwnedJvmGeneratedHistory = async record => {
	assert.deepEqual(record.generatedPrevious, {
		path: "docs/evidence/jvm-structured-codegen-regression-20260924.json"
		, sha256: "0f401b406002cbb9ae841c80f3b7b76adcb23edc04f32b74debf75c85df655b9"
	});
	const generatedBytes = await readFile(record.generatedPrevious.path);
	assert.equal(sha256(generatedBytes), record.generatedPrevious.sha256);
	const generatedPrevious = JSON.parse(generatedBytes);
	assert.deepEqual(record.generatedUpdates.map(item => item.path), ownedJvmGeneratedPaths);
	for(const fixture of generatedPrevious.fixtures)
	{
		const generated = generateCopiedJvmKotlinPackage(jvmStructuredRegressionFixtures[fixture.name]());
		for(const update of record.generatedUpdates.filter(item => Object.hasOwn(generated, item.path)))
		{
			assert.equal(update.previousSha256, fixture.files[update.path].sha256);
			assert.equal(sha256(generated[update.path]), update.currentSha256);
			assert.equal(sha256(reverseOwnedJvmUpdate(generated[update.path], update)), update.previousSha256);
		}
	}
	assert.deepEqual(record.generatedSortedPrevious, {
		path: "docs/evidence/kotlin-collections-20260922.json"
		, sha256: "c7a1b371b89de0099fd1d2af45cb557071ae15cb7701abce4fd1eba5e83013b2"
	});
	const sortedBytes = await readFile(record.generatedSortedPrevious.path);
	assert.equal(sha256(sortedBytes), record.generatedSortedPrevious.sha256);
	const sortedPrevious = JSON.parse(sortedBytes), ir = jvmStructuredRegressionFixtures.collections();
	for(const key of ["declarations", "types"]) ir[key].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const sorted = generateCopiedJvmKotlinPackage(ir);
	assert.deepEqual(record.generatedSortedUpdates.map(item => item.path), ownedJvmSortedGeneratedPaths);
	for(const update of record.generatedSortedUpdates)
	{
		for(const run of sortedPrevious.executions)
			assert.equal(update.previousSha256, run.installedFiles["META-INF/lean-bridge/jvm/" + update.path].sha256);
		assert.equal(sha256(sorted[update.path]), update.currentSha256);
		assert.equal(sha256(reverseOwnedJvmUpdate(sorted[update.path], update)), update.previousSha256);
	}
};
