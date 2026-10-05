/**
 * Assemble callback-result Maven artifacts from authenticated Lean inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectNativeCFamily } from "../src/build/native-c-projection.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource
	, ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultCombinedConfiguration } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { rejectOwnedJvmPackageMutations } from "./helpers/owned-jvm-package-tamper.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { ownedJvmCallbackResultInstalledFixture } from "./helpers/owned-jvm-callback-result-installed.mjs";
import { inspectOwnedJvmInstalledAssets } from "./helpers/owned-jvm-installed-assets.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`installed Maven callback-result owners (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PACKAGE_TEST !== "1"
	, timeout: 3000000
}, async t => {
	const configuration = mode === "ordinary" ? await (combined
		? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { maven: { name: "org.leanbridge:owned-callback-results", version: "1.2.3" } };
	const context = await prepareOwnedReceiverCli(t, {
		label: `jvm-callback-installed-${mode}-${combined}`, configuration
		, reviewedIr: mode === "reviewed" ? (combined
			? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() : null
		, source: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, profiles: ["java", "kotlin"], buildTimeoutMs: 1200000
	});
	const { directory: root, project, output: working, environment, handoff, consumer } = context;
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const sourceBefore = await lakeInputState(project);
	const build = async destination => {
		if(combined) return context.build(destination);
		const runtimeRoot = join(destination, "native/runtime"), nativeRoot = join(destination, "native/component");
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const native = await buildNativeComponent({ projectRoot: project
			, outputRoot: nativeRoot
			, runtimeRoot, leanPrefix, targets: ["maven"], ownedGraphs: true
			, ownedHostCallbacks: false, ownedCallbackResultAnchors: true });
		const projections = await projectNativeCFamily({ working: destination
			, nativeRoot
			, runtimeRoot, leanPrefix, targets: ["maven"]
			, settings: configuration.targets, environment });
		await writeNativePackageSet({ root: destination, model: native.model
			, runtimeIdentity: native.receipt.runtimeIdentity, projections });
		context.builds.push({ producerInterface: "native-build-api", projections });
		assert.deepEqual(await lakeInputState(project), sourceBefore);
		return projections[0];
	};
	t.diagnostic(`${mode}/${combined ? "combined" : "no-host"}: building Maven package`);
	const built = await build(working);
	const runtimeRoot = join(working, "native/runtime"), nativeRoot = join(working, "native/component");
	assert.equal(built.backend, "owned-jvm-v5");
	const adapterRoot = join(working, "native/owned-jvm-binding"), jvmRoot = join(working, "native/jvm");
	const verified = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt, adapter, projection } = verified;
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["hostCallbacks", "resultAnchors", "receiverExports", "inputTransfers"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	if(combined) await access(join(nativeRoot, "callbacks.c"));
	else await assert.rejects(access(join(nativeRoot, "callbacks.c")), { code: "ENOENT" });
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.equal(adapter.jvmValues.schemaVersion, 5); assert.deepEqual(adapter.jvmValues, projection.contract);
	const compiled = await json(join(jvmRoot, "native-jvm.json"));
	assert.equal(compiled.schemaVersion, 5); assert.deepEqual(compiled.ownedValues, projection.contract);
	assert.ok(compiled.kotlin.options.includes("-Xuse-type-table"));
	const manifestRoot = join(working, "packages/maven/jar");
	const manifest = await json(join(manifestRoot, "META-INF/lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 5); assert.deepEqual(manifest.ownedValues, projection.contract);
	assert.deepEqual(manifest.ownedValues.callbackResultAnchors.signatures.map(({ id, parameter }) => ({ id, parameter }))
		, model.ownedGraph.callbackResultAnchors.signatures);
	for(const field of ["anchor", "descendants", "expiration", "hostResultHandoff"])
		assert.equal(manifest.ownedValues.callbackResultAnchors[field], model.ownedGraph.callbackResultAnchors[field]);
	await verifyNativeFiles(manifestRoot, manifest.files);
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: combined
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true };
	const incapable = ["ownedCallbackResultAnchors"
		, ...combined ? ["ownedHostCallbacks", "ownedInputTransfers"
			, "ownedAnchoredResults", "ownedReceiverExports"] : []];
	const capabilityErrors = {
		ownedCallbackResultAnchors: "native-owned-callback-anchors-unavailable"
		, ownedHostCallbacks: "native-owned-callbacks-unavailable"
		, ownedInputTransfers: "native-owned-transfers-unavailable"
		, ownedAnchoredResults: "native-owned-anchors-unavailable"
		, ownedReceiverExports: "native-owned-receivers-unavailable"
	};
	for(const key of incapable)
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity
			, { ...capabilities, [key]: false }), { code: capabilityErrors[key] });
	const packageOptions = { working: root, jvmRoot, nativeRoot
		, runtimeRoot, adapterRoot, leanPrefix
		, settings: { name: "org.leanbridge:owned-callback-results", version: "1.2.3" }
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const reassembledRoot = join(root, "reassembled");
	const reassembled = await packageOwnedMaven({ ...packageOptions, working: reassembledRoot });
	assert.deepEqual(reassembled.packages, built.packages);
	for(const pkg of built.packages)
		assert.deepEqual(await readFile(join(reassembledRoot, "archives", pkg.archive))
			, await readFile(join(working, "archives", pkg.archive)));
	await rm(reassembledRoot, { recursive: true });
	t.diagnostic(`${mode}/${combined ? "combined" : "no-host"}: independent producer rebuild`);
	const independent = join(root, "independent"), second = await build(independent);
	assert.deepEqual(second.packages, built.packages);
	const independentPackageSetReceipt = await json(join(independent, "package-set-receipt.json"));
	assert.deepEqual(independentPackageSetReceipt
		, await json(join(working, "package-set-receipt.json")));
	for(const pkg of built.packages)
		assert.deepEqual(await readFile(join(independent, "archives", pkg.archive))
			, await readFile(join(working, "archives", pkg.archive)));
	await rm(independent, { recursive: true });
	const tamperRejections = await rejectOwnedJvmPackageMutations(packageOptions, verified, compiled);
	assert.equal(tamperRejections.length, combined ? 51 : 30);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const handoffReceipt = await copyPackageSetHandoff(working, handoff);
	const pkg = handoffReceipt.packages.find(item => item.target === "maven");
	const dependencies = await prepareJvmCorpusDependencies({ directory: context.author
		, handoff, pkg, environment, clean: copiedCleanEnvironment });
	const fixture = ownedJvmCallbackResultInstalledFixture(projection.namespace, combined);
	const verification = await context.removeAuthor();
	for(const profile of ["java", "kotlin"])
		await cp(handoff, join(root, "handoff-" + profile), { recursive: true });
	await rm(handoff, { recursive: true });
	const observations = [];
	for(const profile of ["java", "kotlin"])
	{
		t.diagnostic(`${mode}/${profile}: offline Maven installation and runtime-only relocation`);
		const result = await installedJvmCorpus({ library: { jvmModule: projection.namespace }
			, profile, consumer, handoff: join(root, "handoff-" + profile), pkg
			, dependencies, environment, clean: copiedCleanEnvironment
			, fixture: { ...fixture, ...profile === "java" ? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		assert.deepEqual(result.observation.errors, []);
		assert.equal(result.jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
		const checks = Number(result.observation.results.find(item => item.id === "owned/callback-result-checks").observed.integer);
		assert.equal(checks, combined ? 47 : 22);
		if(profile === "java")
		{
			assert.equal(result.jvm.inspection.scenarios.length, 40);
			assert.ok(result.jvm.inspection.scenarios.every(item => item.rejected));
		}
		assert.equal(result.observation.results.filter(item => item.status === "rejected-at-compile-time").length
			, fixture.rejections(profile).length);
		observations.push({ profile, checks, ...result });
	}
	await saveLakeFile("build/owned-jvm-callback-results", `${mode}-${combined ? "combined" : "no-host"}-package.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, combined, compiledLean: true
		, input: { metadata, component: model.component, sourceIdentity: model.sourceIdentity }
		, componentReceipt: receipt
		, runtimeReceipt: verified.runtime
		, adapter
		, compiled
		, manifest
		, built, packageSetReceipt: handoffReceipt, cli: context.cli
		, cliInstallation: context.cliInstallation
		, builds: context.builds
		, verification
		, sourceRemovedBeforeInstallation: true, deterministicReassembly: true
		, independentProducerBuild: true
		, independentPackageSetReceipt
		, incapableReadersRejected: incapable
		, tamperRejections
		, dependencies
		, observations
	}));
	t.diagnostic(`${mode}/${combined ? "combined" : "no-host"}: ${tamperRejections.length} mutations rejected; installed Java/Kotlin consumers pass`);
});
