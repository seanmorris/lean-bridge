/**
 * Package plain receiver APIs without assuming callback transport artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { projectOwnedJvm } from "../src/build/owned-jvm-projection.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { ownedJvmPlainReceiverInstalledFixture } from "./helpers/owned-jvm-plain-receiver-installed.mjs";
import { inspectOwnedJvmInstalledAssets } from "./helpers/owned-jvm-installed-assets.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`installed Maven resource receivers need no callback artifacts (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST !== "1", timeout: 1800000
}, async t => {
	const consuming = mode === "reviewed";
	const config = await ownedJvmPlainReceiverConfiguration(consuming, mode === "reviewed");
	config.targets = { maven: { name: "org.leanbridge:owned-plain-receivers", version: "1.2.3" } };
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-jvm-resource-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(author, "project");
	const output = join(author, "producer"), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedJvmPlainReceiverSource);
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(consuming) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedJvmPlainReceiverReviewedIr(true)));
	const before = await lakeInputState(project);
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-jvm-binding"), jvmRoot = join(output, "native/jvm");
	// The general CLI enables callback/copy transport. Exercise the lower-level
	// producer's explicit false capability so a missing callbacks.c is real.
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	const native = await buildNativeComponent({ projectRoot: project
		, outputRoot: nativeRoot
		, runtimeRoot, leanPrefix, targets: ["maven"], ownedGraphs: true
		, ownedReceiverExports: true, ownedHostCallbacks: false
		, ownedInputTransfers: consuming, ownedAnchoredResults: false });
	const built = await projectOwnedJvm({ working: output, nativeRoot, runtimeRoot
		, leanPrefix, settings: config.targets.maven, environment });
	assert.equal(built.backend, "owned-jvm-v4");
	assert.deepEqual(await lakeInputState(project), before);
	await writeNativePackageSet({ root: output, model: native.model
		, runtimeIdentity: native.receipt.runtimeIdentity, projections: [built] });
	const verified = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(verified.model.ownedGraph.hostCallbacks, undefined);
	assert.equal(verified.model.ownedGraph.resultAnchors, undefined);
	assert.equal(Boolean(verified.model.ownedGraph.inputTransfers), consuming);
	const manifest = JSON.parse(await readFile(join(output, "packages/maven/jar/META-INF/lean-bridge/package-receipt.json"), "utf8"));
	const compiled = JSON.parse(await readFile(join(jvmRoot, "native-jvm.json"), "utf8"));
	assert.ok(!Object.hasOwn(manifest.files, "META-INF/lean-bridge/component/callbacks.c"));
	const reassembled = join(directory, "reassembled");
	const again = await packageOwnedMaven({ working: reassembled
		, nativeRoot, runtimeRoot, adapterRoot, jvmRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.maven
		, glibcMinimumVersion: built.glibcMinimumVersion });
	assert.deepEqual(again.packages, built.packages);
	for(const pkg of built.packages) assert.deepEqual(await readFile(join(output, "archives", pkg.archive)), await readFile(join(reassembled, "archives", pkg.archive)));
	await rm(reassembled, { recursive: true });
	const receipt = await copyPackageSetHandoff(output, handoff), pkg = receipt.packages[0];
	const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
	const input = { metadata: JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const fixture = ownedJvmPlainReceiverInstalledFixture(verified.projection.namespace, consuming);
	for(const profile of ["java", "kotlin"]) await cp(handoff, join(directory, "handoff-" + profile), { recursive: true });
	await rm(handoff, { recursive: true });
	const observations = [];
	for(const profile of ["java", "kotlin"])
	{
		const result = await installedJvmCorpus({ library: { jvmModule: verified.projection.namespace }
			, profile, consumer, handoff: join(directory, "handoff-" + profile)
			, pkg, dependencies, environment, clean: copiedCleanEnvironment
			, fixture: { ...fixture, ...profile === "java" ? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const checks = Number(result.observation.results.find(item => item.id === "owned/checks").observed.integer);
		assert.equal(checks, consuming ? 13 : 11);
		observations.push({ profile, checks, ...result });
	}
	await saveLakeFile(resolve("build/owned-jvm-receiver-core"), `${mode}-resource-package.json`, canonicalJson({
		schemaVersion: 1, mode, consuming, actualLean: true, installedPackage: true
		, input, built, receipt, dependencies, manifest
		, nativeReceipt: verified.receipt, adapter: verified.adapter
		, runtimeReceipt: verified.runtime, compiled
		, producerInterface: "native-build-api", hostCallbacks: false
		, sourceUnchanged: true, receiptVerifiedWithoutProducer: true
		, sourceRemovedBeforeInstallation: true, deterministicReassembly: true
		, observations
	}));
	t.diagnostic(`${mode}: resource-only Java and Kotlin each passed ${consuming ? 13 : 11} checks twice after relocation`);
});
