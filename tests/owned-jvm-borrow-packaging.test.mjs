/**
 * Prepared Maven whole-owner APIs, installed without producer sources or tools.
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
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedJvmBorrowInstalledFixture } from "./helpers/owned-jvm-borrow-installed.mjs";
import { compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { rejectOwnedJvmPackageMutations } from "./helpers/owned-jvm-package-tamper.mjs";
import { inspectOwnedJvmInstalledAssets } from "./helpers/owned-jvm-installed-assets.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const capabilities = { transferredInputs: true, anchoredResults: true };

test("Maven whole-owner contracts preserve unanchored packages and both public signatures", async () => {
	const ir = ownedRustBorrowReviewedIr(), generated = generateOwnedJvmPackage(ir, null, capabilities);
	assert.equal(generated.contract.schemaVersion, 3);
	assert.equal(generated.contract.resultAnchors.anchor, "original-result-owner");
	assert.equal(generated.contract.inputTransfers.arguments, "whole-values");
	assert.ok(!generated.wholeCopies.some(copy => copy.publicName === "copyValue" && generated.type(copy.id, false) === generated.namespace + ".Ticket[]"));
	assert.ok(generated.wholeCopies.some(copy => copy.publicName === "copyEchoArrayResult"));
	assert.ok(generated.wholeCopies.some(copy => copy.publicName === "copyEchoListResult"));
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-jvm-v3");
	assert.throws(() => generateOwnedJvmPackage(ir, null, { transferredInputs: true }), /explicit output leases/u);
	assert.deepEqual(generateOwnedJvmPackage(ownedAggregateReviewedIr(), null, capabilities).files, generateOwnedJvmPackage(ownedAggregateReviewedIr()).files);
	const fixture = await ownedJvmBorrowInstalledFixture(generated.namespace, generated.functions.map(fn => fn.publicName));
	for(const profile of ["java", "kotlin"])
	{
		assert.match(fixture.signatures(profile), /Wire.integer\(26\)/u);
		assert.match(fixture.source(profile), /original-owner|original owner|transitive owner/u);
		assert.equal(fixture.examples(profile)[0].stdout, "42\n");
	}
});

test("public whole-owner Java/Kotlin consumers compile without producer sources", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-borrow-consumers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateOwnedJvmPackage(ownedRustBorrowReviewedIr(), null, capabilities);
	const fixture = await ownedJvmBorrowInstalledFixture(generated.namespace, generated.functions.map(fn => fn.publicName));
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

for(const mode of ["ordinary", "reviewed"]) test(`installed Maven borrows preserve original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_BORROW_TEST !== "1", timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), `lean-bridge-jvm-borrows-${mode}-`));
	t.after(() => rm(root, { recursive: true, force: true }));
	const author = join(root, "author"), project = join(author, "project"), working = join(author, "release"), handoff = join(root, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustBorrowSource);
	const config = mode === "ordinary" ? await ownedRustBorrowConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { maven: { name: "org.leanbridge:owned-borrows", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), before = await lakeInputState(project);
	t.diagnostic(`${mode}: build the Lean component, private JVM adapter and prepared JAR`);
	const run = await processBuildRunner.capture({ command: process.execPath
		, args: [resolve("scripts/lean-bridge.mjs"), "build", "--project", project, "--output", working, "--target", "maven", "--json"]
		, cwd: root, env: environment, timeoutMs: 600000 })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	const response = JSON.parse(run.stdout); assert.equal(response.status, "ok");
	const built = response.result; assert.equal(built.backend, "owned-jvm-v3");
	assert.deepEqual(await lakeInputState(project), before);
	const nativeRoot = join(working, "native/component"), runtimeRoot = join(working, "native/runtime");
	const adapterRoot = join(working, "native/owned-jvm-binding"), jvmRoot = join(working, "native/jvm");
	const verified = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.adapter.schemaVersion, 3); assert.equal(verified.adapter.ownedValues.schemaVersion, 4);
	assert.equal(verified.adapter.jvmValues.schemaVersion, 3);
	assert.equal(verified.projection.c.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.equal(verified.projection.c.functions.filter(fn => fn.transfers?.length).length, 4);
	assert.equal(verified.model.exports.length, 26);
	const compiled = await json(join(jvmRoot, "native-jvm.json")); assert.equal(compiled.schemaVersion, 3);
	const manifest = await json(join(working, "packages/maven/jar/META-INF/lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 3);
	const options = { working, nativeRoot, runtimeRoot, adapterRoot, jvmRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.maven
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const tamperRejections = await rejectOwnedJvmPackageMutations(options, verified, compiled);
	assert.equal(tamperRejections.length, 25);
	const reassembled = await packageOwnedMaven({ ...options, working: join(author, "reassembled") });
	assert.deepEqual(reassembled.packages, built.packages);
	for(const pkg of built.packages)
		assert.deepEqual(await readFile(join(working, "archives", pkg.archive)), await readFile(join(author, "reassembled/archives", pkg.archive)));
	await rm(join(author, "reassembled"), { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(working, handoff);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["maven"]); const pkg = receipt.packages[0];
	const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
	const fixture = await ownedJvmBorrowInstalledFixture(verified.projection.namespace, verified.projection.functions.map(fn => fn.publicName));
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	await rm(author, { recursive: true, force: true }); await assert.rejects(access(author), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observations = [];
	for(const profile of ["java", "kotlin"])
	{
		t.diagnostic(`${mode}/${profile}: offline install, public API and runtime-only relocation`);
		const profileHandoff = join(root, "handoff-" + profile); await cp(handoff, profileHandoff, { recursive: true });
		let result;
		try
		{ result = await installedJvmCorpus({ library: { jvmModule: verified.projection.namespace }
			, profile, consumer: join(root, "consumer")
			, handoff: profileHandoff
			, pkg, dependencies, environment, clean: copiedCleanEnvironment
			, fixture: { ...fixture, ...profile === "java" ? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } }); }
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(result.observation.errors.length, 0);
		assert.equal(result.jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
		const checks = Number(result.observation.results.find(item => item.id === "owned/checks").observed.integer);
		assert.ok(checks > 100);
		assert.equal(Number(result.observation.results.find(item => item.id === "owned/signatures").observed.integer), 26);
		assert.equal(result.observation.results.filter(item => item.status === "rejected-at-compile-time").length, fixture.rejections(profile).length);
		t.diagnostic(`${mode}/${profile}: ${checks} public checks passed`);
		observations.push({ profile, checks, ...result });
	}
	await saveLakeFile(resolve("build/owned-jvm-borrows"), `${mode}-installed.json`, canonicalJson({
		mode, actualLean: true, installedPackage: true, input, built, receipt
		, sourceUnchanged: true, sourceRemovedBeforeInstallation: true
		, deterministicReassembly: true, receiptVerifiedWithoutProducer: true
		, runtimeReceipt: verified.runtime
		, dependencies, nativeReceipt: verified.receipt
		, adapter: verified.adapter, compiled, manifest
		, tamperRejections, observations
	}));
});
