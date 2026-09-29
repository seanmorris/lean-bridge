/**
 * Install consuming Java/Kotlin APIs from source-free prepared Maven packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedJvmTransferInstalledFixture } from "./helpers/owned-jvm-transfer-installed.mjs";
import { compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { inspectOwnedJvmInstalledAssets } from "./helpers/owned-jvm-installed-assets.mjs";
import { rejectOwnedJvmPackageMutations } from "./helpers/owned-jvm-package-tamper.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Maven contracts bind consuming inputs without changing borrow-only packages", async () => {
	const ir = ownedRustTransferReviewedIr();
	const generated = generateOwnedJvmPackage(ir, null, { transferredInputs: true });
	assert.equal(generated.contract.schemaVersion, 2);
	assert.equal(generated.contract.inputTransfers.arguments, "ordinary-values");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-jvm-v2");
	assert.throws(() => generateOwnedJvmPackage(ir), /call-scoped input borrows/u);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const borrowed = fixture(), original = generateOwnedJvmPackage(borrowed);
		const enabled = generateOwnedJvmPackage(borrowed, null, { transferredInputs: true });
		assert.deepEqual(enabled.files, original.files); assert.deepEqual(enabled.contract, original.contract);
	}
	for(const path of Object.keys(generated.files).filter(path => /\/Api\.(java|kt)$/u.test(path)))
		assert.equal(generated.files[path].split("Consumes resource leases in ").length - 1, 20);
	const fixture = await ownedJvmTransferInstalledFixture(generated.namespace, generated.functions.map(fn => fn.publicName));
	for(const profile of ["java", "kotlin"])
	{
		assert.match(fixture.source(profile), /values\(\); validation\(\); callbacks\(\)/u);
		assert.match(fixture.signatures(profile), /Wire.integer\(26\)/u);
	}
	assert.ok(fixture.source("kotlin").includes(`import ${generated.namespace}.kotlin.*\n`));
});

test("public Java and Kotlin transfer consumers compile without producer sources", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_TRANSFER_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-transfer-consumers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateOwnedJvmPackage(ownedRustTransferReviewedIr(), null, { transferredInputs: true });
	const fixture = await ownedJvmTransferInstalledFixture(generated.namespace, generated.functions.map(fn => fn.publicName));
	const toolchain = await compileOwnedJvmCallSources(root, generated.files);
	await rm(join(root, "src"), { recursive: true, force: true });
	await mkdir(join(root, "empty-source"));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC));
	const files = { "Consumer.java": fixture.source("java")
		, "Consumer.kt": fixture.source("kotlin")
		, "Wire.java": await readFile("tests/fixtures/type-corpus/consumers/Wire.java", "utf8")
		, ...fixture.javaSupport
		, ...Object.fromEntries(["java", "kotlin"].flatMap(profile => fixture.examples(profile).map(item => [item.file, item.source]))) };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, "consumer/" + path, source);
	try
	{
		await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions
			, "-sourcepath", "empty-source", "-cp", "classes:" + toolchain.stdlib
			, "-d", "consumer-classes"
			, ...Object.keys(files).filter(path => path.endsWith(".java")).map(path => "consumer/" + path)], root);
		await runCopied(environment.LEAN_BRIDGE_JAVA, ["-cp", join(home, "lib/*")
			, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", home
			, ...kotlinCompilerOptions
			, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
			, "-cp", "classes:consumer-classes:" + toolchain.stdlib
			, "-d", "consumer-classes"
			, ...Object.keys(files).filter(path => path.endsWith(".kt")).map(path => "consumer/" + path)], root);
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Maven inputs preserve transfer decisions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_TRANSFER_TEST !== "1", timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), `lean-bridge-jvm-transfers-${mode}-`));
	t.after(() => rm(root, { recursive: true, force: true }));
	const author = join(root, "author"), project = join(author, "project"), working = join(author, "release"), handoff = join(root, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustTransferSource);
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { maven: { name: "org.leanbridge:owned-transfers", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), before = await lakeInputState(project);
	const cli = resolve("scripts/lean-bridge.mjs");
	t.diagnostic(`${mode}: compile the Lean component, private JVM adapter and prepared JAR`);
	const run = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", working, "--target", "maven", "--json"]
		, cwd: root, env: environment, timeoutMs: 600000 })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	const response = JSON.parse(run.stdout); assert.equal(response.status, "ok");
	const built = response.result; assert.equal(built.backend, "owned-jvm-v2");
	assert.deepEqual(await lakeInputState(project), before);
	const nativeRoot = join(working, "native/component"), runtimeRoot = join(working, "native/runtime");
	const adapterRoot = join(working, "native/owned-jvm-binding"), jvmRoot = join(working, "native/jvm");
	const verified = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.adapter.schemaVersion, 2); assert.equal(verified.adapter.ownedValues.schemaVersion, 3);
	assert.equal(verified.adapter.jvmValues.schemaVersion, 2);
	assert.equal(verified.projection.c.functions.filter(fn => fn.transfers?.length).length, 20);
	assert.equal(verified.model.exports.length, 26);
	const compiled = await json(join(jvmRoot, "native-jvm.json")); assert.equal(compiled.schemaVersion, 2);
	const manifest = await json(join(working, "packages/maven/jar/META-INF/lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 2);
	const options = { working, nativeRoot, runtimeRoot, adapterRoot, jvmRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.maven
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const tamperRejections = await rejectOwnedJvmPackageMutations(options, verified, compiled);
	assert.equal(tamperRejections.length, 16);
	const reassembled = await packageOwnedMaven({ ...options, working: join(author, "reassembled") });
	assert.deepEqual(reassembled.packages, built.packages);
	for(const pkg of built.packages)
		assert.deepEqual(await readFile(join(working, "archives", pkg.archive)), await readFile(join(author, "reassembled/archives", pkg.archive)));
	await rm(join(author, "reassembled"), { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(working, handoff);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["maven"]); const pkg = receipt.packages[0];
	const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
	const fixture = await ownedJvmTransferInstalledFixture(verified.projection.namespace, verified.projection.functions.map(fn => fn.publicName));
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	await rm(author, { recursive: true, force: true }); await assert.rejects(access(author), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observations = [];
	for(const profile of ["java", "kotlin"])
	{
		t.diagnostic(`${mode}/${profile}: offline install, public consumer and runtime-only relocation`);
		const profileHandoff = join(root, "handoff-" + profile); await cp(handoff, profileHandoff, { recursive: true });
		let result;
		try
		{ result = await installedJvmCorpus({ library: { jvmModule: verified.projection.namespace }
			, profile, consumer: join(root, "consumer"), handoff: profileHandoff
			, pkg, dependencies, environment, clean: copiedCleanEnvironment
			, fixture: { ...fixture, ...profile === "java" ? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } }); }
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(result.observation.errors.length, 0);
		assert.equal(result.jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
		const checks = Number(result.observation.results.find(item => item.id === "owned/checks").observed.integer);
		assert.ok(checks > 70);
		assert.equal(Number(result.observation.results.find(item => item.id === "owned/signatures").observed.integer), 26);
		observations.push({ profile, checks, ...result });
		await rm(join(root, "consumer", profile), { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/owned-jvm-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode
		, compiledLean: true, installedMaven: true
		, cliIntegrated: true, deterministicReassembly: true
		, cliBuild: response, packageSetReceipt: receipt
		, receiptVerifiedWithoutProducer: true, sourceUnchanged: true
		, sourceRemovedBeforeInstallation: true, input
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, runtimeReceipt: verified.runtime
		, tamperRejections, compiledProjection: compiled, manifest, package: pkg
		, dependencies, observations
	}));
	t.diagnostic(JSON.stringify(observations.map(({ profile, checks }) => ({ profile, checks }))));
});
