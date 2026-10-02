/**
 * Bind Ruby members and original owners to compiled inputs and installed gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetReceiverHistoricalBytes } from "./owned-dotnet-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { historicalOwnedRubyCallbackPackage as generateOwnedRubyPackage } from "./owned-ruby-callback-generated-history.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedRubyAdapterSources } from "../../src/build/owned-ruby-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowNativeSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedRubyReceiverSource, ownedRubyReceiverProbe, ownedRubyPlainReceiverProbe } from "./owned-ruby-receiver-fixture.mjs";
import { ownedRubyInstalledReceiverProbe } from "./owned-ruby-receiver-installed.mjs";
import { ownedCppReceiverProbe } from "./owned-cpp-receiver-fixture.mjs";
import { ownedRustReceiverProbe } from "./owned-rust-receiver-fixture.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";

export const ownedRubyReceiverCommand = "LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-ruby-receivers";
export const ownedRubyReceiverScope = Object.freeze({
	profiles: ["ruby"], sharedComponentConsumers: ["cpp", "rust", "python"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedPackages: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalMembers: true, readOnlyProperties: "zero-argument-methods"
	, classIntrospection: true, originalOwnerTransfers: true, receiverAnchors: true
	, remainingParameterAnchors: true
	, receiverOnlyWithoutOptionalCapabilities: true, consumingWithoutAnchors: true
	, transitiveExpiration: true, independentRetains: true
	, emptyValues: true, recursiveValues: true, returnedClosures: true
	, callbackReentry: true, allocationFaults: true, foreignCloseSnapshots: true
	, compiledNegativeVariants: 3, sourceFreeInstallation: true
	, offlineInstall: true
	, sourceFreeRelocatedExecution: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true, isolatedGmp: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});
const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true
	, ownedReceiverExports: true };
const trueFields = (value, fields) => { for(const field of fields) assert.equal(value[field], true, field); };
const mixed = input => {
	trueFields(input, ["hostCallbacks", "transferredInputs", "anchoredResults", "receiverExports"]);
	const model = createCompiledNativeModel(input, capabilities);
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
	assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
	assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
	return { model, c: generateOwnedCPackage(input), ruby: generateOwnedRubyPackage(model.bindingIr, null, options) };
};
const sourceIdentity = (input, mode, source) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(source));
};

/**
 * Regenerate direct members and verify the exact runtime and plain observations.
 *
 * @param record - Both compiled source paths and no-optional-capability reports.
 */
