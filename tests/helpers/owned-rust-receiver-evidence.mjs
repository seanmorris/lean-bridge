/**
 * Bind Rust receiver claims to independently compiled and installed executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compiledPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { ownedRustBorrowNativeSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverSource, ownedRustReceiverProbe, ownedRustPlainReceiverProbe } from "./owned-rust-receiver-fixture.mjs";
import { ownedRustReceiverLinker } from "./owned-rust-receiver-fixture.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { assertOwnedRustReceiverCi } from "./owned-rust-receiver-ci.mjs";
import { ownedPythonReceiverHistoricalBytes } from "./owned-python-receiver-history.mjs";

export const ownedRustReceiverCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-rust-receivers";
export const ownedRustReceiverScope = Object.freeze({
	profiles: ["rust"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedPackages: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalMembers: true, propertyAccessors: true
	, mutableConsumingReceivers: true
	, receiverAnchors: true, remainingParameterAnchors: true
	, receiverOnlyWithoutOptionalCapabilities: true, consumingWithoutAnchors: true
	, transitiveExpiration: true, independentRetains: true
	, emptyValues: true, recursiveValues: true, returnedClosures: true
	, callbackReentry: true, allocationFaults: true, panicCleanup: true
	, compileTimeRejections: 6, compiledNegativeVariants: 3
	, sourceFreeInstallation: true, emptyCargoHome: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});
const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const nativeOptions = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true
	, ownedReceiverExports: true };
const trueFields = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Reconstruct generated APIs and require each captured execution on both paths.
 *
 * @param record - Complete ten-test acceptance record, not concatenated logs.
 */
