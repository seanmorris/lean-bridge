/**
 * Reconstruct C++ receiver APIs and require compiled and installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedCppReceiverSource, ownedCppReceiverProbe, ownedCppPlainReceiverProbe } from "./owned-cpp-receiver-fixture.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { assertOwnedCppReceiverCi } from "./owned-cpp-receiver-ci.mjs";
import { ownedRustReceiverHistoricalBytes } from "./owned-rust-receiver-history.mjs";

export const ownedCppReceiverCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-cpp-receivers";
export const ownedCppReceiverScope = Object.freeze({
	profiles: ["cpp"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedPackages: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalMembers: true, propertyAccessors: true, rvalueConsumingReceivers: true
	, receiverAnchors: true, remainingParameterAnchors: true
	, receiverOnlyWithoutOptionalCapabilities: true, consumingWithoutAnchors: true
	, transitiveExpiration: true, independentRetains: true
	, emptyValues: true, recursiveValues: true, returnedClosures: true
	, callbackReentry: true, allocationFaults: true
	, sanitizers: ["address", "undefined"], compiledNegativeVariants: 3
	, sourceFreeInstallation: true, offlineInstall: true, relocated: true
	, pkgConfig: true, cmake: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});
const cppOptions = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const nativeOptions = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true
	, ownedReceiverExports: true };
const trueFields = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Bind executable observations to the same compiler inputs and package sources.
 *
 * @param record - Complete candidate receipt, never a partial observation log.
 */