export const assertOwnedRubyReceiverInputs = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await ownedRubyReceiverProbe(), helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb");
	for(const item of record.runtime)
	{
		sourceIdentity(item.input, item.mode, lean + ownedRubyReceiverSource);
		const { c, ruby } = mixed(item.input), runtime = ruby.files[`lib/${ruby.requirePath}/owned.rb`];
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		assert.equal(item.publicSha256, sha256(ruby.valuesSource)); assert.equal(item.boundarySha256, sha256(ruby.cSource));
		assert.equal(item.conversionsSha256, sha256(ruby.source)); assert.equal(item.runtimeSha256, sha256(runtime));
		assert.equal(item.nativeSha256, sha256(ownedRustBorrowNativeSource(c) + ruby.cSource));
		assert.equal(item.probeSha256, sha256(probe)); assert.equal(item.helpersSha256, sha256(helpers));
		const choose = ruby.functions.findIndex(fn => fn.name === "chooseTicket");
		const mutations = [
			["receiver-used-as-other-argument-anchor", ruby.valuesSource, `Native.call${choose}(receiver, arg1)`, `Native.call${choose}(receiver, self)`]
			, ["unchecked-whole-value", runtime, "      guard.lease.require_open\n      payload", "      payload"]
			, ["escaped-callback-frame", runtime, "    def close; @scope.active = false; end", "    def close; @scope.active = true; end"]
		].map(([name, source, before, after]) => {
			assert.equal(source.split(before).length, 2, name);
			return { name, compiled: true, sourceSha256: sha256(source.replace(before, after)) };
		});
		assert.deepEqual(item.rejectedMutations, mutations); assert.equal(item.restored, true);
		const { ruby: version, ...observed } = item.observed;
		assert.match(version, /^ruby 3\.3\./u);
		assert.deepEqual(observed, { checks: 1311, live: 0, identities: 0
			, rubyCheckpoints: 55, rubyFaults: 55, nativeFaults: 32
			, rubyBefore: 36, rubyAfter: 69, nativeBefore: 11, nativeAfter: 81
			, foreignCloseSchedules: ["array", "option", "nested"].flatMap(shape => ["get", "retain", "dup", "clone"].map(operation => `${shape}/${operation}`)) });
	}
	for(const item of record.plain)
	{
		sourceIdentity(item.input, item.mode, lean + ownedReceiverSource);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: item.consuming });
		assert.deepEqual(item.model, model); assert.equal(model.exports.length, item.consuming ? 4 : 3);
		assert.equal(model.ownedGraph.receiverExports.exports.length, item.consuming ? 3 : 2);
		assert.equal(model.ownedGraph.hostCallbacks, undefined); assert.equal(model.ownedGraph.resultAnchors, undefined);
		if(!item.consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		const ruby = generateOwnedRubyPackage(model.bindingIr, null, { receiverExports: true, transferredInputs: item.consuming, hostCallbacks: false });
		const implementation = generateOwnedCPackage(item.input).source + ruby.cSource + `
size_t receiver_identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
		assert.deepEqual(item.contract, ruby.contract); assert.equal(item.nativeSha256, sha256(implementation));
		assert.equal(item.publicSha256, sha256(ruby.valuesSource)); assert.equal(item.conversionsSha256, sha256(ruby.source));
		assert.equal(item.runtimeSha256, sha256(ruby.files[`lib/${ruby.requirePath}/owned.rb`]));
		assert.equal(item.probeSha256, sha256(ownedRubyPlainReceiverProbe(item.consuming)));
		assert.deepEqual(item.observed, { checks: item.consuming ? 9 : 8, identities: 0 });
	}
};

/**
 * Require one complete ten-test run and authenticate all original gem artifacts.
 *
 * @param record - Compiled inputs, exact TAP log and source-free package reports.
 */
export const assertOwnedRubyReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedRubyReceiverScope);
	assert.equal(record.run.command, ownedRubyReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 10, pass: 10, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedRubyReceiverInputs(record);
	const { ownedPythonInstalledReceiverProbe } = await import("./owned-python-receiver-fixture.mjs");
	const observations = record.run.text.split("\n").filter(line => line.startsWith("# {"))
		.map(line => canonicalJson(JSON.parse(line.slice(2)))).sort();
	assert.deepEqual(observations, [
		...record.runtime.map(({ mode, observed }) => ({ mode, ...observed }))
		, ...record.plain.map(({ mode, consuming, observed }) => ({ mode, consuming, ...observed }))
	].map(canonicalJson).sort());
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const consumer = await ownedRubyInstalledReceiverProbe();
	const example = await readFile("tests/fixtures/documentation/consumers/ruby/owned-receivers.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-receivers\.rb\n([\s\S]*?)```/u)?.[1], example);
	const loader = await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb");
	const cliConfig = JSON.parse(ownedDotnetReceiverHistoricalBytes("config/cli-package.v1.json", await readFile("config/cli-package.v1.json"), record.sources["config/cli-package.v1.json"]).toString());
	for(const item of record.packages)
	{
		trueFields(item, ["sourceRemovedBeforeInstall"
			, "cliRemovedBeforeConsumerInstall", "sourceFreeInstallation"
			, "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"
			, "gemCacheRemoved", "deterministicReassembly", "independentRebuild"]);
		const input = { metadata: item.metadata, sourceIdentity: item.model.sourceIdentity, component: item.model.component, hostCallbacks: true, ...options };
		sourceIdentity(input, item.mode, lean + ownedRubyReceiverSource);
		const { model, c, ruby } = mixed(input), native = generateCompiledNativeLeanAdapters(model);
		assert.deepEqual(item.model, model);
		const { componentReceipt: component, adapter, runtime, packageSetReceipt: packages } = item;
		assert.equal(component.schemaVersion, 6); assert.equal(adapter.schemaVersion, 4); assert.equal(adapter.ownedValues.schemaVersion, 5);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, model.ownedGraph.hostCallbacks.trampolineSha256);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		for(const field of ["receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.deepEqual(component[field], model.ownedGraph[field]); assert.deepEqual(adapter.ownedValues[field], model.ownedGraph[field]);
		}
		assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.rubyValues, ruby.contract); assert.equal(ruby.contract.schemaVersion, 4);
		for(const [path, source] of Object.entries(ownedRubyAdapterSources(c, ruby)))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1"); assert.equal(runtime.pointerBits, 64);
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		assert.equal(item.needed[0], "libgmp-lean-bridge.so.10"); assert.ok(item.needed.includes(component.library));
		assert.ok(item.needed.includes("libleanshared.so"));
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
		const packaged = generateOwnedRubyPackage(model.bindingIr, evidence, options);
		assert.equal(item.consumerSha256, sha256(consumer)); assert.equal(item.loaderProbeSha256, sha256(loader));
		assert.equal(item.rejected, 22); assert.equal(item.incapableReadersRejected, 4);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]);
		assert.ok(item.observation.checks > 100); assert.equal(item.observation.ordinaryRequire, true);
		assert.deepEqual(item.relocatedObservation, item.observation); assert.deepEqual(item.loader.consumer, item.observation);
		assert.equal(item.loader.liveIdentities, 0); assert.equal(item.loader.runtimeInitializations, 1); assert.equal(item.loader.componentInitializations, 1);
		assert.equal(item.loader.concurrentRequires, 4); trueFields(item.loader, ["privateGmp", "forkBeforeLock"]);
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n42\n" });
		const manifest = item.manifest;
		assert.equal(manifest.schemaVersion, 4); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
		assert.deepEqual(manifest.ownedValues, ruby.contract); assert.equal(manifest.glibcMinimumVersion, "2.36");
		assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity); assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		for(const [path, source] of Object.entries(packaged.files))
			assert.deepEqual(manifest.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		for(const [file, hash] of Object.entries(libraries)) assert.equal(manifest.files[`lib/${packaged.requirePath}/native/linux-x64/${file}`].sha256, hash);
		assert.ok(record.run.text.includes(`${item.mode}: ${item.observation.checks}+${item.observation.checks} installed and relocated receiver checks`));
		validatePackageSetReceipt(packages);
		const targets = item.mode === "reviewed" ? ["c", "cargo", "cpp", "pypi", "rubygems"] : ["rubygems"];
		assert.deepEqual(packages.packages.map(value => value.target).sort(), targets); assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		if(item.mode === "reviewed")
		{
			for(const [name, source] of [
				["cpp", "#define OWNED_BORROW_INSTALLED 1\n" + await ownedCppReceiverProbe()]
				, ["rust", "use owned_receivers::*;\n" + await ownedRustReceiverProbe()]
				, ["python", await ownedPythonInstalledReceiverProbe()]
			]) { assert.ok(item.companions[name].checks > 300); assert.equal(item.companions[name].probeSha256, sha256(source)); }
			const installation = item.companions.python.installation;
			assert.equal(installation.resolvedOffline, true); assert.equal(installation.dependency.version, "4.6.0");
			assert.equal(installation.dependency.sha256, pythonTypingWheels["4.6.0"]);
		} else assert.deepEqual(item.companions, {});
		const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
		assert.equal(item.cli.kind, "lean-bridge-cli-package"); assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
		assert.equal(item.cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
		assert.match(archive.sha256, /^[a-f0-9]{64}$/u); assert.ok(archive.bytes > 0);
		assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
		assert.equal(item.cli.files.length, cliConfig.files.length + 2);
		assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
		for(const path of cliConfig.files)
		{
			const file = item.cli.files.find(value => value.path === path);
			const bytes = Buffer.from(ownedDotnetReceiverHistoricalBytes(path, await readFile(path), file?.sha256));
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.builds.length, 2);
		for(const build of item.builds)
		{ assert.equal(build.status, "ok"); assert.deepEqual([...build.result.targets].sort(), targets); }
		assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verificationType, "local-package-set");
	}
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
	const { assertOwnedRubyReceiverCi } = await import("./owned-ruby-receiver-ci.mjs");
	assertOwnedRubyReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
