/**
 * Offline resource-only Composer packages omit callbacks and preserve identity.
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
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { projectOwnedPhp } from "../src/build/owned-php-projection.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { ownedPhpPlainInstalledReceiverProbe } from "./helpers/owned-php-receiver-fixture.mjs";
import { inspectOwnedPhpReceiverDeployment } from "./helpers/owned-php-receiver-installed.mjs";
import { installOwnedPhpArchive } from "./helpers/owned-php-installed.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`installed Composer resource receivers need no callback artifacts (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_RECEIVER_TEST !== "1", timeout: 1800000
}, async t => {
	const consuming = mode === "reviewed";
	const config = await ownedJvmPlainReceiverConfiguration(consuming, consuming);
	const settings = { name: "lean-bridge/owned-values", version: "1.2.3" };
	config.targets = { "php-native": settings };
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-php-resource-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(author, "project");
	const output = join(author, "producer"), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	const environment = { ...nativeFixtureEnvironment([])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedJvmPlainReceiverSource);
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(consuming) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedJvmPlainReceiverReviewedIr(true)));
	const before = await lakeInputState(project);
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-php-binding");
	// The CLI enables callback/copy transport. This explicit producer capability
	// ensures there is no callbacks.c to accidentally rely on during packaging.
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	const native = await buildNativeComponent({ projectRoot: project
		, outputRoot: nativeRoot
		, runtimeRoot, leanPrefix, targets: ["php-native"], ownedGraphs: true
		, ownedReceiverExports: true, ownedHostCallbacks: false
		, ownedInputTransfers: consuming, ownedAnchoredResults: false });
	const options = { working: output, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, environment };
	const built = await projectOwnedPhp(options);
	assert.deepEqual(await lakeInputState(project), before);
	await writeNativePackageSet({ root: output, model: native.model
		, runtimeIdentity: native.receipt.runtimeIdentity, projections: [built] });
	const verified = await ownedPhpEvidence(options);
	assert.equal(verified.model.ownedGraph.hostCallbacks, undefined);
	assert.equal(verified.model.ownedGraph.resultAnchors, undefined);
	assert.equal(Boolean(verified.model.ownedGraph.inputTransfers), consuming);
	assert.equal(verified.php.contract.receiverExports.resourceEquality, "canonical-identity");
	assert.doesNotMatch(verified.php.files["src/Api.php"], /WithRecovery|with_recovery/u);
	assert.doesNotMatch(verified.php.files["src/Internal/OwnedRuntime.php"], /_result_validate/u);
	const reassembled = join(directory, "reassembled");
	const again = await packageOwnedPhp({ ...options, working: reassembled, glibcMinimumVersion: built.glibcMinimumVersion });
	assert.deepEqual(again.packages, built.packages);
	for(const pkg of built.packages) assert.deepEqual(await readFile(join(output, "archives", pkg.archive)), await readFile(join(reassembled, "archives", pkg.archive)));
	await rm(reassembled, { recursive: true });
	const receipt = await copyPackageSetHandoff(output, handoff), pkg = built.packages[0];
	const input = { metadata: JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const installed = await installOwnedPhpArchive({ root: consumer, archive: join(handoff, "archives", pkg.archive), pkg, environment });
	assert.ok(!Object.keys(installed.evidence.receipt.files).some(path => path.endsWith("/callbacks.c")));
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const inspected = await inspectOwnedPhpReceiverDeployment({
		installed, pkg, directory, consumer
		, source: ownedPhpPlainInstalledReceiverProbe(consuming)
		, libraries: verified.evidence.libraries
		, adapterLibrary: verified.adapter.library });
	for(const { observed } of inspected.observations) assert.equal(observed.checks, consuming ? 26 : 25);
	await saveLakeFile("build/owned-php-receiver-packaging", `${mode}-resource.json`, canonicalJson({
		schemaVersion: 1, mode, consuming, compiledLean: true, installedPackage: true
		, input, built, packageSetReceipt: receipt, installation: installed.evidence
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, producerInterface: "native-build-api"
		, hostCallbacks: false, resultAnchors: false
		, sourceUnchanged: true, receiptVerifiedWithoutProducer: true
		, sourceRemovedBeforeInstallation: true, deterministicReassembly: true
		, handoffRemoved: true, ...inspected
	}));
	t.diagnostic(`${mode}: ${consuming ? 26 : 25} public resource checks, weak/strict callers, two relocated deployments`);
});
