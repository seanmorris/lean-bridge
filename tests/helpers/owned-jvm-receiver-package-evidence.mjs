/**
 * Bind installed receiver Maven packages to compiled inputs and public clients.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedJvmAdapterSources } from "../../src/build/owned-jvm-artifacts.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { ownedJvmReceiverInstalledFixture } from "./owned-jvm-receiver-installed.mjs";
import { ownedJvmPlainReceiverInstalledFixture } from "./owned-jvm-plain-receiver-installed.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./type-corpus-jvm-tools.mjs";

const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
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

const assertAssets = async (inspection, manifest, libraries, jar) => {
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
};

const assertConsumers = async (item, projection, libraries, pkg, plain) => {
	const { manifest } = item;
	const jar = pkg.artifacts.find(file => file.path.endsWith(".jar")), pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
	const fixture = plain ? ownedJvmPlainReceiverInstalledFixture(projection.namespace, item.consuming)
		: await ownedJvmReceiverInstalledFixture(projection.namespace, projection.functions.map(fn => fn.publicName));
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
		if(plain) assert.equal(run.checks, item.consuming ? 13 : 11);
		else
		{
			assert.ok(run.checks > 180);
			assert.equal(Number(observation.results.find(result => result.id === "owned/signatures").observed.integer), 27);
		}
		assert.equal(Number(observation.results.find(result => result.id === "owned/checks").observed.integer), run.checks);
		assert.equal(jvm.consumerSourceSha256, sha256(fixture.source(profile)));
		assert.equal(jvm.signaturesSha256, sha256(fixture.signatures(profile)));
		assert.equal(jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
		assert.equal(jvm.compiledProjectionSha256, manifest.compiledProjectionSha256);
		const rejected = observation.results.filter(result => result.status === "rejected-at-compile-time");
		assert.equal(rejected.length, plain ? 0 : profile === "java" ? 11 : 9);
		for(const [index, expected] of fixture.rejections(profile).entries())
		{
			assert.equal(rejected[index].id, expected.id); assert.equal(rejected[index].sourceSha256, sha256(expected.source));
			assert.deepEqual(rejected[index].diagnostics.map(result => result.code), [expected.expectation.diagnostic]);
		}
		assert.deepEqual(jvm.documentation ?? [], (fixture.examples?.(profile) ?? []).map(example => ({ id: example.id
			, sourceSha256: sha256(example.source), stdout: example.stdout
			, archiveSha256: jar.sha256
			, sourceFreeExecution: true, runtimeOnlyExecution: true
			, normalExitCleanup: true })));
	}
	await assertAssets(item.observations[0].jvm.inspection, manifest, libraries, jar);
};

const assertCli = async (item, targets) => {
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
	assert.equal(item.cli.kind, "lean-bridge-cli-package"); assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
	assert.equal(item.cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
	digest(archive.sha256); assert.ok(archive.bytes > 0);
	assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
	assert.equal(item.cli.files.length, config.files.length + 2);
	assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
	for(const path of config.files)
	{
		const file = item.cli.files.find(value => value.path === path), bytes = await readFile(path);
		assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
	}
	assert.equal(item.cliBuilds.length, 2);
	for(const build of item.cliBuilds)
	{ assert.equal(build.status, "ok"); assert.deepEqual([...build.result.targets].sort(), targets); }
	assert.equal(item.cliVerification.status, "ok"); assert.equal(item.cliVerification.result.verificationType, "local-package-set");
};

/**
 * Reconstruct one installed package without making a full acceptance claim.
 *
 * @param item - Original package report.
 * @param options - Explicit resource-only scope and complete gate log.
 * @param options.plain - Require absence of callback and result-anchor transport.
 * @param options.run - Original gate log containing the consumer observations.
 */
