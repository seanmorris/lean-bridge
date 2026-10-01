/**
 * Authenticate installed CPAN receiver APIs and runtime-only consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedPerlPackage } from "../../src/backends/perl/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedPerlReceiverProbe, ownedPerlPlainReceiverProbe } from "./owned-perl-receiver-fixture.mjs";
import { assertOwnedPerlReceiverInputs, assertOwnedPerlReceiverMatrix, assertOwnedPerlReceiverObservation
	, ownedPerlReceiverCommand, ownedPerlReceiverVariant } from "./owned-perl-receiver-evidence.mjs";

export const ownedPerlReceiverScope = Object.freeze({
	profiles: ["perl"], abiVariants: 4
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installationModes: ["prebuilt-only", "build-xs"]
	, compiledLean: true, installedCli: true, installedCpan: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalOwners: true, readOnlyProperties: true, originalOwnerTransfers: true
	, nominalShareRetainCopy: true, receiverAnchors: true
	, remainingParameterAnchors: true, returnedClosures: true
	, receiverOnlyWithoutOptionalCapabilities: true
	, consumingWithoutAnchors: true, callbacksWithoutAnchors: true
	, installedReceiverOnly: true, transitiveExpiration: true
	, independentRetains: true, emptyValues: true, recursiveValues: true
	, callbackReentry: true, managedAllocationFaults: true
	, nativeAllocationFaults: true, retainedExceptions: true
	, forkRejection: true, interpreterThreadRejection: true
	, compiledNegativeVariants: 7, sourceFreeInstallation: true
	, offlineInstall: true, sourceFreeRelocatedExecution: true
	, compilerFreeExecution: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true
	, combinedCRelease: true, privateGmp: true, coldAndWarmAssetRejections: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};

const assertCli = async item => {
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
	assert.equal(item.cli.kind, "lean-bridge-cli-package");
	assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
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
	{
		assert.equal(build.status, "ok"); assert.equal(build.exitCode, 0);
		assert.deepEqual(build.result.targets, ["cpan"]);
		assert.equal(build.result.backend, "perl"); assert.equal(build.result.packages.length, 2);
	}
	assert.equal(item.cliVerification.status, "ok");
	assert.equal(item.cliVerification.result.verificationType, "local-package-set");
	flags(item, ["independentProducerBuild"]);
};

/**
 * Rebuild generated files from captured Lean inputs, not from report booleans.
 *
 * @param item - Installed CPAN report from one author path.
 * @param plain - Resource-only, callback-free lower-level native build.
 */
