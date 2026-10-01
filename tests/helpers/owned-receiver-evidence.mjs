/**
 * Reconstruct receiver contracts and require compiled and installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedReceiverKinds, ownedReceiverSource, ownedReceiverProbe, ownedReceiverCopyMacros } from "./owned-receiver-fixture.mjs";
import { ownedReceiverMutants } from "./owned-receiver-mutants.mjs";
import { assertOwnedReceiverCi } from "./owned-receiver-ci.mjs";
import { ownedCppReceiverHistoricalBytes } from "./owned-cpp-receiver-history.mjs";

export const ownedReceiverCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-receivers";
export const ownedReceiverScope = Object.freeze({
	profiles: ["c"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedPackages: true
	, publicExports: 25, receiverExports: 15, resultAnchors: 20
	, compiledModel: 10, ownedGraph: 5, receiverFirst: true
	, receiverAnchors: true, remainingParameterAnchors: true
	, consumingReceivers: true, transitiveExpiration: true
	, receiverOnlyWithoutOptionalCapabilities: true
	, independentRetains: true, emptyValues: true, recursiveValues: true
	, returnedClosures: true, callbackReentry: true, allocationFaults: true
	, sanitizers: ["address", "undefined"], compiledNegativeVariants: 7
	, sourceFreeInstallation: true, offlineInstall: true, relocated: true
	, pkgConfig: true, cmake: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true
	, otherReceiverProjections: false, callbackResultAnchors: false
	, docker: false, installedSupportPromotions: 0
});
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true
	, ownedReceiverExports: true };
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, keys) => { for(const key of keys) assert.equal(value[key], true, key); };

/**
 * Check current generators against the archived source and execution evidence.
 *
 * @param record - Complete source-bound receipt for both receiver source paths.
 */
