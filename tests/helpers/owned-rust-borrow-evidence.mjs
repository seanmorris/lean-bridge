/**
 * Bind Rust borrowed-result lifetime claims to compiled and installed consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { generateOwnedRustCallables } from "../../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowSource, ownedRustBorrowNativeSource } from "./owned-rust-borrow-fixture.mjs";

export const ownedRustBorrowScript = "LEAN_BRIDGE_OWNED_RUST_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-rust-borrows.test.mjs tests/owned-rust-borrow-packaging.test.mjs";
export const ownedRustBorrowScope = Object.freeze({
	profiles: ["rust"], sharedAdapterConsumers: ["cpp"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedPackages: true, sourceFreeInstallation: true
	, offlineInstall: true, emptyCargoHome: true, relocated: true
	, deterministicReassembly: true, independentRebuild: false
	, publicExports: 26, anchoredResults: 19, consumingFunctions: 4
	, wholeValueOwners: true, emptyValues: true, recursiveValues: true
	, returnedClosures: true, callbackReentry: true, canonicalIdentity: true
	, independentRetains: true, originalOwnerTransfers: true
	, transitiveExpiration: true, compileNegativeConsumers: true
	, inheritedProcess: true, allocationFaults: true, panicCleanup: true
	, mutationChecks: true, documentationExecuted: true, borrowOnlyCompiled: true
	, otherConsumerProjections: false, receiverAnchors: false
	, callbackResultAnchors: false, sanitizers: [], docker: false
	, installedSupportPromotions: 0
});
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const run = (value, command, count) => {
	assert.equal(value.command, command); assert.equal(value.exitCode, 0);
	assert.equal(value.sha256, sha256(value.text));
	for(const [name, expected] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(value.text, new RegExp(`^# ${name} ${expected}$`, "mu"));
	assert.doesNotMatch(value.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Recreate all runtime/package contracts from both observed compiler inputs.
 *
 * @param record - Source-bound Rust borrow milestone.
 */
export const assertOwnedRustBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedRustBorrowScope);
	run(record.runs.runtime, "LEAN_BRIDGE_OWNED_RUST_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-rust-borrows.test.mjs", 3);
	run(record.runs.installed, "LEAN_BRIDGE_OWNED_RUST_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-rust-borrow-packaging.test.mjs", 3);
	for(const group of [record.runtime, record.packages]) assert.deepEqual(group.map(item => item.mode), ["ordinary", "reviewed"]);
	const probe = await readFile("tests/fixtures/structured-types/owned-rust-borrows.rs", "utf8");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustBorrowSource;
	const page = await readFile("docs/consume/rust.md", "utf8");
	const example = page.match(/```rust file=rust\/owned-borrows\.rs\n([\s\S]*?)```/u)?.[1];
	assert.ok(example);
	assert.equal(await readFile("tests/fixtures/documentation/consumers/rust/owned-borrows.rs", "utf8"), example);
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))));
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
		if(record.runtime.includes(item))
		{
			flags(item, ["actualLean", "borrowOnlyCompiled"]); assert.equal(item.installedPackage, false);
			const rust = generateOwnedRustCallables(model.bindingIr, { transferredInputs: true, anchoredResults: true });
			assert.equal(item.apiSha256, sha256(rust.apiSource));
			assert.equal(item.conversionsSha256, sha256(rust.source));
			assert.equal(item.probeSha256, sha256(probe));
			assert.equal(item.nativeSha256, sha256(ownedRustBorrowNativeSource(c)));
			assert.equal(item.result.checks, 3713);
			assert.equal(item.result.live, 0); assert.equal(item.result.identities, 0);
			for(const key of ["rustFaults", "nativeFaults", "panicFaults", "before", "after"]) assert.ok(item.result[key] > 0, key);
			assert.deepEqual(item.rejected, ["raw-anchor", "immutable-transfer", "reject-send", "reject-sync"]);
			assert.deepEqual(item.rejectedMutations, ["missing-whole-value-validation", "empty-owner-dropped", "callback-wrapper-escape", "raw-pointer-equality"]);
			continue;
		}
		flags(item, ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "emptyCargoHome", "offlineInstall"
			, "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"
			, "deterministicReassembly"]);
		assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
		assert.equal(item.checks, 440); assert.equal(item.relocatedChecks, 440); assert.equal(item.cppChecks, 407);
		assert.equal(item.consumerSha256, sha256("use owned_borrows::*;\n" + probe));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n" });
		assert.equal(item.incapableReadersRejected, 3);
		assert.deepEqual(item.forgedAnchorContractsRejected, [
			"values", "anchor", "expiration", "descendants", "emptyValues"
			, "aliases"
			, "independentOwnership"
			, "resourceEquality"
			, "invalidEquality"
			, "fallibleEquality"
			, "transfers"]);
		const generated = generateCompiledNativeLeanAdapters(model);
		const rust = generateOwnedRustPackage(model.bindingIr, null, {}, { transferredInputs: true, anchoredResults: true });
		const cpp = generateOwnedCppPackage(model.bindingIr, { transferredInputs: true, anchoredResults: true });
		const { componentReceipt: component, adapterReceipt: adapter, compiledReceipt: compiled, manifest, packageSetReceipt: packages } = item;
		assert.equal(component.schemaVersion, 5); assert.equal(adapter.schemaVersion, 5);
		assert.equal(compiled.schemaVersion, 4); assert.equal(manifest.schemaVersion, 4);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(generated.header));
		assert.equal(component.adaptersSha256, sha256(generated.leanSource));
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(adapter.cppValues, cpp.contract);
		for(const contract of [adapter.rustValues, compiled.ownedValues, compiled.evidence.ownedValues, manifest.ownedValues])
			assert.deepEqual(contract, rust.contract);
		assert.equal(compiled.evidence.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		const packaged = generateOwnedRustPackage(model.bindingIr, compiled.evidence, {
			name: compiled.name
			, version: compiled.version
			, metadata: model.sourceIdentity.package ?? {}
		}, { transferredInputs: true, anchoredResults: true });
		for(const [path, source] of Object.entries(packaged.files))
		{
			assert.deepEqual(compiled.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
			assert.deepEqual(manifest.files[path], compiled.files[path]);
		}
		assert.equal(item.dependencies.lockSha256, compiled.files["Cargo.lock"].sha256);
		assert.deepEqual(manifest.files["Cargo.lock"], compiled.files["Cargo.lock"]);
		for(const [file, hash] of Object.entries(compiled.evidence.libraries))
			assert.equal(manifest.files[`native/linux-x64/${file}`].sha256, hash, file);
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(value => value.target).sort(), ["c", "cargo", "cpp"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
	}
};

/**
 * Require enabled ordinary/reviewed gates and uploaded runtime/package reports.
 *
 * @param workflow - Complete downstream workflow.
 * @param manifest - Complete package scripts.
 */
export const assertOwnedRustBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-rust-borrows"], ownedRustBorrowScript);
	const step = workflow.split("id: type_corpus_rust\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-rust-borrows > build/owned-rust-borrows.log 2>&1\n"));
	for(const summary of ["pass 6", "fail 0", "skipped 0"]) assert.ok(step.includes(`          rg '^# ${summary}$' build/owned-rust-borrows.log\n`));
	for(const directory of ["owned-rust-borrows", "owned-rust-borrow-packaging"])
	{
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
	assert.ok(workflow.includes("            build/owned-rust-borrows.log\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-rust-borrows"'));
	assert.ok(workflow.includes("steps.type_corpus_rust.outcome != 'success'"));
};
