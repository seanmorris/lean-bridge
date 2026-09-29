/**
 * Require compiler-derived move contracts and actual installed Rust execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedRustCallables } from "../../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { historicalOwnedTransferPackage } from "./owned-transfer-generated-history.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";

export const ownedRustTransferCommand = "npm run test:owned-rust-transfers";
export const ownedRustTransferScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedRust: true
	, transferredInputs: true, hostAssembledGraphs: true, boxedRecursion: true
	, callbackReentry: true, independentRetains: true, multipleInputHandoffs: true
	, rustAllocationFaults: true, nativeAllocationFaults: true, panicCleanup: true
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, deterministicReassembly: true
	, documentationExecuted: true, otherConsumerBindings: false
	, anchoredBorrowedResults: false, docker: false, installedSupportPromotions: 0
});

/**
 * Reconstruct contracts and source identities, then check both observed paths.
 *
 * @param record - Source-bound runtime and installed execution evidence.
 */
export const assertOwnedRustTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedRustTransferScope);
	assert.equal(record.run.command, ownedRustTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 6, pass: 6, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const fixture = await readFile("tests/fixtures/structured-types/owned-rust-transfers.rs");
	const documentation = await readFile("tests/fixtures/documentation/consumers/rust/owned-transfers.rs");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		const c = historicalOwnedTransferPackage(generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true }), item.adapterReceipt?.ownedValues.sourceSha256);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(fixture));
			const rust = generateOwnedRustCallables(model.bindingIr, { transferredInputs: true });
			assert.equal(item.apiSha256, sha256(rust.apiSource));
			assert.equal(item.conversionsSha256, sha256(rust.source));
			assert.deepEqual(item.rejected, ["immutable-transfer", "immutable-container", "reject-send", "reject-sync"]);
			assert.ok(item.result.checks > 2500);
			for(const key of ["rustBefore", "rustAfter", "nativeBefore", "nativeAfter"
				, "multiRustBefore", "multiRustAfter"
				, "multiNativeBefore", "multiNativeAfter"
				, "panicBefore", "panicAfter", "multiPanicBefore", "multiPanicAfter"])
				assert.ok(Number.isSafeInteger(item.result[key]) && item.result[key] > 0, key);
			assert.equal(item.result.live, 0); assert.equal(item.result.identities, 0);
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "emptyCargoHome", "offlineInstall"
			, "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"
			, "deterministicReassembly", "unsupportedPythonRejected"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.tamperRejected, ["compiled-version", "adapter-version", "compiled-consumption", "adapter-aliases"]);
		assert.equal(item.documentationSha256, sha256(documentation));
		assert.equal(item.consumerSha256, sha256(Buffer.concat([Buffer.from("use owned_transfers::*;\n"), fixture])));
		assert.ok(item.checks > 200); assert.equal(item.relocatedChecks, item.checks); assert.equal(item.cppChecks, 158);
		const generated = generateCompiledNativeLeanAdapters(model);
		const { componentReceipt: component, adapterReceipt: adapter, compiledReceipt: compiled, manifest, packageSetReceipt: packages } = item;
		assert.equal(component.schemaVersion, 4); assert.equal(adapter.schemaVersion, 4);
		assert.equal(compiled.schemaVersion, 3); assert.equal(manifest.schemaVersion, 3);
		const rust = generateOwnedRustPackage(model.bindingIr, null, {}, { transferredInputs: true });
		assert.deepEqual(compiled.ownedValues, rust.contract); assert.deepEqual(manifest.ownedValues, rust.contract);
		assert.deepEqual(adapter.rustValues, rust.contract); assert.deepEqual(compiled.evidence.ownedValues, rust.contract);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(generated.header));
		assert.equal(component.adaptersSha256, sha256(generated.leanSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		const packaged = generateOwnedRustPackage(model.bindingIr, compiled.evidence, {
			name: compiled.name, version: compiled.version
			, metadata: model.sourceIdentity.package ?? {}
		}, { transferredInputs: true });
		for(const path of ["src/lib.rs", "src/owned_values.rs", "src/assets.rs"])
		{
			assert.equal(compiled.files[path].sha256, sha256(packaged.files[path]), path);
			assert.deepEqual(manifest.files[path], compiled.files[path]);
		}
		for(const [file, hash] of Object.entries(compiled.evidence.libraries))
			assert.equal(manifest.files[`native/linux-x64/${file}`].sha256, hash, file);
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(item => item.target).sort(), ["c", "cargo", "cpp"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
	}
};

/**
 * Require enabled runtime and installed gates, with both reports uploaded.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedRustTransferCi = workflow => {
	assert.ok(workflow.includes("          npm run test:owned-rust-transfers\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-rust-transfers"'));
	for(const directory of ["owned-rust-transfers", "owned-rust-transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"]) assert.ok(workflow.includes(`          test -s build/${directory}/${mode}.json\n`));
	}
};