export const assertOwnedRustReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedRustReceiverScope);
	assert.equal(record.run.command, ownedRustReceiverCommand); assert.equal(record.run.exitCode, 0);
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
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await ownedRustReceiverProbe();
	const sourceIdentity = (input, mode, suffix) => {
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(lean + suffix));
	};
	const mixed = (input, mode) => {
		trueFields(input, ["hostCallbacks", "transferredInputs", "anchoredResults", "receiverExports"]);
		sourceIdentity(input, mode, ownedRustReceiverSource);
		const model = createCompiledNativeModel(input, nativeOptions);
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
		return { model, c: generateOwnedCPackage(input)
			, rust: generateOwnedRustCallables(model.bindingIr, options) };
	};
	for(const item of record.runtime)
	{
		const { c, rust } = mixed(item.input, item.mode);
		trueFields(item, ["actualLean", "restored"]); assert.equal(item.installedPackage, false);
		assert.equal(item.apiSha256, sha256(rust.apiSource)); assert.equal(item.conversionsSha256, sha256(rust.source));
		assert.equal(item.nativeSha256, sha256(ownedRustBorrowNativeSource(c))); assert.equal(item.probeSha256, sha256(probe));
		assert.ok(item.result.checks > 300); assert.equal(item.result.live, 0); assert.equal(item.result.identities, 0);
		for(const key of ["rustFaults", "nativeFaults", "panicFaults", "before", "after"]) assert.ok(item.result[key] > 0, key);
		assert.deepEqual(item.rejected, ["wrong-owner", "raw-receiver-anchor", "raw-parameter-anchor", "immutable-receiver", "reject-send", "reject-sync"]);
		const index = rust.c.functions.findIndex(value => value.name === "chooseTicket");
		const source = rust.apiSource + "\nmod owned_values;\n";
		const mutations = [
			["receiver-used-as-other-argument-anchor"
				, `owned_values::owned_invoke${index}(self.get()?, a1)`
				, `{ let _ = a1; owned_values::owned_invoke${index}(self.get()?, self) }`]
			, ["missing-whole-value-validation", "storage.lease.require()?; Ok(&storage.value)", "Ok(&storage.value)"]
			, ["callback-receiver-escape"
				, "impl Drop for BorrowFrame { fn drop(&mut self) { self.active.set(false); } }"
				, "impl Drop for BorrowFrame { fn drop(&mut self) { let _ = self.active.get(); } }"]
		];
		assert.deepEqual(item.mutations, mutations.map(([name, before, after]) => {
			assert.equal(source.split(before).length, 2);
			return { name, compiled: true, semanticRejection: true, sourceSha256: sha256(source.replace(before, after)) };
		}));
	}
	for(const item of record.plain)
	{
		sourceIdentity(item.input, item.mode, ownedReceiverSource);
		assert.equal(item.input.receiverExports, true); assert.equal(item.input.transferredInputs, item.consuming);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: item.consuming });
		assert.deepEqual(item.model, model); assert.equal(model.exports.length, item.consuming ? 4 : 3);
		assert.equal(model.ownedGraph.receiverExports.exports.length, item.consuming ? 3 : 2);
		assert.equal(model.ownedGraph.hostCallbacks, undefined); assert.equal(model.ownedGraph.resultAnchors, undefined);
		if(!item.consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		const rust = generateOwnedRustCallables(model.bindingIr, { receiverExports: true, transferredInputs: item.consuming, hostCallbacks: false });
		assert.equal(item.apiSha256, sha256(rust.apiSource)); assert.equal(item.conversionsSha256, sha256(rust.source));
		assert.equal(item.sourceSha256, sha256(generateOwnedCPackage(item.input).source));
		assert.equal(item.probeSha256, sha256(ownedRustPlainReceiverProbe(item.consuming)));
		assert.deepEqual(item.result, { checks: item.consuming ? 9 : 8, identities: 0 });
	}
	const example = await readFile("tests/fixtures/documentation/consumers/rust/owned-receivers.rs", "utf8");
	assert.equal((await readFile("docs/consume/rust.md", "utf8")).match(/```rust file=rust\/owned-receivers\.rs\n([\s\S]*?)```/u)?.[1], example);
	const cliConfig = JSON.parse(ownedPythonReceiverHistoricalBytes("config/cli-package.v1.json", await readFile("config/cli-package.v1.json"), record.sources["config/cli-package.v1.json"]).toString());
	for(const item of record.packages)
	{
		trueFields(item, ["sourceRemovedBeforeInstall"
			, "cliRemovedBeforeConsumerInstall"
			, "independentRebuild", "deterministicReassembly", "sourceFreeInstallation"
			, "emptyCargoHome", "offlineInstall", "sourceFreeRelocatedExecution"
			, "handoffRemovedBeforeRelocatedExecution"]);
		const input = { metadata: item.metadata
			, sourceIdentity: item.model.sourceIdentity
			, component: item.model.component, hostCallbacks: true, ...options };
		const { model, c } = mixed(input, item.mode); assert.deepEqual(item.model, model);
		const { receipt, adapter, compiled, manifest } = item;
		const rust = generateOwnedRustPackage(model.bindingIr, compiled.evidence, {
			name: "owned-receivers", version: "1.2.3"
			, metadata: compiledPackageMetadata(model.sourceIdentity)
		}, options);
		assert.equal(receipt.schemaVersion, 6); assert.equal(adapter.schemaVersion, 6); assert.equal(adapter.ownedValues.schemaVersion, 5);
		assert.equal(compiled.schemaVersion, 5); assert.equal(manifest.schemaVersion, 5);
		assert.equal(rust.contract.schemaVersion, 4); assert.equal(rust.contract.receiverExports.exports.length, 16);
		for(const contract of [adapter.rustValues, compiled.ownedValues, manifest.ownedValues, compiled.evidence.ownedValues])
			assert.deepEqual(contract, rust.contract);
		for(const field of ["receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.deepEqual(receipt[field], model.ownedGraph[field]);
			assert.deepEqual(adapter.ownedValues[field], model.ownedGraph[field]);
		}
		assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
		assert.equal(receipt.callbackSourceSha256, model.ownedGraph.hostCallbacks.trampolineSha256);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(receipt)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		for(const [path, source] of Object.entries(rust.files))
		{
			assert.equal(compiled.files[path].sha256, sha256(source), path);
			assert.equal(manifest.files[path].sha256, sha256(source), path);
		}
		assert.equal(item.rejected, 21); assert.equal(item.incapableReadersRejected, 4);
		assert.ok(item.checks > 300); assert.equal(item.relocatedChecks, item.checks);
		assert.ok(record.run.text.includes(`${item.mode}: ${item.checks} installed Rust receiver assertions, original archives reproduced, relocated execution passed`));
		assert.equal(item.consumerSha256, sha256("use owned_receivers::*;\n" + probe));
		assert.equal(item.linkerSha256, sha256(ownedRustReceiverLinker));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n42\n" });
		assert.equal(compiled.files["Cargo.lock"].sha256, item.dependencies.lockSha256);
		assert.ok(item.dependencies.packages.some(pkg => pkg.directory === "num-bigint-0.4.6"));
		assert.ok(item.dependencies.packages.some(pkg => pkg.directory === "sha2-0.10.9"));
		assert.equal(item.packages.length, 1); assert.equal(item.packages[0].archive, "owned-receivers-1.2.3.crate");
		assert.equal(item.packages[0].compilerAccess, false); assert.ok(item.packages[0].bytes > 0);
		assert.match(item.packages[0].sha256, /^[a-f0-9]{64}$/u);
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
			const bytes = Buffer.from(ownedPythonReceiverHistoricalBytes(path, await readFile(path), file.sha256));
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.builds.length, 2);
		for(const build of item.builds)
		{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["cargo"]); }
		assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verificationType, "local-package-set");
	}
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
	assertOwnedRustReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