export const assertOwnedPerlReceiverPackage = async (item, plain = false) => {
	flags(item, ["actualLean", "installedPackage", "sourceUnchanged"
		, "deterministicReassembly", "producerRemoved"
		, "handoffRemovedBeforeExecution"
		, "receiptVerifiedWithoutProducer", "relocated"]);
	assert.equal(item.schemaVersion, 1);
	const consuming = plain ? item.consuming : true;
	const model = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedReceiverExports: true, ownedHostCallbacks: !plain
		, ownedInputTransfers: consuming, ownedAnchoredResults: !plain });
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(model.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256
		, sha256(lean + (plain ? ownedReceiverSource : ownedRustReceiverSource)));
	const { manifest, componentReceipt: component, owned } = item;
	assert.deepEqual(item.files, manifest.files); assert.deepEqual(owned, manifest.ownedValues);
	assert.equal(manifest.module, "LeanBridge::OwnedProbe"); assert.equal(manifest.prebuilt.length, 4);
	const native = generateCompiledNativeLeanAdapters(model);
	assert.equal(component.schemaVersion, 6); assert.equal(component.profile, "native-library-v1");
	assert.equal(component.runtimeIdentity, manifest.nativeRuntimeIdentity);
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
	assert.deepEqual(component.sourceIdentity, item.input.sourceIdentity);
	for(const field of ["inputTransfers", "resultAnchors", "receiverExports"])
		assert.deepEqual(component[field], model.ownedGraph[field]);
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, plain ? undefined : sha256(native.callbackSource));
	const nativePath = "lib/LeanBridge/OwnedProbe/native/";
	assert.equal(owned.componentLibrary, component.library);
	assert.equal(owned.gmpLibrary, "libgmp-lean-bridge.so.10");
	assert.equal(component.nativeLibrary.sha256, item.files[nativePath + component.library]);
	assert.ok(component.nativeLibrary.bytes > 0);
	const generated = generateOwnedPerlPackage({ model
		, metadata: item.input.metadata
		, receipt: { ...component, runtimeIdentity: manifest.runtimeIdentity }
		, moduleName: manifest.module
		, gmpSha256: item.files[nativePath + owned.gmpLibrary] });
	assert.deepEqual(owned, generated.owned); assert.equal(owned.schemaVersion, 4);
	for(const [path, source] of Object.entries(generated.files))
	{
		const expected = path.endsWith(".pm") ? source.replace("our $VERSION = '0.001';", `our $VERSION = '${manifest.version}';`)
			.replace("use LeanBridge::Runtime;", `use LeanBridge::Runtime;\ndie "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${manifest.runtimeVersion}';`) : source;
		assert.equal(item.files[path], sha256(expected), path);
	}
	for(const [path, source] of Object.entries({ "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(item.input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "native-component.json": canonicalJson(component)
		, "component.h": native.header, "generated.lean": native.leanSource
		, ...plain ? {} : { "callbacks.c": native.callbackSource } }))
		assert.equal(item.files[path], sha256(source), path);
	if(plain) assert.equal(item.files["callbacks.c"], undefined);
	for(const [path, hash] of Object.entries(item.files))
	{ assert.ok(!path.startsWith("/") && !path.split("/").includes("..")); digest(hash); }
	assert.equal(item.consumerSha256, sha256(plain ? ownedPerlPlainReceiverProbe(consuming) : await ownedPerlReceiverProbe()));
	validatePackageSetReceipt(item.packageSetReceipt);
	assert.equal(item.packageSetReceipt.profiles.length, 1);
	assert.equal(item.packageSetReceipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	assert.equal(item.packageSetReceipt.packages.length, 2);
	const built = plain ? item.built : item.cliBuilds[0].result;
	assert.equal(built.packages.length, 2);
	for(const pkg of built.packages)
	{
		assert.equal(new Set(pkg.abiVariants).size, 4);
		for(const abi of pkg.abiVariants) digest(abi);
		const artifact = item.packageSetReceipt.packages.flatMap(pkg => pkg.artifacts)
			.find(file => file.path === "archives/" + pkg.archive);
		assert.equal(artifact.sha256, pkg.sha256); assert.ok(artifact.bytes > 0);
	}
	if(plain)
	{
		assert.equal(item.producerInterface, "native-build-api"); assert.equal(item.hostCallbacks, false);
		assert.equal(owned.resultAnchors, undefined); assert.equal(Boolean(owned.inputTransfers), consuming);
	}
	else
	{
		assert.equal(model.exports.length, 27);
		assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
		assert.deepEqual(item.tamperRejections, ["schema", "missing", "anchor"
			, "empty", "ownership", "export", "binding", "model", "receipt", "xs"
			, "c-source", "header", "module", "library"
			, ...["values", "members", "properties", "owners", "consumingReceivers", "exports"].map(name => "receiver-" + name)]);
		await assertCli(item);
	}
	assertOwnedPerlReceiverMatrix(item.observations, true);
	const assets = sha256(await readFile("tests/fixtures/structured-types/owned-perl-installed-assets.pl"));
	for(const observation of item.observations)
	{
		const { mode, assets: inspected } = observation;
		const checks = plain ? consuming ? 11 : 8 : ownedPerlReceiverVariant(observation.perl).endsWith("unthreaded") ? 216 : 218;
		assertOwnedPerlReceiverObservation(observation, checks, true);
		assert.equal(observation.runtimeOnlyRuns, 2); assert.equal(inspected.sourceSha256, assets);
		assert.deepEqual(inspected.observations.map(item => item.asset + ":" + item.mode)
			, ["OwnedProbe.so", owned.gmpLibrary, owned.componentLibrary].flatMap(asset => ["cold", "warm"].map(mode => asset + ":" + mode)));
		for(const asset of inspected.observations)
		{
			assert.equal(asset.checks, 7); assert.equal(asset.brokerIdentities, 0); digest(asset.originalSha256);
			if(asset.asset === "OwnedProbe.so" && mode === "prebuilt-only")
				assert.ok(Object.entries(item.files).some(([path, hash]) => path.startsWith("prebuilt/") && path.endsWith("/OwnedProbe.so") && hash === asset.originalSha256));
			else if(asset.asset !== "OwnedProbe.so") assert.equal(item.files[nativePath + asset.asset], asset.originalSha256);
		}
	}
};

