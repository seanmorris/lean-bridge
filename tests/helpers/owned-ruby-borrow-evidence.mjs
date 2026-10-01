/**
 * Bind Ruby whole-owner observations to compiled inputs and installed gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRubyConversions } from "../../src/backends/ruby/owned-conversions.mjs";
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { ownedRubyRuntime } from "../../src/backends/ruby/owned-runtime.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedRubyAdapterSources } from "../../src/build/owned-ruby-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowSource, ownedRustBorrowNativeSource } from "./owned-rust-borrow-fixture.mjs";
import { beforeManagedClose } from "./managed-close-history.mjs";
import { beforeManagedCloseGenerated, historicalManagedCloseRubyPackage } from "./managed-close-generated-history.mjs";

export const ownedRubyBorrowScript = "LEAN_BRIDGE_OWNED_RUBY_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-ruby-borrows.test.mjs tests/owned-ruby-borrow-packaging.test.mjs";
export const ownedRubyBorrowCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-ruby-borrows";
export const ownedRubyBorrowScope = Object.freeze({
	profiles: ["ruby"], sharedComponentConsumers: ["cpp", "rust", "python"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedPackages: true, sourceFreeInstallation: true
	, offlineInstall: true, relocated: true, deterministicReassembly: true
	, independentRebuild: false, publicExports: 26, anchoredResults: 19
	, consumingFunctions: 4, wholeValueOwners: true, emptyValues: true
	, recursiveValues: true, returnedClosures: true, callbackReentry: true
	, canonicalIdentity: true, independentRetains: true
	, originalOwnerTransfers: true, transitiveExpiration: true
	, rawResourceViews: "borrowed-from-whole-owner", borrowOnlyExecuted: true
	, inheritedProcess: true, wrongThread: true, threadExit: true, gcCleanup: true
	, allocationFaults: true, retainedExceptions: true, mutationChecks: true
	, documentationExecuted: true, otherConsumerProjections: false
	, receiverAnchors: false, callbackResultAnchors: false
	, sanitizers: [], docker: false, installedSupportPromotions: 0
});
export const ownedRubyCloseScope = Object.freeze({ ...ownedRubyBorrowScope, foreignCloseSnapshots: true });
export const ownedRubyCloseCommand = "LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels " + ownedRubyBorrowCommand;
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const options = { transferredInputs: true, anchoredResults: true };
const fields = ["values", "anchor", "expiration", "descendants", "emptyValues"
	, "aliases", "independentOwnership", "copyType", "rawViews", "resourceEquality"
	, "invalidEquality", "transfers"];

/**
 * Regenerate all checked interfaces and require actual installed observations.
 *
 * @param record - Exact execution log, compiler inputs and observed receipts.
 */
