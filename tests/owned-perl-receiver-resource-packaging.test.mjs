/**
 * Real CPAN resource packages omit callback and borrowed-result capabilities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedPerl } from "../src/build/owned-perl-projection.mjs";
import { archiveCpanPackage, readVerifiedCpanPackage } from "../src/release/cpan-package.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedReceiverConfiguration, ownedReceiverSource } from "./helpers/owned-receiver-fixture.mjs";
import { ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedPerlPlainReceiverProbe } from "./helpers/owned-perl-receiver-fixture.mjs";
import { runInstalledPerlReceivers } from "./helpers/owned-perl-receiver-installed.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`installed CPAN resource receivers need no callback artifacts (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const consuming = mode === "reviewed";
	const config = consuming ? { schemaVersion: 1, modules: ["Owned"] } : await ownedReceiverConfiguration();
	if(!consuming)
	{
		config.exports = ["Owned.newTicket", "Owned.serial", "Owned.retainTicket"];
		config.arities = {};
		config.contracts = { "Owned.serial": { receiver: "property" }, "Owned.retainTicket": { receiver: "method" } };
	}
	config.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-perl-resource-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(author, "project");
	const output = join(author, "producer"), handoff = join(directory, "handoff");
	const perls = perlGraphCommands();
	const environment = { ...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify(perls) };
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedReceiverSource);
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(consuming) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustPlainReceiverReviewedIr(true)));
	const before = await lakeInputState(project);
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	const native = await buildNativeComponent({ projectRoot: project
		, outputRoot: nativeRoot
		, runtimeRoot, leanPrefix, targets: ["cpan"], ownedGraphs: true
		, ownedReceiverExports: true, ownedHostCallbacks: false
		, ownedInputTransfers: consuming, ownedAnchoredResults: false });
	const built = await projectOwnedPerl({ working: output, nativeRoot, runtimeRoot
		, leanPrefix, settings: config.targets.cpan, environment });
	assert.deepEqual(await lakeInputState(project), before);
	await writeNativePackageSet({ root: output, model: native.model
		, runtimeIdentity: native.receipt.runtimeIdentity, projections: [built] });
	const prepared = await readVerifiedCpanPackage(join(output, "packages/component"));
	const { ownedValues: owned } = prepared.manifest;
	assert.equal(owned.schemaVersion, 4); assert.equal(owned.resultAnchors, undefined);
	assert.equal(Boolean(owned.inputTransfers), consuming);
	assert.equal(native.model.ownedGraph.hostCallbacks, undefined);
	assert.ok(!prepared.files.has("callbacks.c"));
	for(const name of ["runtime", "component"])
	{
		const again = await archiveCpanPackage({ packageRoot: join(output, "packages", name), outputRoot: join(author, "reassembled") });
		assert.deepEqual(await readFile(again.path), await readFile(join(output, "archives", again.receipt.archive)));
	}
	const packageSetReceipt = await copyPackageSetHandoff(output, handoff);
	const input = { metadata: JSON.parse(prepared.files.get("metadata.json")), sourceIdentity: native.model.sourceIdentity, component: native.model.component };
	await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const archives = await Promise.all(built.packages.map(async pkg => ({ ...pkg, bytes: await readFile(join(handoff, "archives", pkg.archive)) })));
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const source = ownedPerlPlainReceiverProbe(consuming);
	const observations = await runInstalledPerlReceivers({ directory
		, archives, perls, owned, source, expectedChecks: consuming ? 11 : 8
		, diagnostic: text => t.diagnostic(text) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	await saveLakeFile("build/owned-perl-receiver-core", `${mode}-resource-package.json`, canonicalJson({
		schemaVersion: 1, mode, consuming, actualLean: true, installedPackage: true
		, input, built, packageSetReceipt, observations, owned
		, manifest: prepared.manifest
		, componentReceipt: native.receipt, files: prepared.manifest.files
		, producerInterface: "native-build-api", hostCallbacks: false
		, sourceUnchanged: true, receiptVerifiedWithoutProducer: true
		, producerRemoved: true, handoffRemovedBeforeExecution: true, relocated: true
		, deterministicReassembly: true, consumerSha256: sha256(source)
	}));
});
