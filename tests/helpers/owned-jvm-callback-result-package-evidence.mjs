/**
 * Reconstruct callback-result Maven inputs and authenticate installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compiledPackageMetadata, mavenPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { ownedJvmAdapterSources } from "../../src/build/owned-jvm-artifacts.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedJvmCallbackResultInstalledFixture } from "./owned-jvm-callback-result-installed.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, jvmConsumerPom, mavenSettings } from "./type-corpus-jvm-tools.mjs";

const hash = value => sha256(canonicalJson(value));
const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const files = inventory => {
	assert.ok(Object.keys(inventory).length > 0);
	for(const [path, file] of Object.entries(inventory))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part)));
		digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
	}
};

/**
 * Derive native/JVM contracts and package payload hashes from compiler inputs.
 *
 * @param item - Original standalone callback package report.
 * @param targets - Exact publishing configuration, including shared peers.
 */
export const assertOwnedJvmCallbackPackageInputs = async (item, targets = { maven: { name: "org.leanbridge:owned-callback-results", version: "1.2.3" } }) => {
	const { mode, combined, input, componentReceipt: component
		, adapter, compiled, runtimeReceipt: runtime, manifest } = item;
	assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
	assert.ok(["ordinary", "reviewed"].includes(mode)); assert.equal(typeof combined, "boolean");
	const options = { hostCallbacks: combined, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined
		, callbackResultAnchors: true, valueCopies: true };
	const model = createCompiledNativeModel(input, { ownedGraphs: true
		, ownedHostCallbacks: combined, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined
		, ownedCallbackResultAnchors: true });
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	const configuration = mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = targets;
	assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(model.sourceIdentity.exportConfigurationSha256, hash(configuration));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(ir));
		assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, hash(ir));
	}
	assert.equal(model.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(model.sourceIdentity.modules.find(value => value.module === "Owned").source.sha256,
		sha256(lean + (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource)));
	for(const [key, count] of [["receiverExports", 5], ["resultAnchors", 1], ["inputTransfers", 2]])
	{
		if(combined) assert.equal(model.ownedGraph[key].exports.length, count);
		else assert.equal(model.ownedGraph[key], undefined);
	}
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), combined);
	const c = generateOwnedCPackage({ ...input, ...options });
	const projection = generateOwnedJvmPackage(model.bindingIr, null, options);
	const native = generateCompiledNativeLeanAdapters(model);
	assert.equal(component.schemaVersion, 7); assert.equal(component.profile, "native-library-v1");
	assert.equal(component.modelSha256, hash(model)); assert.equal(component.metadataSha256, hash(input.metadata));
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.allocationGuardSha256, sha256(nativeAllocationGuardHeader));
	assert.equal(component.callbackSourceSha256, combined ? sha256(native.callbackSource) : undefined);
	assert.equal(component.initializer, `initialize_${native.module}`);
	assert.deepEqual(component.exports, model.exports.map(item => ({ declaration: item.name, symbol: item.symbol })));
	digest(component.nativeLibrary.sha256); assert.ok(component.nativeLibrary.bytes > 0);
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
		assert.deepEqual(component[key], model.ownedGraph[key]);
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.componentReceiptSha256, hash(component));
	assert.equal(adapter.profile, "native-library-v1");
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 6
		, ...combined ? { hostCallbacks: model.ownedGraph.hostCallbacks
			, inputTransfers: model.ownedGraph.inputTransfers
			, resultAnchors: model.ownedGraph.resultAnchors
			, receiverExports: model.ownedGraph.receiverExports } : {}
		, callbackResultAnchors: model.ownedGraph.callbackResultAnchors
		, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) });
	assert.deepEqual(adapter.jvmValues, projection.contract); assert.equal(projection.contract.schemaVersion, 5);
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
	const adapterSources = ownedJvmAdapterSources(c, projection);
	for(const [path, source] of Object.entries(adapterSources)) assert.deepEqual(adapter.files[path], identity(source), path);
	assert.equal(adapter.library, `lib${c.values.prefix}_jvm.so`);
	assert.deepEqual(Object.keys(adapter.files).sort(), [
		...Object.keys(adapterSources), `lib/${adapter.library}`
		, "gmp/include/gmp.h", "gmp/lib/libgmp-lean-bridge.so.10"
		, "gmp/share/lean-bridge/gmp.json"
		, "gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["GMP-COPYING", "GMP-COPYING.LESSERv3", "GMP-COPYINGv2", "GMP-COPYINGv3"].map(name => `gmp/share/lean-bridge/licenses/${name}`)].sort());
	assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1");
	assert.equal(runtime.pointerBits, 64); assert.equal(component.runtimeIdentity, hash(runtime));
	files(runtime.files); files(adapter.files); files(compiled.files); files(manifest.files);
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [basename(path), file.sha256])) };
	assert.equal(Object.keys(libraries).length, 5);
	const evidence = { runtimeIdentity: component.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: hash(component), ownedValues: projection.contract
		, library: adapter.library, libraries };
	assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, projection.contract);
	assert.equal(compiled.schemaVersion, 5); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.namespace, projection.namespace); assert.equal(compiled.compiler, "javac 22.0.2");
	validateKotlinCompilation(compiled.kotlin, projection.namespace, { ownedValues: true });
	const packaged = generateOwnedJvmPackage(model.bindingIr, evidence, options);
	for(const [path, source] of Object.entries(packaged.files))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.deepEqual(manifest.files[`META-INF/lean-bridge/jvm/${path}`], identity(source), path);
	}
	for(const [path, file] of Object.entries(compiled.files))
	{
		assert.ok(Object.hasOwn(packaged.files, path) || /^classes\/[A-Za-z0-9_.$/-]+\.(?:class|kotlin_module)$/u.test(path));
		if(path.startsWith("classes/")) assert.deepEqual(manifest.files[path.slice(8)], file, path);
	}
	for(const path of [`${projection.namespace.replaceAll(".", "/")}/Api.class`
		, `${projection.namespace.replaceAll(".", "/")}/kotlin/Api.class`
		, `META-INF/${compiled.kotlin.module}.kotlin_module`]) assert.ok(manifest.files[path].bytes > 0);
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.kind, "lean-bridge-owned-maven-package");
	assert.equal(manifest.ecosystem, "maven"); assert.equal(manifest.name, "org.leanbridge:owned-callback-results");
	assert.equal(manifest.version, "1.2.3"); assert.match(manifest.glibcMinimumVersion, /^2\.\d+$/u);
	assert.equal(manifest.namespace, projection.namespace); assert.deepEqual(manifest.ownedValues, projection.contract);
	assert.deepEqual(manifest.kotlin, { namespace: `${projection.namespace}.kotlin`, standardLibraryVersion: "2.2.0" });
	assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity); assert.deepEqual(manifest.component, model.component);
	for(const value of [component, adapter, compiled, manifest]) assert.equal(value.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.runtimeIdentity, component.runtimeIdentity); assert.equal(manifest.compiledProjectionSha256, hash(compiled));
	for(const [name, value] of [["native-jvm", compiled], ["native-jvm-adapter", adapter], ["runtime", runtime]])
		assert.deepEqual(manifest.files[`META-INF/lean-bridge/${name}.json`], identity(canonicalJson(value)));
	for(const [path, source] of Object.entries({ "native-component.json": canonicalJson(component)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "generated.lean": native.leanSource, "component.h": native.header
		, "allocation-guard.h": nativeAllocationGuardHeader
		, ...combined ? { "callbacks.c": native.callbackSource } : {} }))
		assert.deepEqual(manifest.files[`META-INF/lean-bridge/component/${path}`], identity(source), path);
	assert.equal(Object.hasOwn(manifest.files, "META-INF/lean-bridge/component/callbacks.c"), combined);
	for(const [path, file] of Object.entries(adapter.files))
		if(!path.startsWith("lib/") && !path.startsWith("gmp/lib/")) assert.deepEqual(manifest.files[`META-INF/lean-bridge/adapter/${path}`], file, path);
	assert.deepEqual(Object.fromEntries(Object.entries(manifest.files).filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/")).map(([path, file]) => [basename(path), file.sha256])), libraries);
	const [group, artifact] = manifest.name.split(":"), version = manifest.version;
	const pom = `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>${group}</groupId><artifactId>${artifact}</artifactId><version>${version}</version>${mavenPackageMetadata(compiledPackageMetadata(model.sourceIdentity))}<properties><maven.compiler.release>22</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties><dependencies><dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>2.2.0</version></dependency></dependencies></project>\n`;
	assert.deepEqual(manifest.files[`META-INF/maven/${group}/${artifact}/pom.xml`], identity(pom));
	assert.deepEqual(manifest.files["META-INF/MANIFEST.MF"], identity("Manifest-Version: 1.0\n\n"));
	assert.deepEqual(manifest.files["README.md"], identity(`# ${manifest.name}:${version}\n\nRequires glibc ${manifest.glibcMinimumVersion} or newer.\n\n${packaged.files["README.md"]}`));
	assert.equal(manifest.files["META-INF/lean-bridge/licenses/source-notices.json"].sha256, model.sourceIdentity.sourceNoticesSha256);
	assert.deepEqual(manifest.files["META-INF/lean-bridge/licenses/LeanBridge-LICENSE"], identity(await readFile("LICENSE")));
	const payloadPaths = ["README.md", "META-INF/MANIFEST.MF"
		, `META-INF/maven/${group}/${artifact}/pom.xml`
		, ...Object.keys(compiled.files).filter(path => path.startsWith("classes/")).map(path => path.slice(8))
		, ...Object.keys(packaged.files).filter(path => path.startsWith("src/") || path === "binding-manifest.json").map(path => `META-INF/lean-bridge/jvm/${path}`)
		, ...Object.keys(adapter.files).filter(path => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")).map(path => `META-INF/lean-bridge/adapter/${path}`)
		, ...Object.keys(libraries).map(path => `META-INF/lean-bridge/native/linux-x64/${path}`)
		, ...["native-jvm.json", "native-jvm-adapter.json", "runtime.json"].map(path => `META-INF/lean-bridge/${path}`)
		, ...["native-component.json", "model.json", "metadata.json"
			, "binding-ir.json"
			, "generated.lean", "component.h", "allocation-guard.h", "artifacts.json"
			, ...combined ? ["callbacks.c"] : []
			, ...model.sourceIdentity.lakeDependencies?.generatedSourcesSha256 ? ["lake-generated-sources.json"] : []].map(path => `META-INF/lean-bridge/component/${path}`)
		, ...["Lean-LICENSE", "Lean-LICENSES", "LeanBridge-LICENSE", "source-notices.json"].map(path => `META-INF/lean-bridge/licenses/${path}`)];
	assert.deepEqual(Object.keys(manifest.files).sort(), payloadPaths.sort());
	return { model, projection, packaged, libraries, pom };
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
	const archives = new Map();
	for(const scenario of inspection.scenarios)
	{
		flags(scenario, ["rejected", "noAdditionalNativeMappings"]);
		assert.equal(scenario.existingPackageUsable, scenario.mode === "warm");
		assert.deepEqual(scenario.nativeLibraries, scenario.mode === "warm" ? libraries : {});
		digest(scenario.archiveSha256); assert.notEqual(scenario.archiveSha256, jar.sha256);
		const key = scenario.path + "/" + scenario.mutation;
		if(archives.has(key)) assert.equal(scenario.archiveSha256, archives.get(key));
		else archives.set(key, scenario.archiveSha256);
		assert.ok(scenario.diagnostic.includes((scenario.mutation === "missing" ? "Missing packaged native asset "
			: "Packaged native library differs from compiled evidence: ") + basename(scenario.path)));
	}
	assert.equal(new Set(archives.values()).size, 10);
};

/**
 * Verify both installed public clients, raw reruns, examples and loader rejects.
 *
 * @param item - JVM receipts and observations, with explicit mode and capabilities.
 * @param projection - Independently reconstructed public JVM projection.
 * @param libraries - Native identities derived from compiler receipts.
 * @param pkg - Maven entry from the verified package-set receipt.
 */
export const assertOwnedJvmCallbackInstalledExecution = async (item, projection, libraries, pkg) => {
	const { manifest } = item, fixture = ownedJvmCallbackResultInstalledFixture(projection.namespace, item.combined);
	const jar = pkg.artifacts.find(file => file.path.endsWith(".jar")), pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
	assert.deepEqual(item.observations.map(run => run.profile), ["java", "kotlin"]);
	for(const { profile, observation, jvm, checks } of item.observations)
	{
		const expectedChecks = item.combined ? 47 : 22;
		assert.equal(checks, expectedChecks); assert.equal(observation.schemaVersion, 1);
		assert.equal(observation.profile, profile); assert.deepEqual(observation.errors, []);
		assert.equal(observation.module, projection.namespace); assert.equal(observation.jvmVersion, "22.0.2");
		assert.equal(observation.hostVersion, profile === "java" ? "22.0.2" : "2.2.0");
		assert.ok(["consumer", `${item.mode}-consumer`].some(root => observation.apiLocation.endsWith(`/${root}/${profile}/relocated/package.jar`)));
		assert.deepEqual(observation.nativeLibraries, libraries); assert.equal(observation.nativeRootCount, 1);
		const matched = [
			{ id: "owned/callback-result-signatures", independentCopy: false, observed: { integer: item.combined ? "40" : "28" }, status: "matched" }
			, { id: "owned/callback-result-checks", independentCopy: true, observed: { integer: String(expectedChecks) }, status: "matched" }];
		assert.deepEqual(observation.results.slice(0, 2), matched);
		const rejections = fixture.rejections(profile);
		assert.equal(observation.results.length, 2 + rejections.length);
		for(const [index, expected] of rejections.entries())
		{
			const actual = observation.results[index + 2];
			assert.equal(actual.id, expected.id); assert.equal(actual.status, "rejected-at-compile-time");
			assert.equal(actual.sourceSha256, sha256(expected.source));
			assert.deepEqual(actual.diagnostics.map(result => result.code), [expected.expectation.diagnostic]);
			for(const diagnostic of actual.diagnostics)
			{
				assert.equal(diagnostic.file, `src/reject-${expected.id.split("/")[1]}.${profile === "java" ? "java" : "kt"}`);
				assert.ok(Number.isSafeInteger(diagnostic.line) && diagnostic.line > 0);
				assert.ok(Number.isSafeInteger(diagnostic.column) && diagnostic.column > 0);
				assert.ok(diagnostic.message.length > 0);
				assert.ok(diagnostic.message.includes("Bundle"));
				assert.ok(diagnostic.message.includes(expected.id === "owned/raw-host-reply" ? "CallbackResult" : "Value"));
			}
		}
		assert.equal(jvm.runtimeExecutions.length, 2, "Both runtime-only executions must be retained");
		for(const execution of jvm.runtimeExecutions)
		{
			assert.deepEqual(Object.keys(execution).sort(), ["code", "observation", "stderr", "stdout"]);
			assert.equal(execution.code, 0); assert.equal(execution.stderr, "");
			assert.deepEqual(JSON.parse(execution.stdout), execution.observation);
			assert.deepEqual(execution.observation, { ...observation, results: matched });
		}
		assert.deepEqual(jvm.runtimeExecutions[0], jvm.runtimeExecutions[1]);
		flags(jvm, ["offline", "emptyRepository", "emptyUserHome"
			, "resolvedClasspathOnly"
			, "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution"
			, "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly"
			, "runtimeOverridesDisabled", "exactPublicSignatures"
			, "handoffRemovedBeforeExecution"]);
		assert.equal(jvm.archiveSha256, jar.sha256); assert.equal(jvm.pomSha256, pom.sha256);
		assert.deepEqual(jvm.deployment["package.jar"], { bytes: jar.bytes, sha256: jar.sha256 });
		assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]); assert.equal(jvm.javacVersion, "javac 22.0.2");
		assert.match(jvm.javaVersion, /version "22\.0\.2"/u);
		assert.deepEqual(jvm.compilerOptions, profile === "java" ? javaCompilerOptions : kotlinCompilerOptions);
		assert.deepEqual(jvm.nativeLibraries, libraries);
		files(jvm.deployment); files(jvm.runtimeFiles); files(jvm.dependencies.files); files(jvm.mavenFiles);
		assert.ok(jvm.runtimeFiles["bin/java"] && jvm.runtimeFiles["lib/modules"]);
		assert.ok(!Object.keys(jvm.runtimeFiles).some(path => /javac|jdk\.compiler/u.test(path)));
		assert.ok(jvm.deployment[profile === "java" ? "classes/Consumer.class" : "classes/ConsumerKt.class"]);
		assert.ok(jvm.deployment["classes/Wire.class"]);
		assert.ok(!Object.keys(jvm.deployment).some(path => /\.(?:java|kt|pom)$/u.test(path)));
		for(const field of ["compilerSha256", "javaSha256", "javaModulesSha256", "mavenBootSha256", "classpathSha256"]) digest(jvm[field]);
		assert.deepEqual(jvm.dependencies, item.dependencies); digest(jvm.dependencies.sha256);
		assert.deepEqual(jvm.resolvedDependencies.map(dependency => dependency.mavenPath), [
			"org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"
			, "org/jetbrains/annotations/13.0/annotations-13.0.jar"]);
		for(const dependency of jvm.resolvedDependencies)
		{
			assert.equal(jvm.dependencies.files[dependency.mavenPath].sha256, dependency.sha256);
			assert.deepEqual(jvm.deployment["dependencies/" + basename(dependency.mavenPath)], jvm.dependencies.files[dependency.mavenPath]);
		}
		if(profile === "kotlin")
		{
			assert.match(jvm.kotlin.version, /kotlinc-jvm 2\.2\.0 /u);
			for(const value of Object.values(jvm.kotlin.compilerFiles)) digest(value);
			digest(jvm.kotlin.compilerFiles["kotlin-compiler.jar"]);
			assert.equal(jvm.kotlin.stdlibSha256, jvm.resolvedDependencies[0].sha256);
			assert.equal(jvm.kotlin.compilerFiles["kotlin-stdlib.jar"], jvm.kotlin.stdlibSha256);
		}
		assert.equal(jvm.consumerSourceSha256, sha256(fixture.source(profile)));
		assert.equal(jvm.signaturesSha256, sha256(fixture.signatures(profile)));
		assert.equal(jvm.declarationsSha256, manifest.files[`META-INF/lean-bridge/jvm/src/main/java/${projection.namespace.replaceAll(".", "/")}/Api.java`].sha256);
		assert.equal(jvm.packageReceiptSha256, hash(manifest));
		assert.equal(jvm.compiledProjectionSha256, manifest.compiledProjectionSha256);
		assert.equal(jvm.bindingIrSha256, manifest.bindingIrSha256);
		assert.equal(jvm.projectSourceSha256, sha256(jvmConsumerPom(pkg))); assert.equal(jvm.settingsSha256, sha256(mavenSettings));
		const examples = fixture.examples(profile);
		assert.deepEqual(jvm.documentation, examples.map(example => ({ id: example.id
			, sourceSha256: sha256(example.source), stdout: example.stdout
			, archiveSha256: jar.sha256, sourceFreeExecution: true
			, runtimeOnlyExecution: true, normalExitCleanup: true })));
		for(const example of examples) assert.ok(jvm.deployment[`classes/${example.main}.class`]);
	}
	await assertAssets(item.observations[0].jvm.inspection, manifest, libraries, jar);
};