/**
 * Require both complete CLI builds and both independent optional-capability builds.
 *
 * @param record - Complete installed receiver milestone.
 */
export const assertOwnedPerlReceiverPackages = async record => {
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.resourcePackages.map(item => [item.mode, item.consuming]), [["ordinary", false], ["reviewed", true]]);
	for(const item of record.packages) await assertOwnedPerlReceiverPackage(item);
	for(const item of record.resourcePackages) await assertOwnedPerlReceiverPackage(item, true);
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
};

const block = (text, heading, language) => {
	const sections = text.split(heading + "\n"); assert.equal(sections.length, 2);
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const matches = [...section.matchAll(new RegExp("^```" + language + "\\n([^]*?)^```", "gmu"))];
	assert.equal(matches.length, 1, heading + "/" + language); return matches[0][1];
};

/**
 * Match the installed example to the exact current author and consumer guides.
 *
 * @param documentation - The compiled and relocated eight-installation report.
 */
export const assertOwnedPerlReceiverDocumentation = async documentation => {
	flags(documentation, ["actualLean", "installedPackage", "cliIntegrated"
		, "anchoredResults", "producerRemoved", "handoffRemoved"
		, "sourceUnchanged", "relocated"]);
	assert.equal(documentation.consumingInputs, false);
	assert.deepEqual(documentation.mixedTargets, ["c", "cpan"]);
	assert.equal(documentation.cliBuild.status, "ok");
	assert.deepEqual(documentation.cliBuild.result.targets, documentation.mixedTargets);
	validatePackageSetReceipt(documentation.packageSetReceipt);
	assert.deepEqual([...new Set(documentation.packageSetReceipt.packages.map(pkg => pkg.target))], ["c", "cpan"]);
	assert.equal(documentation.packageSetReceipt.profiles.length, 1);
	assertOwnedPerlReceiverMatrix(documentation.observations, true);
	for(const observed of documentation.observations)
	{ assert.equal(observed.stdout, "42\nexpired\n42\n"); assert.equal(observed.stderr, ""); }
	const author = await readFile("docs/publish/cpan.md", "utf8");
	const consumer = await readFile("docs/consume/perl.md", "utf8");
	const config = { ...JSON.parse(block(author, "## Export resource-containing values", "json"))
		, contracts: JSON.parse(block(author, "## Export methods and properties", "json")) };
	assert.deepEqual(documentation.sourceHashes, {
		lean: sha256(block(author, "## Export resource-containing values", "lean"))
		, config: sha256(canonicalJson(config))
		, example: sha256(block(consumer, "### Methods and properties", "perl"))
	});
};

/**
 * Require one complete enabled execution and every source-bound observation.
 *
 * @param record - Frozen final milestone with all thirteen reports.
 */
export const assertOwnedPerlReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPerlReceiverScope);
	assert.equal(record.run.command, ownedPerlReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 16, pass: 16, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedPerlReceiverInputs(record);
	await assertOwnedPerlReceiverPackages(record);
	await assertOwnedPerlReceiverDocumentation(record.documentation);
};