export const assertOwnedReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedReceiverScope);
	assert.equal(record.run.command, ownedReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 8, pass: 8, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	for(const key of ["runtime", "packages", "plain"])
		assert.deepEqual(record[key].map(item => item.mode), ["ordinary", "reviewed"]);
	const observations = record.run.text.split("\n")
		.filter(line => line.startsWith("# {"))
		.map(line => JSON.parse(line.slice(2)));
	assert.deepEqual(observations, [
		...record.runtime.map(item => ({ mode: item.mode, ...item.result }))
		, ...record.plain.map(item => ({ mode: item.mode, plain: true, ...item.result }))
	]);
	const base = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await ownedReceiverProbe();
	const plainProbe = await readFile("tests/fixtures/structured-types/owned-receiver-plain.c");
	for(const item of record.plain)
	{
		assert.equal(item.input.receiverExports, true);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(base));
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedReceiverExports: true });
		assert.deepEqual(item.model, model); assert.equal(model.exports.length, 3);
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.ownedGraph.receiverExports.exports.length, 2);
		for(const key of ["hostCallbacks", "resultAnchors", "inputTransfers"])
			assert.equal(model.ownedGraph[key], undefined);
		assert.equal(generateCompiledNativeLeanAdapters(model).callbackSource, undefined);
		assert.equal(item.sourceSha256, sha256(generateOwnedCPackage(item.input).source));
		assert.equal(item.probeSha256, sha256(plainProbe));
		assert.deepEqual(item.result, { checks: 14, identities: 0 });
	}
	const checkInput = (input, mode) => {
		flags(input, ["hostCallbacks", "transferredInputs", "anchoredResults", "receiverExports"]);
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(base + ownedReceiverSource));
		const model = createCompiledNativeModel(input, capabilities);
		assert.ok(generateCompiledNativeLeanAdapters(model).callbackSource);
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.exports.length, 25);
		const receiver = model.ownedGraph.receiverExports;
		assert.equal(receiver.callingConvention, "receiver-first");
		assert.equal(receiver.exports.length, 15);
		assert.deepEqual(Object.fromEntries(model.bindingIr.declarations.filter(item => item.receiver).map(item => [item.name, item.kind])), ownedReceiverKinds);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
		assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.primary"), { bindingId: "lean:Owned.primary", receiver: true });
		assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
		return model;
	};
	for(const item of record.runtime)
	{
		assert.deepEqual(item.model, checkInput(item.input, item.mode));
		assert.deepEqual(item.receivers, item.model.bindingIr.declarations.filter(declaration => declaration.receiver).map(declaration => declaration.id));
		const generated = generateOwnedCPackage(item.input);
		assert.equal(item.adapterSha256, sha256(generated.source));
		assert.equal(item.probeSha256, sha256(probe));
		assert.ok(item.result.checks > 3245); assert.equal(item.result.live, 0); assert.equal(item.result.identities, 0);
		for(const key of ["failures", "beforeFailures", "afterFailures"]) assert.ok(item.result[key] > 0);
		assert.equal(item.sanitizer, "address,undefined");
		assert.equal(typeof item.startupLeakBaseline, "string");
		assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
		assert.equal(item.restored, true);
		const mutations = ownedReceiverMutants(generated);
		assert.deepEqual(item.rejectedMutations, mutations.map(mutation => mutation.name));
		assert.deepEqual(item.mutations, mutations.map(mutation => ({ name: mutation.name
			, sourceSha256: sha256(mutation.source)
			, compiled: true, semanticRejection: true })));
		assert.equal(item.reviewedMismatchRejected, item.mode === "reviewed");
		assert.equal(item.rejected.length, item.mode === "ordinary" ? 7 : 0);
		for(const rejected of item.rejected)
		{ assert.equal(rejected.projection.status, "unsupported"); assert.equal(rejected.projection.reason, "export-contract-mismatch"); }
	}
	const page = await readFile("docs/consume/c.md", "utf8");
	const example = page.split("### Methods and properties\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	const cliConfig = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	for(const item of record.packages)
	{
		flags(item, ["sourceRemovedBeforeInstall", "cliRemovedBeforeConsumerInstall"
			, "relocated", "deterministicReassembly", "independentRebuild", "cmake"]);
		const input = { metadata: item.metadata
			, sourceIdentity: item.model.sourceIdentity
			, component: item.model.component, hostCallbacks: true
			, transferredInputs: true, anchoredResults: true, receiverExports: true };
		assert.deepEqual(item.model, checkInput(input, item.mode));
		const generated = generateOwnedCPackage(input);
		const { model, receipt, adapter, manifest } = item;
		assert.equal(receipt.schemaVersion, 6); assert.equal(adapter.schemaVersion, 6);
		assert.equal(manifest.schemaVersion, 6); assert.equal(adapter.ownedValues.schemaVersion, 5);
		for(const field of ["receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.deepEqual(receipt[field], model.ownedGraph[field]);
			assert.deepEqual(adapter.ownedValues[field], model.ownedGraph[field]);
		}
		assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
		assert.equal(receipt.callbackSourceSha256, model.ownedGraph.hostCallbacks.trampolineSha256);
		assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(receipt)));
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(generated.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(generated.source));
		assert.equal(manifest.files[`include/${generated.values.prefix}.h`].sha256, sha256(generated.publicHeader));
		const publicSources = Object.keys(generated.files).filter(path => path.startsWith("src/") || path.startsWith("include/"));
		assert.deepEqual(Object.keys(adapter.files).filter(path => path.startsWith("src/") || path.startsWith("include/")).sort(), publicSources.sort());
		assert.equal(item.rejected, 10 + publicSources.length);
		flags(item.installed, ["compilerFreePath", "offlineInstall"]);
		assert.ok(item.installed.checks > 1215);
		assert.ok(record.run.text.includes(`${item.mode}: ${item.installed.checks} installed receiver assertions, original archives reproduced, relocated CMake passed`));
		assert.equal(item.probeSha256, sha256("#define LEAN_BRIDGE_BORROW_INSTALLED 1\n" + probe.replace('#include "borrow-copies.h"', ownedReceiverCopyMacros(generated.values))));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\nreceiver released: view expired\n" });
		assert.equal(item.packages.length, 1);
		assert.equal(item.packages[0].archive, "owned-receivers-1.2.3-c.tar.gz");
		assert.equal(item.packages[0].compilerAccess, false); digest(item.packages[0].sha256);
		assert.ok(item.packages[0].bytes > 0);
		const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
		assert.equal(item.cli.kind, "lean-bridge-cli-package");
		assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
		assert.equal(item.cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
		digest(archive.sha256); assert.ok(archive.bytes > 0);
		assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
		assert.equal(item.cli.files.length, cliConfig.files.length + 2);
		assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
		for(const path of cliConfig.files)
		{
			const file = item.cli.files.find(entry => entry.path === path);
			const bytes = Buffer.from(ownedCppReceiverHistoricalBytes(path, await readFile(path), file?.sha256));
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.builds.length, 2);
		for(const build of item.builds)
		{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["c"]); }
		assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verificationType, "local-package-set");
	}
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
	assertOwnedReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