export const assertOwnedRubyBorrowExecution = async record => {
	const repaired = record.kind === "owned-ruby-close-repair";
	assert.equal(record.kind, repaired ? "owned-ruby-close-repair" : "owned-ruby-borrows");
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, repaired ? ownedRubyCloseScope : ownedRubyBorrowScope);
	assert.equal(record.run.command, repaired ? ownedRubyCloseCommand : ownedRubyBorrowCommand);
	assert.equal(record.run.exitCode, 0); assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 7, pass: 7, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp(`^# ${name} ${count}$`, "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	for(const group of [record.runtime, record.packages, record.borrowOnly.observations])
		assert.deepEqual(group.map(item => item.mode), ["ordinary", "reviewed"]);
	const baseLean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const extractor = sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean")));
	const probePath = "tests/fixtures/structured-types/owned-ruby-borrows.rb";
	let probe = await readFile(probePath, "utf8");
	if(!repaired) probe = beforeManagedClose(probePath, probe, record.sources[probePath]);
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb");
	const consumer = await readFile("tests/fixtures/structured-types/owned-installed-ruby-borrows.rb");
	const loader = await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb");
	const documentation = await readFile("tests/fixtures/documentation/consumers/ruby/owned-borrows.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-borrows\.rb\n([\s\S]*?)```/u)?.[1], documentation);
	assert.equal(record.borrowOnly.probeSha256, sha256(record.borrowOnly.probe));
	assert.ok((await readFile("tests/owned-ruby-borrows.test.mjs", "utf8")).includes(record.borrowOnly.probe));
	for(const item of record.borrowOnly.observations)
	{
		assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(baseLean));
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.exports.length, 22); assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 18);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, anchoredResults: true });
		const ruby = generateOwnedRubyConversions(model.bindingIr, { anchoredResults: true });
		const native = c.source + ruby.cSource + "\nsize_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }\n";
		assert.equal(item.nativeSha256, sha256(native));
		assert.equal(item.publicSha256, sha256(ruby.valuesSource));
		assert.equal(item.conversionsSha256, sha256(ruby.source));
		assert.equal(item.boundarySha256, sha256(ruby.cSource));
		const currentRuntime = ownedRubyRuntime(c.values.prefix, { anchoredResults: true });
		assert.equal(item.runtimeSha256, sha256(repaired ? currentRuntime : beforeManagedCloseGenerated(currentRuntime, item.runtimeSha256)));
		assert.equal(item.stdout, "borrow-only-ok\n");
	}
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(baseLean + ownedRustBorrowSource));
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, ...options });
		let ruby = generateOwnedRubyPackage(model.bindingIr, null, options);
		if(!repaired && !record.runtime.includes(item)) ruby = historicalManagedCloseRubyPackage(ruby, item.adapterReceipt.rubyValues);
		let runtime = ownedRubyRuntime(c.values.prefix, options);
		if(record.runtime.includes(item))
		{
			if(!repaired) runtime = beforeManagedCloseGenerated(runtime, item.runtimeSha256);
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.nativeSha256, sha256(ownedRustBorrowNativeSource(c) + ruby.cSource));
			assert.equal(item.publicSha256, sha256(ruby.valuesSource));
			assert.equal(item.conversionsSha256, sha256(ruby.source));
			assert.equal(item.boundarySha256, sha256(ruby.cSource));
			assert.equal(item.runtimeSha256, sha256(runtime));
			assert.equal(item.probeSha256, sha256(probe)); assert.equal(item.helpersSha256, sha256(helpers));
			const mutants = [
				["unchecked-whole-value", runtime
					, repaired ? "      guard.lease.require_open\n      payload" : "      @guard.lease.require_open\n      @guard.payload[0]"
					, repaired ? "      payload" : "      @guard.payload[0]"]
				, ["unchecked-empty-value", runtime
					, repaired ? "      guard.lease.require_open\n      payload" : "      @guard.lease.require_open\n      @guard.payload[0]"
					, repaired ? "      guard.lease.require_open unless payload[0].nil? || payload[0] == []\n      payload" : "      @guard.lease.require_open unless @guard.payload[0].nil? || @guard.payload[0] == []\n      @guard.payload[0]"]
				, ["escaped-callback-frame", runtime
					, "    def close; @scope.active = false; end"
					, "    def close; @scope.active = true; end"]
				, ["pointer-equality", ruby.valuesSource
					, "      def ==(other); same_identity?(other); end"
					, "      def ==(other); equal?(other); end"]
				, ...repaired ? [
					["late-whole-payload-read", runtime, "      guard.lease.require_open\n      payload", "      guard.lease.require_open\n      guard.payload"]
					, ["late-retain-payload-read", runtime, "      payload[1].call(payload[0], whole: true)", "      @guard.payload[1].call(payload[0], whole: true)"]
					, ["late-duplicate-payload-read", runtime, "        install(guard.lease, payload)", "        install(guard.lease, guard.payload)"]
				] : []
			].map(([name, source, before, after]) => {
				assert.ok(source.includes(before), name);
				return { name, compiled: true, sourceSha256: sha256(source.replaceAll(before, after)) };
			});
			assert.deepEqual(item.rejectedMutations, mutants);
			const observed = item.observed;
			assert.match(observed.ruby, /^ruby 3\.3\./u);
			assert.equal(observed.checks, repaired ? 1268 : 1243);
			if(repaired) assert.deepEqual(observed.foreignCloseSchedules, ["array", "option", "nested"].flatMap(shape =>
				["get", "retain", "dup", "clone"].map(operation => `${shape}/${operation}`)));
			else assert.equal(observed.foreignCloseSchedules, undefined);
			assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
			for(const [key, count] of Object.entries({ rubyCheckpoints: 55, rubyFaults: 55, nativeFaults: 32, rubyBefore: 36, rubyAfter: 69, nativeBefore: 11, nativeAfter: 81 }))
				assert.equal(observed[key], count, key);
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemovedBeforeRelocatedExecution", "gemCacheRemoved"
			, "deterministicReassembly", "ordinaryRequire"])
			assert.equal(item[key], true, key);
		assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
		assert.deepEqual(item.tamperRejected, [...fields.map(field => "anchor-" + field)
			, "native-anchors", "adapter-version", "contract-version", "consumption"
			, "aliases", "native-transfers", "lifetime", "source", "boundary", "abi"
			, "gmp-receipt", "gmp-source", "library", "unrecorded"]);
		assert.equal(item.incapableReadersRejected, 3);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]);
		assert.equal(item.consumerSha256, sha256(consumer));
		assert.equal(item.loaderProbeSha256, sha256(loader));
		assert.deepEqual(item.documentation, { sha256: sha256(documentation), stdout: "42\n" });
		assert.deepEqual(item.observation, { checks: 137, ordinaryRequire: true });
		assert.deepEqual(item.relocatedObservation, item.observation);
		assert.deepEqual(item.loader, { consumer: item.observation, liveIdentities: 0
			, runtimeInitializations: 1, componentInitializations: 1
			, privateGmp: true, forkBeforeLock: true, concurrentRequires: 4 });
		const { componentReceipt: component, adapterReceipt: adapter, runtimeReceipt: rt, manifest } = item;
		const native = generateCompiledNativeLeanAdapters(model);
		assert.equal(component.schemaVersion, 5); assert.equal(adapter.schemaVersion, 3);
		assert.equal(adapter.ownedValues.schemaVersion, 4);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header));
		assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(adapter.rubyValues, ruby.contract);
		for(const [path, source] of Object.entries(ownedRubyAdapterSources(c, ruby)))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		assert.equal(item.needed[0], "libgmp-lean-bridge.so.10");
		assert.ok(item.needed.includes(component.library)); assert.ok(item.needed.includes("libleanshared.so"));
		assert.equal(rt.schemaVersion, 1); assert.equal(rt.profile, "native-library-v1"); assert.equal(rt.pointerBits, 64);
		const libraries = {
			[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [component.library]: component.nativeLibrary.sha256
			, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
			, ...Object.fromEntries(Object.entries(rt.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
		};
		const evidence = { runtimeIdentity: component.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: ruby.contract
			, library: adapter.library, libraries };
		let packaged = generateOwnedRubyPackage(model.bindingIr, evidence, options);
		if(!repaired) packaged = historicalManagedCloseRubyPackage(packaged, adapter.rubyValues);
		assert.equal(manifest.schemaVersion, 3); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
		assert.equal(manifest.glibcMinimumVersion, "2.36");
		assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(manifest.ownedValues, ruby.contract);
		for(const [path, source] of Object.entries(packaged.files))
			assert.deepEqual(manifest.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		for(const [file, hash] of Object.entries(libraries))
			assert.equal(manifest.files[`lib/${ruby.requirePath}/native/linux-x64/${file}`].sha256, hash, file);
		validatePackageSetReceipt(item.packageSetReceipt);
		assert.deepEqual(item.packageSetReceipt.packages.map(value => value.target).sort(), item.mode === "reviewed" ? ["c", "cargo", "cpp", "pypi", "rubygems"] : ["rubygems"]);
		assert.equal(item.packageSetReceipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(item.companions, item.mode === "reviewed" ? { cpp: 407, rust: 440, python: 328 } : {});
	}
};

/**
 * Require seven enabled tests, immutable reports and inherited CI failures.
 *
 * @param workflow - Complete downstream workflow.
 * @param manifest - Package scripts.
 */
export const assertOwnedRubyBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-ruby-borrows"], ownedRubyBorrowScript);
	const step = workflow.split("id: type_corpus_ruby\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-ruby-borrows > build/owned-ruby-borrows.log 2>&1\n"));
	for(const summary of ["pass 7", "fail 0", "skipped 0"]) assert.ok(step.includes(`          rg '^# ${summary}$' build/owned-ruby-borrows.log\n`));
	for(const directory of ["owned-ruby-borrows", "owned-ruby-borrow-packaging"])
	{
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
	assert.ok(step.includes("          test -s build/owned-ruby-borrows/borrow-only.json\n"));
	assert.ok(workflow.includes("            build/owned-ruby-borrows.log\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-ruby-borrows"'));
	assert.ok(workflow.includes("steps.type_corpus_ruby.outcome != 'success'"));
};