const assertCli = async item => {
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
	assert.equal(item.cli.schemaVersion, 1); assert.equal(item.cli.kind, "lean-bridge-cli-package");
	assert.equal(inventorySha256, hash(inventory)); assert.equal(item.cli.sourceDateEpoch, config.sourceDateEpoch);
	assert.deepEqual(item.cli.package, { name: config.name, version: config.version });
	for(const field of ["productionApproved", "runtimeIncluded", "phpWasmInputsIncluded", "javascriptWasmInputsIncluded"]) assert.equal(item.cli[field], false);
	assert.equal(externalRegistryWrites, false); digest(archive.sha256); assert.ok(archive.bytes > 0);
	assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
	assert.deepEqual(item.cli.files.map(file => file.path).sort(), [...config.files, "README.md", "package.json"].sort());
	for(const path of config.files)
	{
		const file = item.cli.files.find(value => value.path === path);
		const mode = ["scripts/lean-bridge.mjs", "scripts/create-publication-signer-policy.mjs"].includes(path) ? 0o755 : 0o644;
		assert.deepEqual(file, { path, mode, ...identity(await readFile(path)) }, path);
	}
};

/**
 * Require installed rebuild, negative, example and two-run runtime evidence.
 *
 * @param item - Original standalone callback package report.
 */
