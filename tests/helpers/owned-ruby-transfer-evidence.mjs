/**
 * Bind installed Ruby input transfers to compiler facts and observed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedRubyConversions } from "../../src/backends/ruby/owned-conversions.mjs";
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { ownedRubyRuntime } from "../../src/backends/ruby/owned-runtime.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedRubyAdapterSources } from "../../src/build/owned-ruby-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";

export const ownedRubyTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-ruby-transfers";
export const ownedRubyTransferScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedRuby: true
	, transferredInputs: true, hostAssembledGraphs: true, boxedRecursion: true
	, callbackReentry: true, independentRetains: true, multipleInputHandoffs: true
	, rubyAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptions: true, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, deterministicReassembly: true
	, documentationExecuted: true, privateGmp: true, forkBeforeLock: true
	, cCppRustPythonCompanions: true, otherConsumerBindings: false
	, anchoredBorrowedResults: false, docker: false, installedSupportPromotions: 0
});

/**
 * Reconstruct compiled contracts and require both installed execution paths.
 *
 * @param record - Source-bound private and installed transfer observations.
 */
export const assertOwnedRubyTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedRubyTransferScope);
	assert.equal(record.run.command, ownedRubyTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 6, pass: 6, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const probe = await readFile("tests/fixtures/structured-types/owned-ruby-transfers.rb");
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb");
	const fixture = await readFile("tests/fixtures/structured-types/owned-installed-ruby-transfers.rb");
	const documentation = await readFile("tests/fixtures/documentation/consumers/ruby/owned-transfers.rb");
	const loaderProbe = await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(probe)); assert.equal(item.helpersSha256, sha256(helpers));
			const generated = generateOwnedRubyConversions(model.bindingIr, { transferredInputs: true });
			assert.equal(item.publicSha256, sha256(generated.valuesSource));
			assert.equal(item.conversionsSha256, sha256(generated.source));
			assert.equal(item.boundarySha256, sha256(generated.cSource));
			assert.equal(item.runtimeSha256, sha256(ownedRubyRuntime(generated.c.prefix, { transferredInputs: true })));
			const observed = item.observed;
			assert.match(observed.ruby, /^ruby 3\.3\./u); assert.ok(observed.checks > 1000);
			for(const key of ["rubyBefore", "rubyAfter", "nativeBefore", "nativeAfter"
				, "multiRubyBefore", "multiRubyAfter"
				, "multiNativeBefore", "multiNativeAfter"])
				assert.ok(Number.isSafeInteger(observed[key]) && observed[key] > 0, key);
			assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemovedBeforeRelocatedExecution", "gemCacheRemoved"
			, "deterministicReassembly", "ordinaryRequire"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.tamperRejected, ["adapter-version", "contract-version"
			, "consumption", "aliases", "native-transfers", "lifetime", "source"
			, "boundary", "abi", "gmp-receipt", "gmp-source", "library", "unrecorded"]);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]);
		assert.equal(item.documentation.sha256, sha256(documentation)); assert.equal(item.documentation.stdout, "transferred\n");
		assert.equal(item.consumerSha256, sha256(fixture)); assert.equal(item.loaderProbeSha256, sha256(loaderProbe));
		assert.ok(item.observation.checks > 100); assert.equal(item.observation.ordinaryRequire, true);
		assert.deepEqual(item.relocatedObservation, item.observation); assert.deepEqual(item.loader.consumer, item.observation);
		assert.equal(item.loader.liveIdentities, 0); assert.equal(item.loader.concurrentRequires, 4);
		assert.equal(item.loader.runtimeInitializations, 1); assert.equal(item.loader.componentInitializations, 1);
		assert.equal(item.loader.privateGmp, true); assert.equal(item.loader.forkBeforeLock, true);
		const { componentReceipt: component, adapterReceipt: adapter
			, runtimeReceipt: runtime, packageSetReceipt: packages } = item;
		const native = generateCompiledNativeLeanAdapters(model);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true });
		const ruby = generateOwnedRubyPackage(model.bindingIr, null, { transferredInputs: true });
		assert.equal(component.schemaVersion, 4); assert.equal(adapter.schemaVersion, 2);
		assert.equal(adapter.ownedValues.schemaVersion, 3); assert.deepEqual(adapter.rubyValues, ruby.contract);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		assert.equal(item.needed[0], "libgmp-lean-bridge.so.10"); assert.ok(item.needed.includes(component.library));
		for(const [path, source] of Object.entries(ownedRubyAdapterSources(c, ruby)))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1"); assert.equal(runtime.pointerBits, 64);
		const libraries = {
			[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [component.library]: component.nativeLibrary.sha256
			, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
		};
		const evidence = { runtimeIdentity: component.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: ruby.contract, library: adapter.library, libraries };
		const packaged = generateOwnedRubyPackage(model.bindingIr, evidence, { transferredInputs: true });
		assert.equal(item.manifest.schemaVersion, 2); assert.deepEqual(item.manifest.ownedValues, ruby.contract);
		assert.equal(item.manifest.glibcMinimumVersion, "2.36");
		for(const [path, source] of Object.entries(packaged.files))
			assert.deepEqual(item.manifest.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		for(const [file, hash] of Object.entries(libraries))
			assert.equal(item.manifest.files[`lib/${packaged.requirePath}/native/linux-x64/${file}`].sha256, hash, file);
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(item => item.target).sort(), item.mode === "reviewed" ? ["c", "cargo", "cpp", "pypi", "rubygems"] : ["rubygems"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(item.companions, item.mode === "reviewed" ? { c: 446, cpp: 158, rust: 222, python: 106 } : {});
	}
};

/**
 * Require the enabled Ruby shard, its reports and the recorded consumer command.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedRubyTransferCi = workflow => {
	const step = workflow.split("- name: Compare installed Ruby corpus packages with fresh Lean results\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-ruby-transfers\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-ruby-transfers"'));
	for(const directory of ["owned-ruby-transfers", "owned-ruby-transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
	}
};
