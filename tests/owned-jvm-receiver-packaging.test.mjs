/**
 * Real CLI builds, offline Maven installs and runtime-only receiver consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { assertReviewedSourceConfiguration } from "../src/analyze/reviewed-source.mjs";
import { readVerifiedNativeComponent } from "../src/build/native-artifacts.mjs";
import { compileJvmSources, validateKotlinCompilation } from "../src/build/compile-jvm-sources.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedJvmReceiverInstalledFixture } from "./helpers/owned-jvm-receiver-installed.mjs";
import { ownedJvmPlainReceiverConfiguration } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { checkOwnedJvmReceiverCompanions } from "./helpers/owned-jvm-receiver-companions.mjs";
import { rejectOwnedJvmPackageMutations } from "./helpers/owned-jvm-package-tamper.mjs";
import { inspectOwnedJvmInstalledAssets } from "./helpers/owned-jvm-installed-assets.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, prepareJvmCorpusDependencies, jvmDiagnostics } from "./helpers/type-corpus-jvm-tools.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { captureCorpusCompiler } from "./helpers/type-corpus-compiler.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true };

test("Maven receiver consumers cover nominal results, public members and guide examples", async () => {
	for(const consuming of [false, true])
	{
		const reviewed = await ownedJvmPlainReceiverConfiguration(consuming, true);
		assert.deepEqual(reviewed, { schemaVersion: 1, modules: ["Owned"] });
		assertReviewedSourceConfiguration(reviewed);
		const ordinary = await ownedJvmPlainReceiverConfiguration(consuming, false);
		assert.equal(ordinary.exports.length, consuming ? 5 : 4);
		assert.throws(() => assertReviewedSourceConfiguration(ordinary), { code: "export-configuration-reviewed-ir" });
	}
	const generated = generateOwnedJvmPackage(ownedRustReceiverReviewedIr(), null, capabilities);
	assert.equal(generated.contract.schemaVersion, 4);
	assert.equal(generated.contract.backend, "owned-jvm-v4");
	assert.equal(generated.contract.receiverExports.exports.length, 16);
	const fixture = await ownedJvmReceiverInstalledFixture(generated.namespace, generated.functions.map(fn => fn.publicName));
	for(const profile of ["java", "kotlin"])
	{
		assert.match(fixture.signatures(profile), /Wire.integer\(27\)/u);
		assert.match(fixture.source(profile), /receiverMembers\(\); shapes\(\)/u);
		assert.doesNotMatch(fixture.source(profile), /_Owned|\.foreign\b|SymbolLookup/u);
		assert.equal(fixture.examples(profile).length, 2);
		assert.equal(fixture.rejections(profile).length, profile === "java" ? 11 : 9);
	}
});

test("external receiver Java/Kotlin clients compile without generator sources", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-receiver-consumers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateOwnedJvmPackage(ownedRustReceiverReviewedIr(), null, capabilities);
	const fixture = await ownedJvmReceiverInstalledFixture(generated.namespace, generated.functions.map(fn => fn.publicName));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC));
	for(const [path, source] of Object.entries(generated.files)) await saveLakeFile(root, path, source);
	const compilers = await compileJvmSources({ root, files: generated.files, environment });
	assert.ok(compilers.kotlin.options.includes("-Xuse-type-table"));
	validateKotlinCompilation(compilers.kotlin, generated.namespace, { ownedValues: true });
	const forged = structuredClone(compilers.kotlin);
	forged.options = forged.options.filter(option => option !== "-Xuse-type-table");
	assert.throws(() => validateKotlinCompilation(forged, generated.namespace, { ownedValues: true }), /compiler contract/u);
	const stdlib = join(home, "lib/kotlin-stdlib.jar");
	await rm(join(root, "src"), { recursive: true, force: true }); await mkdir(join(root, "empty-source"));
	const files = { "Consumer.java": fixture.source("java")
		, "Consumer.kt": fixture.source("kotlin")
		, "Wire.java": await readFile("tests/fixtures/type-corpus/consumers/Wire.java", "utf8"), ...fixture.javaSupport
		, ...Object.fromEntries(["java", "kotlin"].flatMap(profile => fixture.examples(profile).map(item => [item.file, item.source]))) };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, "consumer/" + path, source);
	const javaArgs = [...javaCompilerOptions, "-sourcepath", "empty-source", "-cp", "classes:" + stdlib, "-d", "consumer-classes"];
	const kotlinArgs = ["-cp", join(home, "lib/*")
		, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", home
		, ...kotlinCompilerOptions
		, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", "classes:consumer-classes:" + stdlib
		, "-d", "consumer-classes"];
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaArgs, ...Object.keys(files).filter(path => path.endsWith(".java")).map(path => "consumer/" + path)], root);
	await runCopied(environment.LEAN_BRIDGE_JAVA, [...kotlinArgs, ...Object.keys(files).filter(path => path.endsWith(".kt")).map(path => "consumer/" + path)], root);
	for(const profile of ["java", "kotlin"]) for(const entry of fixture.rejections(profile))
	{
		const file = `consumer/reject-${entry.id.split("/")[1]}.${profile === "java" ? "java" : "kt"}`;
		await saveLakeFile(root, file, entry.source);
		const result = await captureCorpusCompiler(profile === "java" ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_JAVA
			, profile === "java" ? [...javaArgs, "-XDrawDiagnostics", file] : [...kotlinArgs, file], root, copiedCleanEnvironment);
		jvmDiagnostics(result, entry, profile, root, file);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Maven receiver members preserve original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST !== "1"
	, timeout: mode === "reviewed" ? 5400000 : 3000000
}, async t => {
	const combined = mode === "reviewed";
	const config = combined ? { schemaVersion: 1, modules: ["Owned"] } : await ownedRustReceiverConfiguration();
	config.targets = { maven: { name: "org.leanbridge:owned-receivers", version: "1.2.3" } };
	if(combined) Object.assign(config.targets, {
		c: { name: "owned-c-receivers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-receivers", version: "1.2.3" }
		, cargo: { name: "owned-receivers", version: "1.2.3" }
		, pypi: { name: "owned-receivers", version: "1.2.3" }
		, rubygems: { name: "owned-receivers", version: "1.2.3" }
		, nuget: { name: "Owned.Receivers", version: "1.2.3" }
	});
	const context = await prepareOwnedReceiverCli(t, {
		label: `jvm-receiver-package-${mode}`, configuration: config
		, reviewedIr: combined ? ownedRustReceiverReviewedIr() : null
		, source: ownedRustReceiverSource
		, profiles: combined ? ["java", "kotlin", "dotnet", "ruby", "python", "rust"] : ["java", "kotlin"]
		, buildTimeoutMs: combined ? 2400000 : 1200000
		, environment: {
			LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
			, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem")
			, LEAN_BRIDGE_PYTHON: resolve(process.env.LEAN_BRIDGE_PYTHON ?? ".toolchains/python311/bin/python3.11")
			, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") }
	});
	const { directory, output, handoff, consumer, environment } = context;
	t.diagnostic(`${mode}: installed CLI builds ${Object.keys(config.targets).join(", ")}`);
	const built = await context.build(output), projection = built.projections?.find(item => item.ecosystem === "maven") ?? built;
	assert.equal(projection.backend, "owned-jvm-v4");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-jvm-binding"), jvmRoot = join(output, "native/jvm");
	const verified = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), combined);
	assert.equal(verified.model.exports.length, 27);
	assert.equal(verified.model.ownedGraph.receiverExports.exports.length, 16);
	assert.equal(verified.model.ownedGraph.resultAnchors.exports.length, 20);
	assert.equal(verified.adapter.schemaVersion, 4); assert.equal(verified.adapter.ownedValues.schemaVersion, 5);
	assert.equal(verified.adapter.jvmValues.schemaVersion, 4);
	const readers = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true };
	for(const key of ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"])
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...readers, [key]: false }));
	const compiled = await json(join(jvmRoot, "native-jvm.json")); assert.equal(compiled.schemaVersion, 4);
	const manifest = await json(join(output, "packages/maven/jar/META-INF/lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 4); assert.deepEqual(manifest.ownedValues, verified.projection.contract);
	const options = { working: directory
		, nativeRoot, runtimeRoot, adapterRoot, jvmRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.maven
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const tamperRejections = await rejectOwnedJvmPackageMutations(options, verified, compiled);
	assert.equal(tamperRejections.length, 32);
	const reassembledRoot = join(directory, "reassembled"), reassembled = await packageOwnedMaven({ ...options, working: reassembledRoot });
	assert.deepEqual(reassembled.packages, projection.packages);
	for(const pkg of projection.packages)
		assert.deepEqual(await readFile(join(output, "archives", pkg.archive)), await readFile(join(reassembledRoot, "archives", pkg.archive)));
	await rm(reassembledRoot, { recursive: true });
	t.diagnostic(`${mode}: independent second CLI build`);
	const independent = join(directory, "independent"), second = await context.build(independent);
	for(const item of built.projections ?? [built])
	{
		const again = second.projections?.find(value => value.ecosystem === item.ecosystem) ?? second;
		assert.deepEqual(again.packages, item.packages);
		for(const pkg of item.packages)
			assert.deepEqual(await readFile(join(output, "archives", pkg.archive)), await readFile(join(independent, "archives", pkg.archive)));
	}
	await rm(independent, { recursive: true });
	const receipt = await copyPackageSetHandoff(output, handoff), pkg = receipt.packages.find(item => item.target === "maven");
	const dependencies = await prepareJvmCorpusDependencies({ directory: context.author, handoff, pkg, environment, clean: copiedCleanEnvironment });
	const rustDependencies = combined ? await prepareRustCorpusDependencies({ rustRoot: join(output, "native/rust"), directory: context.author, handoff, environment }) : null;
	if(rustDependencies) await cp(join(handoff, rustDependencies.archive), join(consumer, "dependencies", rustDependencies.archive), { recursive: true });
	const fixture = await ownedJvmReceiverInstalledFixture(verified.projection.namespace, verified.projection.functions.map(fn => fn.publicName));
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	const cliVerification = await context.removeAuthor();
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const companions = combined ? await checkOwnedJvmReceiverCompanions({ consumer, handoff, environment, dependencies: rustDependencies, receipt }) : {};
	const observations = [];
	// Give each language its own handoff; remove the original before execution too.
	for(const profile of ["java", "kotlin"]) await cp(handoff, join(directory, "handoff-" + profile), { recursive: true });
	await rm(handoff, { recursive: true });
	for(const profile of ["java", "kotlin"])
	{
		t.diagnostic(`${mode}/${profile}: offline Maven install and runtime-only relocation`);
		const result = await installedJvmCorpus({ library: { jvmModule: verified.projection.namespace }
			, profile, consumer, handoff: join(directory, "handoff-" + profile)
			, pkg, dependencies, environment, clean: copiedCleanEnvironment
			, fixture: { ...fixture, ...profile === "java" ? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } });
		assert.equal(result.observation.errors.length, 0);
		assert.equal(result.jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
		const checks = Number(result.observation.results.find(item => item.id === "owned/checks").observed.integer);
		assert.ok(checks > 100);
		assert.equal(Number(result.observation.results.find(item => item.id === "owned/signatures").observed.integer), 27);
		assert.equal(result.observation.results.filter(item => item.status === "rejected-at-compile-time").length, fixture.rejections(profile).length);
		assert.equal(result.jvm.documentation.length, 2);
		t.diagnostic(`${mode}/${profile}: ${checks} public checks passed twice after relocation`);
		observations.push({ profile, checks, ...result });
	}
	await saveLakeFile(resolve("build/owned-jvm-receiver-core"), `${mode}-package.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, actualLean: true
		, installedPackage: true, input, built, receipt
		, cli: context.cli, cliInstallation: context.cliInstallation
		, cliBuilds: context.builds, cliVerification
		, sourceUnchanged: true, sourceRemovedBeforeInstallation: true
		, independentProducerBuild: true, deterministicReassembly: true
		, receiptVerifiedWithoutProducer: true, incapableReadersRejected: 4
		, runtimeReceipt: verified.runtime, nativeReceipt: verified.receipt
		, adapter: verified.adapter, compiled, manifest
		, tamperRejections, dependencies, rustDependencies, companions, observations
	}));
});