export const assertOwnedJvmCallbackPackageExecution = async item => {
	const { model, projection, libraries, pom } = await assertOwnedJvmCallbackPackageInputs(item);
	flags(item, ["compiledLean", "sourceRemovedBeforeInstallation", "deterministicReassembly", "independentProducerBuild"]);
	assert.deepEqual(item.incapableReadersRejected, ["ownedCallbackResultAnchors"
		, ...item.combined ? ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"] : []]);
	assert.deepEqual(item.tamperRejections, [
		...item.combined ? ["adapter-version", "contract-version", "consumption"
			, "aliases", "native-transfers", "native-anchors", "owned-version"
			, "original-anchor", "borrow-expiry", "empty-owner"
			, "canonical-equality", "raw-views", "copy-type", "whole-inputs"
			, "native-receivers"
			, ...["values", "members", "properties", "owners", "consumingReceivers", "exports"].map(field => "receiver-" + field)] : []
		, "callback-adapter-version", "callback-owned-version"
		, "native-callback-results"
		, ...["schemaVersion", "values", "anchor", "parameterNumbering"
			, "expiration", "descendants", "emptyValues", "independentOwnership"
			, "hostArguments", "hostReply", "hostResultHandoff", "nativeInputs"
			, "nativeClosures"].map(field => "callback-" + field)
		, "callback-signatures", "callback-parameter", "callback-result"
		, "lifetime", "source", "guard", "gmp-receipt", "gmp-source", "library"
		, "unrecorded", "managed-source", "compiler-options"
		, "managed-lifetime", "managed-version"]);
	const receipt = item.packageSetReceipt; validatePackageSetReceipt(receipt);
	validatePackageSetReceipt(item.independentPackageSetReceipt);
	assert.deepEqual(item.independentPackageSetReceipt, receipt);
	assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.profiles, [{ id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: item.manifest.runtimeIdentity }]);
	assert.equal(receipt.packages.length, 1);
	const pkg = receipt.packages[0];
	assert.equal(pkg.target, "maven"); assert.equal(pkg.ecosystem, "maven");
	assert.equal(pkg.name, item.manifest.name); assert.equal(pkg.version, item.manifest.version);
	assert.equal(pkg.profile, "native-library-v1"); assert.equal(pkg.runtimeIdentity, item.manifest.runtimeIdentity);
	assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.deepEqual(pkg.artifacts.map(file => file.path), ["archives/owned-callback-results-1.2.3.jar", "archives/owned-callback-results-1.2.3.pom"]);
	assert.deepEqual(pkg.artifacts[1], { path: pkg.artifacts[1].path, ...identity(pom) });
	const built = { ecosystem: "maven", backend: "owned-jvm-v5"
		, runtimeIdentity: item.manifest.runtimeIdentity
		, namespace: projection.namespace
		, glibcMinimumVersion: item.manifest.glibcMinimumVersion
		, packages: pkg.artifacts.map(file => ({ archive: basename(file.path)
			, bytes: file.bytes, sha256: file.sha256, compilerAccess: false
			, name: pkg.name, version: pkg.version })) };
	for(const [key, value] of Object.entries(built)) assert.deepEqual(item.built[key], value, key);
	assert.equal(item.builds.length, 2);
	for(const build of item.builds)
	{
		if(!item.combined) assert.deepEqual(build, { producerInterface: "native-build-api", projections: [built] });
		else
		{
			assert.equal(build.status, "ok"); assert.equal(build.exitCode, 0); assert.deepEqual(build.diagnostics, []);
			assert.deepEqual(build.result.targets, ["maven"]); assert.equal(build.result.bindingIrSha256, model.bindingIrSha256);
			assert.deepEqual(build.result.component, model.component);
			for(const [key, value] of Object.entries(built)) assert.deepEqual(build.result[key], value, key);
		}
	}
	if(item.combined) assert.notEqual(item.builds[0].result.output, item.builds[1].result.output);
	assert.equal(item.verification.status, "ok"); assert.equal(item.verification.exitCode, 0);
	assert.deepEqual(item.verification.diagnostics, []);
	assert.deepEqual(item.verification.result, { archives: 2, authenticated: false
		, component: model.component.id
		, packages: [{ ecosystem: "maven", name: pkg.name, target: "maven", version: pkg.version }]
		, profiles: ["native-library-v1"], receiptSha256: hash(receipt)
		, verificationType: "local-package-set", verified: true });
	await assertCli(item);
	await assertOwnedJvmCallbackInstalledExecution(item, projection, libraries, pkg);
};
