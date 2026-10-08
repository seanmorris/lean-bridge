/**
 * Bind whole-owner Java/Kotlin APIs to actual Lean and installed Maven executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJvmEnforced, ownedJvmStep, ownedJvmUpload } from "./owned-jvm-job.mjs";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedJvmCalls } from "../../src/backends/jvm/owned-calls.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedJvmAdapterSources } from "../../src/build/owned-jvm-artifacts.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedJvmCallNative, ownedJvmCallProbeMethods } from "./owned-jvm-call-fixture.mjs";
import { ownedJvmBorrowInstalledFixture } from "./owned-jvm-borrow-installed.mjs";
import { ownedBorrowSource } from "./owned-borrow-fixture.mjs";
import { ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./type-corpus-jvm-tools.mjs";

export const ownedJvmBorrowScript = "LEAN_BRIDGE_OWNED_JVM_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-borrows.test.mjs tests/owned-jvm-borrow-packaging.test.mjs";
export const ownedJvmBorrowCommand = "npm run test:owned-jvm-borrows";
export const ownedJvmBorrowScope = Object.freeze({
	profiles: ["java", "kotlin"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedMaven: true, sourceFreeInstallation: true
	, offlineInstall: true, relocated: true, runtimeOnlyExecution: true
	, deterministicReassembly: true, independentRebuild: false
	, publicExports: 26, anchoredResults: 19, consumingFunctions: 4
	, wholeValueOwners: true, emptyValues: true, recursiveValues: true
	, returnedClosures: true, callbackReentry: true, canonicalIdentity: true
	, independentRetains: true, originalOwnerTransfers: true
	, transitiveExpiration: true
	, rawResourceViews: "borrowed-from-whole-owner"
	, borrowOnlyExecuted: true, wrongThread: true, threadExit: true
	, gcCleanup: true
	, allocationFaults: true, retainedExceptions: true, mutationChecks: true
	, safePublicApi: true, typedRejections: 11, documentationExecuted: true
	, privateGmp: true, coldAndWarmAssetRejections: true
	, otherConsumerBindings: false, inheritedProcess: false
	, receiverAnchors: false, callbackResultAnchors: false
	, sanitizers: [], docker: false, installedSupportPromotions: 0
});
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true };
const options = { transferredInputs: true, anchoredResults: true };
const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const files = inventory => {
	assert.ok(Object.keys(inventory).length > 0);
	for(const [path, file] of Object.entries(inventory))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
	}
};

/**
 * Require enabled runtime/package gates and reconstruct every generated contract.
 *
 * @param record - Frozen source-bound execution observations.
 */