export const assertOwnedJvmReceiverPackage = async (item, { plain = false, run: gate } = {}) => {
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const combined = !plain && item.mode === "reviewed";
	const options = { receiverExports: true, hostCallbacks: !plain
		, anchoredResults: !plain, transferredInputs: !plain || item.consuming };
	const model = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedReceiverExports: true, ownedHostCallbacks: options.hostCallbacks
		, ownedAnchoredResults: options.anchoredResults
		, ownedInputTransfers: options.transferredInputs });
	flags(item, ["actualLean", "installedPackage", "sourceUnchanged"
		, "sourceRemovedBeforeInstallation"
		, "deterministicReassembly", "receiptVerifiedWithoutProducer"]);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(model.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean + (plain ? ownedJvmPlainReceiverSource : ownedRustReceiverSource)));
	assert.equal(model.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
	assert.equal(model.exports.length, plain ? item.consuming ? 5 : 4 : 27);
	if(plain)
	{
		assert.equal(item.producerInterface, "native-build-api"); assert.equal(item.hostCallbacks, false);
		assert.equal(model.ownedGraph.hostCallbacks, undefined); assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(Boolean(model.ownedGraph.inputTransfers), item.consuming);
	}
	else
	{
		assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.equal(item.independentProducerBuild, true); assert.equal(item.incapableReadersRejected, 4);
		assert.deepEqual(item.tamperRejections, ["adapter-version"
			, "contract-version", "consumption", "aliases", "native-transfers"
			, "native-anchors", "owned-version", "original-anchor", "borrow-expiry"
			, "empty-owner", "canonical-equality", "raw-views", "copy-type"
			, "whole-inputs", "native-receivers"
			, ...["values", "members", "properties", "owners", "consumingReceivers", "exports"].map(field => "receiver-" + field)
			, "lifetime", "source", "guard", "gmp-receipt", "gmp-source"
			, "library", "unrecorded", "managed-source", "compiler-options"
			, "managed-lifetime", "managed-version"]);
	}
	const { nativeReceipt: component, adapter, runtimeReceipt: runtime, compiled, manifest, receipt } = item;
	const native = generateCompiledNativeLeanAdapters(model), c = generateOwnedCPackage({ ...item.input, ...options });
	const projection = generateOwnedJvmPackage(model.bindingIr, null, options);
	assert.equal(component.schemaVersion, 6); assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, options.hostCallbacks ? sha256(native.callbackSource) : undefined);
	for(const field of ["receiverExports", "inputTransfers", "resultAnchors"])
		assert.deepEqual(component[field], model.ownedGraph[field]);
	assert.equal(adapter.schemaVersion, 4); assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(adapter.jvmValues, projection.contract);
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 5
		, ...options.hostCallbacks ? { hostCallbacks: model.ownedGraph.hostCallbacks } : {}
		, ...options.transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
		, ...options.anchoredResults ? { resultAnchors: model.ownedGraph.resultAnchors } : {}
		, receiverExports: model.ownedGraph.receiverExports
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
	assert.equal(compiled.schemaVersion, 4); assert.equal(compiled.profile, "native-library-v1");
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
	assert.equal(manifest.schemaVersion, 4); assert.equal(manifest.kind, "lean-bridge-owned-maven-package");
	assert.equal(manifest.namespace, projection.namespace);
	assert.equal(manifest.name, plain ? "org.leanbridge:owned-plain-receivers" : "org.leanbridge:owned-receivers");
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
		, "component.h": native.header, ...options.hostCallbacks ? { "callbacks.c": native.callbackSource } : {} }))
		assert.deepEqual(manifest.files["META-INF/lean-bridge/component/" + path], identity(source), path);
	assert.equal(Object.hasOwn(manifest.files, "META-INF/lean-bridge/component/callbacks.c"), options.hostCallbacks);
	for(const [file, hash] of Object.entries(libraries))
		assert.equal(manifest.files[`META-INF/lean-bridge/native/linux-x64/${file}`].sha256, hash, file);
	validatePackageSetReceipt(receipt);
	const targets = combined ? ["c", "cargo", "cpp", "maven", "nuget", "pypi", "rubygems"] : ["maven"];
	assert.deepEqual(receipt.packages.map(value => value.target).sort(), targets);
	assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	const pkg = receipt.packages.find(value => value.target === "maven");
	const built = item.built.projections?.find(value => value.ecosystem === "maven") ?? item.built;
	assert.equal(built.backend, "owned-jvm-v4"); assert.equal(built.namespace, projection.namespace);
	assert.equal(built.runtimeIdentity, component.runtimeIdentity); assert.equal(built.glibcMinimumVersion, manifest.glibcMinimumVersion);
	assert.equal(pkg.ecosystem, "maven"); assert.equal(pkg.name, manifest.name); assert.equal(pkg.version, manifest.version);
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.role, "component"); assert.equal(pkg.artifacts.length, 2);
	assert.deepEqual(built.packages, pkg.artifacts.map(file => ({ archive: basename(file.path)
		, bytes: file.bytes, sha256: file.sha256, compilerAccess: false
		, name: pkg.name, version: pkg.version })));
	await assertConsumers(item, projection, libraries, pkg, plain);
	if(!plain)
	{
		await assertCli(item, targets);
		if(!combined) assert.deepEqual(item.companions, {});
		else
		{
			assert.deepEqual(Object.keys(item.companions).sort(), ["cpp", "dotnet", "python", "ruby", "rust"]);
			for(const [profile, checks, file, prefix] of [
				["cpp", 407, "owned-cpp-borrows.cpp", "#define OWNED_BORROW_INSTALLED 1\n"]
				, ["rust", 440, "owned-rust-borrows.rs", "use owned_receivers::*;\n"]
				, ["ruby", 137, "owned-installed-ruby-borrows.rb", ""]
				, ["dotnet", null, "owned-installed-dotnet-borrows.cs", ""]
			]) {
				const companion = item.companions[profile];
				if(checks !== null) assert.equal(companion.checks, checks);
				else assert.ok(companion.checks > 100);
				flags(companion, ["offlineInstall", "compilerFreePath"]);
				assert.equal(companion.consumerSha256, sha256(prefix + await readFile("tests/fixtures/structured-types/" + file, "utf8")));
			}
			assert.equal(item.companions.python.checks, 328); assert.equal(item.companions.python.ordinaryImport, true);
		}
		for(const run of item.observations)
			assert.ok(gate.text.includes(`${item.mode}/${run.profile}: ${run.checks} public checks passed twice after relocation`));
	}
};

/**
 * Require all four packages before accepting the receiver milestone.
 *
 * @param record - Both author paths and their resource-only package reports.
 */
export const assertOwnedJvmReceiverPackages = async record => {
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.resourcePackages.map(item => [item.mode, item.consuming]), [["ordinary", false], ["reviewed", true]]);
	for(const item of record.packages) await assertOwnedJvmReceiverPackage(item, { run: record.run });
	for(const item of record.resourcePackages) await assertOwnedJvmReceiverPackage(item, { plain: true, run: record.run });
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
};