export const assertOwnedCppReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedCppReceiverScope);
	assert.equal(record.run.command, ownedCppReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 10, pass: 10, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	for(const key of ["runtime", "packages"])
		assert.deepEqual(record[key].map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	const observations = record.run.text.split("\n").filter(line => line.startsWith("# {"))
		.map(line => canonicalJson(JSON.parse(line.slice(2)))).sort();
	assert.deepEqual(observations, [
		...record.runtime.map(item => ({ mode: item.mode, ...item.result }))
		, ...record.plain.map(item => ({ mode: item.mode, consuming: item.consuming, ...item.result }))
	].map(canonicalJson).sort());
	const leanSource = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await ownedCppReceiverProbe();
	const sourceIdentity = (input, mode, suffix) => {
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(leanSource + suffix));
	};
	const mixed = (input, mode) => {
		trueFields(input, ["hostCallbacks", "transferredInputs", "anchoredResults", "receiverExports"]);
		sourceIdentity(input, mode, ownedCppReceiverSource);
		const model = createCompiledNativeModel(input, nativeOptions);
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.exports.length, 27);
		assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
		const c = generateOwnedCPackage(input), cpp = generateOwnedCppPackage(model.bindingIr, cppOptions);
		assert.equal(cpp.contract.schemaVersion, 4); assert.equal(cpp.contract.receiverExports.exports.length, 16);
		return { c, cpp, model };
	};
	for(const item of record.runtime)
	{
		const { c, cpp } = mixed(item.input, item.mode);
		assert.deepEqual(item.contract, cpp.contract);
		assert.equal(item.sourceSha256, sha256(c.source)); assert.equal(item.probeSha256, sha256(probe));
		for(const result of [item.result, item.sanitizer])
		{
			assert.ok(result.checks > 300); assert.equal(result.live, 0); assert.equal(result.identities, 0);
			for(const key of ["cppFaults", "nativeFaults", "before", "after"]) assert.ok(result[key] > 0, key);
		}
		assert.equal(item.restored, true); assert.equal(typeof item.startupLeakBaseline, "string");
		assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
		const index = cpp.c.functions.findIndex(value => value.name === "chooseTicket");
		const mutations = [
			["receiver-used-as-other-argument-anchor", `include/${cpp.c.prefix}.hpp`
				, `return owned_invoke${index}(self.get(), a1);`
				, `(void)a1; return owned_invoke${index}(self.get(), self);`]
			, ["missing-whole-receiver-validation", `include/${cpp.c.prefix}-values.hpp`
				, "storage_->lease->require(); return storage_->value;"
				, "return storage_->value;"]
			, ["callback-receiver-escape", `include/${cpp.c.prefix}-values.hpp`
				, "~BorrowFrame() { scope->active.store(false); }", "~BorrowFrame() {}"]
		];
		assert.deepEqual(item.mutations, mutations.map(([name, path, before, after]) => {
			assert.equal(cpp.files[path].split(before).length, 2);
			return { name, compiled: true, sourceSha256: sha256(cpp.files[path].replace(before, after)), semanticRejection: true };
		}));
	}
	for(const item of record.plain)
	{
		sourceIdentity(item.input, item.mode, ownedReceiverSource);
		assert.equal(item.input.receiverExports, true); assert.equal(item.input.transferredInputs, item.consuming);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true
			, ownedReceiverExports: true, ownedInputTransfers: item.consuming });
		assert.deepEqual(item.model, model); assert.equal(model.exports.length, item.consuming ? 4 : 3);
		assert.equal(model.ownedGraph.receiverExports.exports.length, item.consuming ? 3 : 2);
		assert.equal(model.ownedGraph.hostCallbacks, undefined); assert.equal(model.ownedGraph.resultAnchors, undefined);
		if(!item.consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(item.sourceSha256, sha256(generateOwnedCPackage(item.input).source));
		assert.deepEqual(item.contract, generateOwnedCppPackage(model.bindingIr, { receiverExports: true
			, transferredInputs: item.consuming, hostCallbacks: false }).contract);
		assert.equal(item.probeSha256, sha256(ownedCppPlainReceiverProbe(item.consuming)));
		assert.deepEqual(item.result, { checks: item.consuming ? 9 : 8, identities: 0 });
	}
	const page = await readFile("docs/consume/cpp.md", "utf8");
	const example = page.match(/```cpp file=cpp\/owned-receivers\.cpp\n([\s\S]*?)```/u)?.[1];
	assert.ok(example);
	const cliConfig = JSON.parse(ownedRustReceiverHistoricalBytes("config/cli-package.v1.json", await readFile("config/cli-package.v1.json"), record.sources["config/cli-package.v1.json"]).toString());
	for(const item of record.packages)
	{
		trueFields(item, ["sourceRemovedBeforeInstall"
			, "cliRemovedBeforeConsumerInstall"
			, "relocated", "deterministicReassembly", "independentRebuild", "cmake"]);
		const input = { metadata: item.metadata
			, sourceIdentity: item.model.sourceIdentity
			, component: item.model.component, hostCallbacks: true, ...cppOptions };
		const { c, cpp, model } = mixed(input, item.mode);
		assert.deepEqual(item.model, model);
		const { receipt, adapter, manifest } = item;
		assert.equal(receipt.schemaVersion, 6); assert.equal(adapter.schemaVersion, 6); assert.equal(manifest.schemaVersion, 6);
		assert.equal(adapter.ownedValues.schemaVersion, 5);
		assert.deepEqual(adapter.cppValues, cpp.contract); assert.deepEqual(manifest.cppValues, cpp.contract);
		assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
		for(const field of ["receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.deepEqual(receipt[field], model.ownedGraph[field]);
			assert.deepEqual(adapter.ownedValues[field], model.ownedGraph[field]);
		}
		assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
		assert.equal(receipt.callbackSourceSha256, model.ownedGraph.hostCallbacks.trampolineSha256);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(receipt)));
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		for(const [path, source] of Object.entries(cpp.files).filter(([path]) => path.startsWith("include/")))
			assert.equal(manifest.files[path].sha256, sha256(source), path);
		const generatedSources = Object.keys({ ...c.files, ...cpp.files }).filter(path => /^(?:src|include)\/owned_aggregates(?:[.-]|$)/u.test(path));
		assert.equal(item.rejected, 18 + generatedSources.length);
		trueFields(item.installed, ["compilerFreePath", "offlineInstall"]); assert.ok(item.installed.checks > 300);
		assert.ok(record.run.text.includes(`${item.mode}: ${item.installed.checks} installed C++ receiver assertions, original archives reproduced, relocated CMake passed`));
		assert.equal(item.probeSha256, sha256("#define OWNED_BORROW_INSTALLED 1\n" + probe));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n42\n" });
		assert.equal(item.packages.length, 1); assert.equal(item.packages[0].archive, "owned-cpp-receivers-1.2.3-cpp.tar.gz");
		assert.equal(item.packages[0].compilerAccess, false);
		assert.match(item.packages[0].sha256, /^[a-f0-9]{64}$/u); assert.ok(item.packages[0].bytes > 0);
		const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
		assert.equal(item.cli.kind, "lean-bridge-cli-package"); assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
		assert.equal(item.cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
		assert.match(archive.sha256, /^[a-f0-9]{64}$/u); assert.ok(archive.bytes > 0);
		assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
		assert.equal(item.cli.files.length, cliConfig.files.length + 2);
		assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
		for(const path of cliConfig.files)
		{
			const file = item.cli.files.find(file => file.path === path);
			const bytes = Buffer.from(ownedRustReceiverHistoricalBytes(path, await readFile(path), file.sha256));
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.builds.length, 2);
		for(const build of item.builds)
		{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["cpp"]); }
		assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verificationType, "local-package-set");
	}
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
	assertOwnedCppReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