export const assertOwnedJvmBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJvmBorrowScope);
	assert.equal(record.run.command, ownedJvmBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 8, pass: 8, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const baseLean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const extractor = sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean")));
	const checkInput = (item, suffix) => {
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(baseLean + suffix));
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		return createCompiledNativeModel(item.input, capabilities);
	};
	assert.equal(record.borrowOnly.actualLean, true); assert.equal(record.borrowOnly.inputTransfers, false);
	assert.deepEqual(record.borrowOnly.observations.map(item => item.mode), ["ordinary", "reviewed"]);
	const probeTemplate = (await readFile("tests/owned-jvm-borrows.test.mjs", "utf8")).split("\t\tconst probe = `")[1]?.split("`;\n")[0];
	assert.ok(probeTemplate);
	for(const item of record.borrowOnly.observations)
	{
		const model = checkInput(item, ownedBorrowSource);
		assert.equal(model.exports.length, 22); assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 18);
		const generated = generateOwnedJvmCalls(model.bindingIr, { anchoredResults: true });
		const native = ownedJvmCallNative(item.input);
		assert.deepEqual(item.generated, hashes(generated.files));
		assert.equal(item.nativeProbeSha256, sha256(native.implementation));
		const copy = generated.wholeCopies.find(fn => fn.publicName === "copyEchoArrayResult");
		const substitutions = new Map([
			["model.namespace", generated.namespace]
			, ['model.methodName(copy.call, "Java")', generated.methodName(copy.call, "Java")]
			, ['model.methodName(copy.call, "Kotlin")', generated.methodName(copy.call, "Kotlin")]
			, ['functions.get("echoArray")', generated.functions.findIndex(fn => fn.publicName === "echoArray")]
		]);
		const probe = probeTemplate.replace(/\$\{([^}]+)\}/gu, (_, expression) => {
			assert.ok(substitutions.has(expression), expression); return substitutions.get(expression);
		});
		assert.equal(item.probeSha256, sha256(probe)); assert.equal(item.stdout, "borrow-only-ok\n");
	}
	for(const item of [...record.runtime, ...record.packages])
	{
		const model = checkInput(item, ownedRustBorrowSource);
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			const generated = generateOwnedJvmCalls(model.bindingIr, options);
			assert.deepEqual(item.generated, hashes(generated.files));
			const runtime = Object.keys(generated.files).find(path => path.endsWith("/_OwnedRuntime.java"));
			const instrumented = { ...generated.files };
			assert.equal(instrumented[runtime].split("static void checkpoint() { }").length, 2);
			instrumented[runtime] = instrumented[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedBorrowProbe.allocation(); }");
			assert.equal(instrumented[runtime].split("if (closed.get()) check(4);").length, 2);
			instrumented[runtime] = instrumented[runtime].replace("if (closed.get()) check(4);", "if (closed.get()) check(4); OwnedBorrowProbe.afterWholeReadCheck();");
			assert.equal(item.instrumentedRuntimeSha256, sha256(instrumented[runtime]));
			for(const [file, field, kotlin] of [["owned-jvm-borrows.java", "javaProbeSha256", false], ["owned-kotlin-borrows.kt", "kotlinProbeSha256", true]])
			{
				const source = await readFile("tests/fixtures/structured-types/" + file, "utf8");
				assert.equal(source.split("/* METHODS */").length, 2);
				assert.equal(item[field], sha256(source.replace("/* METHODS */", () => ownedJvmCallProbeMethods(generated, kotlin))));
			}
			const native = ownedJvmCallNative(item.input);
			assert.equal(item.nativeProbeSha256, sha256(native.implementation));
			assert.equal(item.guardSha256, sha256(native.cleanup.guardSource));
			const values = Object.keys(instrumented).find(path => path.endsWith("/Ticket.java"));
			const conversions = Object.keys(instrumented).find(path => path.endsWith("/_OwnedConvert.java"));
			const mutations = [
				["unchecked-whole-value", [[runtime, "T get() { T snapshot = value; lease.require(); if", "T get() { T snapshot = value; if"]]]
				, ["unchecked-empty-value", [[runtime, "T get() { T snapshot = value; lease.require(); if", "T get() { T snapshot = value; if (!(value instanceof Object[] array && array.length == 0)) lease.require(); if"]]]
				, ["escaped-callback-frame-and-views", [
					[runtime, "scope.active = false;", "scope.active = true;"]
					, [conversions, "try { handle.close(); }", "try { if (handle.lease.scope == null) handle.close(); }"]
				]]
				, ["wrapper-equality", [[values, "return equal.test(handle, other.handle);", "return this == other;"]]]
				, ["late-whole-value-read", [[runtime, "return snapshot;", "return value;"]]]
			];
			assert.deepEqual(item.rejectedMutations, mutations.map(([name, changes]) => ({
				name, compiled: true
				, sources: Object.fromEntries(changes.map(([path, before, after]) => {
					assert.equal(instrumented[path].split(before).length, 2);
					return [path, sha256(instrumented[path].replace(before, after))];
				}))
			})));
			assert.deepEqual(item.observed, { javaChecks: 607, kotlinChecks: 601
				, faults: [39, 82, 10, 68], kotlinFaults: [39, 82, 10, 68]
				, live: 0, identities: 0, threadExits: 2, threadExitErrors: 0 });
			continue;
		}
		flags(item, ["actualLean", "installedPackage", "sourceUnchanged"
			, "sourceRemovedBeforeInstallation", "deterministicReassembly"
			, "receiptVerifiedWithoutProducer"]);
		assert.deepEqual(item.tamperRejections, ["adapter-version", "contract-version"
			, "consumption", "aliases", "native-transfers", "native-anchors"
			, "owned-version"
			, "original-anchor", "borrow-expiry", "empty-owner", "canonical-equality"
			, "raw-views", "copy-type", "whole-inputs", "lifetime", "source", "guard"
			, "gmp-receipt", "gmp-source", "library", "unrecorded", "managed-source"
			, "compiler-options", "managed-lifetime", "managed-version"]);
		const { nativeReceipt: component, adapter, runtimeReceipt: runtime, compiled, manifest, receipt } = item;
		const native = generateCompiledNativeLeanAdapters(model);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, ...options });
		const projection = generateOwnedJvmPackage(model.bindingIr, null, options);
		assert.equal(component.schemaVersion, 5); assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
		assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, item.input.sourceIdentity);
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.equal(adapter.schemaVersion, 3); assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.runtimeIdentity, component.runtimeIdentity); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(adapter.jvmValues, projection.contract);
		assert.deepEqual(adapter.ownedValues, { schemaVersion: 4
			, hostCallbacks: model.ownedGraph.hostCallbacks
			, inputTransfers: model.ownedGraph.inputTransfers
			, resultAnchors: model.ownedGraph.resultAnchors
			, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) });
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		for(const [path, source] of Object.entries(ownedJvmAdapterSources(c, projection)))
			assert.deepEqual(adapter.files[path], identity(source), path);
		assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1"); assert.equal(runtime.pointerBits, 64);
		assert.equal(sha256(canonicalJson(runtime)), component.runtimeIdentity);
		const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [component.library]: component.nativeLibrary.sha256
			, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
		assert.equal(Object.keys(libraries).length, 5);
		const evidence = { runtimeIdentity: component.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: projection.contract
			, library: adapter.library, libraries };
		assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, projection.contract);
		assert.equal(compiled.schemaVersion, 3); assert.equal(compiled.profile, "native-library-v1");
		assert.equal(compiled.namespace, projection.namespace); assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
		validateKotlinCompilation(compiled.kotlin, projection.namespace, { ownedValues: true });
		assert.equal(compiled.compiler, "javac 22.0.2");
		files(adapter.files); files(compiled.files); files(manifest.files);
		const generated = generateOwnedJvmPackage(model.bindingIr, evidence, options);
		for(const [path, source] of Object.entries(generated.files))
		{
			assert.deepEqual(compiled.files[path], identity(source), path);
			if(path.startsWith("src/") || path === "binding-manifest.json")
				assert.deepEqual(manifest.files["META-INF/lean-bridge/jvm/" + path], identity(source), path);
		}
		for(const [path, file] of Object.entries(compiled.files).filter(([path]) => path.startsWith("classes/")))
			assert.deepEqual(manifest.files[path.slice(8)], file, path);
		assert.equal(manifest.schemaVersion, 3); assert.equal(manifest.kind, "lean-bridge-owned-maven-package");
		assert.equal(manifest.namespace, projection.namespace); assert.equal(manifest.name, "org.leanbridge:owned-borrows");
		assert.equal(manifest.version, "1.2.3"); assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(manifest.ownedValues, projection.contract);
		assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity); assert.deepEqual(manifest.component, model.component);
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		for(const [name, value] of [["native-jvm", compiled], ["native-jvm-adapter", adapter], ["runtime", runtime]])
			assert.deepEqual(manifest.files[`META-INF/lean-bridge/${name}.json`], identity(canonicalJson(value)));
		for(const [path, source] of Object.entries({ "native-component.json": canonicalJson(component)
			, "model.json": canonicalJson(model)
			, "metadata.json": canonicalJson(item.input.metadata)
			, "binding-ir.json": canonicalJson(model.bindingIr)
			, "generated.lean": native.leanSource
			, "component.h": native.header, "callbacks.c": native.callbackSource }))
			assert.deepEqual(manifest.files["META-INF/lean-bridge/component/" + path], identity(source), path);
		for(const [file, hash] of Object.entries(libraries))
			assert.equal(manifest.files[`META-INF/lean-bridge/native/linux-x64/${file}`].sha256, hash, file);
		validatePackageSetReceipt(receipt); assert.equal(receipt.packages.length, 1);
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		const pkg = receipt.packages[0], cli = item.built;
		assert.equal(cli.backend, "owned-jvm-v3"); assert.deepEqual(cli.targets, ["maven"]);
		assert.equal(cli.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(cli.component, model.component);
		assert.equal(cli.configurationSha256, item.input.sourceIdentity.exportConfigurationSha256);
		assert.equal(cli.namespace, projection.namespace); assert.equal(cli.runtimeIdentity, component.runtimeIdentity);
		assert.equal(cli.nativeRuntimeIdentity, component.runtimeIdentity);
		assert.equal(manifest.glibcMinimumVersion, cli.glibcMinimumVersion);
		assert.equal(pkg.target, "maven"); assert.equal(pkg.ecosystem, "maven");
		assert.equal(pkg.name, manifest.name); assert.equal(pkg.version, manifest.version);
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.role, "component"); assert.equal(pkg.artifacts.length, 2);
		assert.deepEqual(cli.packages, pkg.artifacts.map(file => ({ archive: basename(file.path)
			, bytes: file.bytes, sha256: file.sha256, compilerAccess: false
			, name: pkg.name, version: pkg.version })));
		const jar = pkg.artifacts.find(file => file.path.endsWith(".jar")), pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
		const fixture = await ownedJvmBorrowInstalledFixture(projection.namespace, projection.functions.map(fn => fn.publicName));
		assert.deepEqual(item.observations.map(run => run.profile), ["java", "kotlin"]);
		for(const run of item.observations)
		{
			const { profile, observation, jvm } = run;
			assert.equal(observation.profile, profile); assert.deepEqual(observation.errors, []);
			flags(jvm, ["offline", "emptyRepository", "emptyUserHome"
				, "resolvedClasspathOnly"
				, "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution"
				, "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly"
				, "runtimeOverridesDisabled", "exactPublicSignatures"
				, "handoffRemovedBeforeExecution"]);
			assert.equal(jvm.archiveSha256, jar.sha256); assert.equal(jvm.pomSha256, pom.sha256);
			assert.deepEqual(jvm.deployment["package.jar"], { bytes: jar.bytes, sha256: jar.sha256 });
			assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]); assert.equal(jvm.javacVersion, "javac 22.0.2");
			assert.deepEqual(jvm.compilerOptions, profile === "java" ? javaCompilerOptions : kotlinCompilerOptions);
			assert.deepEqual(jvm.nativeLibraries, libraries); assert.deepEqual(observation.nativeLibraries, libraries);
			assert.equal(observation.nativeRootCount, 1);
			files(jvm.deployment); files(jvm.runtimeFiles); files(jvm.dependencies.files);
			assert.deepEqual(jvm.dependencies, item.dependencies);
			for(const dependency of jvm.resolvedDependencies)
			{
				assert.equal(jvm.dependencies.files[dependency.mavenPath].sha256, dependency.sha256);
				assert.equal(jvm.deployment["dependencies/" + basename(dependency.mavenPath)].sha256, dependency.sha256);
			}
			assert.deepEqual(jvm.resolvedDependencies.map(dependency => dependency.mavenPath), [
				"org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"
				, "org/jetbrains/annotations/13.0/annotations-13.0.jar"]);
			assert.equal(run.checks, profile === "java" ? 186 : 180);
			assert.equal(Number(observation.results.find(result => result.id === "owned/checks").observed.integer), run.checks);
			assert.equal(Number(observation.results.find(result => result.id === "owned/signatures").observed.integer), 26);
			assert.equal(jvm.consumerSourceSha256, sha256(fixture.source(profile)));
			assert.equal(jvm.signaturesSha256, sha256(fixture.signatures(profile)));
			assert.equal(jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
			assert.equal(jvm.compiledProjectionSha256, manifest.compiledProjectionSha256);
			const rejected = observation.results.filter(result => result.status === "rejected-at-compile-time");
			assert.equal(rejected.length, profile === "java" ? 6 : 5);
			for(const [index, expected] of fixture.rejections(profile).entries())
			{
				assert.equal(rejected[index].id, expected.id); assert.equal(rejected[index].sourceSha256, sha256(expected.source));
				assert.deepEqual(rejected[index].diagnostics.map(result => result.code), [expected.expectation.diagnostic]);
			}
			assert.deepEqual(jvm.documentation, fixture.examples(profile).map(example => ({ id: example.id
				, sourceSha256: sha256(example.source), stdout: example.stdout
				, archiveSha256: jar.sha256
				, sourceFreeExecution: true, runtimeOnlyExecution: true
				, normalExitCleanup: true })));
		}
		const inspection = item.observations[0].jvm.inspection;
		assert.equal(inspection.originalArchiveSha256, jar.sha256);
		let probe = await readFile("tests/fixtures/structured-types/OwnedInstalledAssetsProbe.java", "utf8");
		probe = probe.replace('        var ticketType = create.getReturnType();\n        Object ticket = create.invoke(null, BigInteger.valueOf(42), "installed");', '        Object owner = create.invoke(null, BigInteger.valueOf(42), "installed");\n        Object ticket = owner.getClass().getMethod("get").invoke(owner);\n        var ticketType = ticket.getClass();');
		probe = probe.replace("((AutoCloseable) ticket).close();", "((AutoCloseable) owner).close();");
		assert.equal(inspection.probeSha256, sha256(probe));
		flags(inspection, ["recomputedMutableReceipt", "runtimeOnlyExecution", "normalExitCleanup"]);
		const paths = Object.keys(manifest.files).filter(path => path.startsWith("META-INF/lean-bridge/native/linux-x64/"));
		assert.equal(inspection.scenarios.length, 40);
		assert.deepEqual(inspection.scenarios.map(scenario => [scenario.path, scenario.mutation, scenario.profile, scenario.mode]),
			paths.flatMap(path => ["missing", "tampered"].flatMap(mutation => ["java", "kotlin"]
				.flatMap(profile => ["cold", "warm"].map(mode => [path, mutation, profile, mode])))));
		for(const scenario of inspection.scenarios)
		{
			flags(scenario, ["rejected", "noAdditionalNativeMappings"]);
			assert.equal(scenario.existingPackageUsable, scenario.mode === "warm");
			assert.deepEqual(scenario.nativeLibraries, scenario.mode === "warm" ? libraries : {});
			digest(scenario.archiveSha256); assert.notEqual(scenario.archiveSha256, jar.sha256);
			assert.ok(scenario.diagnostic.includes((scenario.mutation === "missing" ? "Missing packaged native asset "
				: "Packaged native library differs from compiled evidence: ") + basename(scenario.path)));
		}
	}
};

/**
 * Require eight enabled tests and retained observations from both author paths.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Package scripts.
 */
export const assertOwnedJvmBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-jvm-borrows"], ownedJvmBorrowScript);
	const step = ownedJvmStep(workflow);
	assert.ok(step?.includes("          npm run test:owned-jvm-borrows > build/owned-jvm-borrows.log 2>&1\n"));
	for(const summary of ["pass 8", "fail 0", "skipped 0"]) assert.ok(step.includes(`          rg '^# ${summary}$' build/owned-jvm-borrows.log\n`));
	for(const name of ["ordinary", "reviewed", "borrow-only", "ordinary-installed", "reviewed-installed"])
		assert.ok(step.includes(`          test -s build/owned-jvm-borrows/${name}.json\n`));
	for(const path of ["build/owned-jvm-borrows/", "build/owned-jvm-borrows.log"])
		assert.ok(ownedJvmUpload(workflow)?.includes(`            ${path}\n`));
	assertOwnedJvmEnforced(workflow);
};
