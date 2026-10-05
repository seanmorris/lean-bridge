/**
 * Rebuild original callback-result gem sources from compiled ownership metadata.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedRubyAdapterSources } from "../../src/build/owned-ruby-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRubyCallbackResultSource, ownedRubyCallbackResultCombinedSource } from "./owned-ruby-callback-result-fixture.mjs";
import { ownedRubyCallbackInstalledProbe } from "./owned-ruby-callback-result-installed.mjs";
import { beforeOwnedDotnetCallbackResults } from "./owned-dotnet-callback-result-history.mjs";

const hash = value => sha256(canonicalJson(value));
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Authenticate the generated adapter, packaged API and automatically loaded libraries.
 *
 * @param item - Compiled inputs and original installed gem receipt.
 * @param fixture - Exact source and export counts for an extended shared fixture.
 */
export const assertOwnedRubyCallbackPackageInputs = async (item, fixture = null) => {
	const { mode, combined, metadata, model, componentReceipt: component, adapter, runtime, manifest } = item;
	assert.ok(["ordinary", "reviewed"].includes(mode)); assert.equal(typeof combined, "boolean");
	const options = { hostCallbacks: combined, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined
		, callbackResultAnchors: true, valueCopies: true };
	const input = { metadata, sourceIdentity: model.sourceIdentity
		, component: model.component, moduleName: model.moduleName, ...options };
	assert.deepEqual(model, createCompiledNativeModel(input, {
		ownedGraphs: true, ownedHostCallbacks: combined, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined
		, ownedCallbackResultAnchors: true
	}));
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(model.sourceIdentity.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), model.sourceIdentity.extractorSha256)));
	const source = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(model.sourceIdentity.modules.find(value => value.module === "Owned").source.sha256
		, sha256(source + (fixture?.source ?? (combined ? ownedRubyCallbackResultCombinedSource : ownedRubyCallbackResultSource))));
	const c = generateOwnedCPackage(input), ruby = generateOwnedRubyPackage(model.bindingIr, null, options);
	const native = generateCompiledNativeLeanAdapters(model);
	assert.equal(component.schemaVersion, 7); assert.equal(component.modelSha256, hash(model));
	assert.equal(component.metadataSha256, hash(metadata));
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, combined ? sha256(native.callbackSource) : undefined);
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.equal(adapter.componentReceiptSha256, hash(component));
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	for(const [key, count] of fixture?.exports ?? [["receiverExports", 4], ["resultAnchors", 1], ["inputTransfers", 1]])
	{
		if(combined) assert.equal(model.ownedGraph[key].exports.length, count);
		else assert.equal(model.ownedGraph[key], undefined);
	}
	for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
	{
		assert.deepEqual(component[key], model.ownedGraph[key]);
		assert.deepEqual(adapter.ownedValues[key], model.ownedGraph[key]);
	}
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), combined);
	assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
	assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
	assert.deepEqual(adapter.rubyValues, ruby.contract); assert.equal(ruby.contract.schemaVersion, 5);
	for(const [path, bytes] of Object.entries(ownedRubyAdapterSources(c, ruby)))
		assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }, path);
	assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1");
	assert.equal(runtime.pointerBits, 64); assert.equal(component.runtimeIdentity, hash(runtime));
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
	const libraries = {
		[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
	};
	const evidence = { runtimeIdentity: component.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: hash(component), ownedValues: ruby.contract
		, library: adapter.library, libraries };
	const packaged = generateOwnedRubyPackage(model.bindingIr, evidence, options);
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
	assert.equal(manifest.ecosystem, "rubygems"); assert.equal(manifest.name, "owned-callback-results");
	assert.equal(manifest.version, "1.2.3"); assert.match(manifest.glibcMinimumVersion, /^2\.\d+$/u);
	assert.deepEqual(manifest.ownedValues, ruby.contract);
	assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
	for(const [path, bytes] of Object.entries(packaged.files))
		assert.deepEqual(manifest.files[path], { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }, path);
	for(const [name, digest] of Object.entries(libraries))
		assert.equal(manifest.files[`lib/${packaged.requirePath}/native/linux-x64/${name}`].sha256, digest);
};

/**
 * Verify source-free installs, exact public checks, loader probes and relocation.
 *
 * @param item - Original standalone gem execution report.
 */
export const assertOwnedRubyCallbackPackage = async item => {
	await assertOwnedRubyCallbackPackageInputs(item);
	flags(item, ["sourceRemovedBeforeInstall", "cliRemovedBeforeConsumerInstall"
		, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
		, "handoffRemovedBeforeRelocatedExecution", "gemCacheRemoved"
		, "deterministicReassembly", "independentRebuild"]);
	assert.equal(item.consumerSha256, sha256(await ownedRubyCallbackInstalledProbe(item.combined)));
	assert.equal(item.loaderProbeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb")));
	assert.equal(item.rejected, 22); assert.equal(item.incapableReadersRejected, item.combined ? 5 : 1);
	assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]);
	assert.equal(item.needed[0], "libgmp-lean-bridge.so.10");
	assert.ok(item.needed.includes(item.componentReceipt.library)); assert.ok(item.needed.includes("libleanshared.so"));
	assert.deepEqual(item.observation, { checks: item.combined ? 206 : 173
		, ordinaryRequire: true
		, scenarios: ["original_owners", "independent_closures", "native_passback"
			, "recursive_owners", "affinity"
			, ...item.combined ? ["host_replies", "combined_transfers"] : []] });
	assert.deepEqual(item.relocatedObservation, item.observation);
	assert.deepEqual(item.loader.consumer, item.observation);
	assert.equal(item.loader.liveIdentities, 0); assert.equal(item.loader.runtimeInitializations, 1);
	assert.equal(item.loader.componentInitializations, 1); assert.equal(item.loader.concurrentRequires, 4);
	flags(item.loader, ["privateGmp", "forkBeforeLock"]);
	const example = await readFile("tests/fixtures/documentation/consumers/ruby/owned-callback-results.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-callback-results\.rb\n([\s\S]*?)```/u)?.[1], example);
	assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n42\n" });
	validatePackageSetReceipt(item.packageSetReceipt);
	assert.deepEqual(item.packageSetReceipt.packages.map(value => value.target), ["rubygems"]);
	assert.deepEqual(item.packageSetReceipt.component, item.model.component);
	assert.deepEqual(item.packageSetReceipt.profiles, [{ id: "native-library-v1"
		, bindingIrSha256: item.model.bindingIrSha256
		, runtimeIdentity: item.componentReceipt.runtimeIdentity }]);
	assert.equal(item.packages.length, 1); assert.equal(item.builds.length, 2);
	const pkg = item.packages[0];
	assert.equal(pkg.name, item.manifest.name); assert.equal(pkg.version, item.manifest.version);
	assert.equal(pkg.archive, `${pkg.name}-${pkg.version}-x86_64-linux.gem`);
	assert.equal(pkg.compilerAccess, false);
	assert.ok(Number.isSafeInteger(pkg.bytes) && pkg.bytes > 0);
	assert.match(pkg.sha256, /^[a-f0-9]{64}$/u); assert.notEqual(pkg.sha256, "0".repeat(64));
	assert.deepEqual(item.packageSetReceipt.packages[0], {
		target: "rubygems", ecosystem: "rubygems"
		, name: pkg.name, version: pkg.version
		, role: "component", profile: "native-library-v1", runtimeDelivery: "embedded"
		, runtimeIdentity: item.componentReceipt.runtimeIdentity, requires: []
		, artifacts: [{ path: `archives/${pkg.archive}`, bytes: pkg.bytes, sha256: pkg.sha256 }]
	});
	assert.equal(item.verification.status, "ok"); assert.equal(item.verification.exitCode, 0);
	assert.equal(item.verification.command, "verify");
	assert.deepEqual(item.verification.result, { verificationType: "local-package-set"
		, verified: true, authenticated: false, component: item.model.component.id
		, archives: 1, profiles: ["native-library-v1"]
		, receiptSha256: hash(item.packageSetReceipt)
		, packages: [{ ecosystem: "rubygems", target: "rubygems", name: pkg.name, version: pkg.version }] });
	for(const build of item.builds)
	{
		if(item.combined)
		{
			assert.equal(build.status, "ok"); assert.equal(build.exitCode, 0);
			assert.deepEqual(build.result.targets, ["rubygems"]);
			assert.deepEqual(build.result.packages, item.packages);
		}
		else
		{
			assert.equal(build.producerInterface, "native-build-api"); assert.equal(build.projections.length, 1);
			const projection = build.projections[0];
			assert.deepEqual(projection.packages, item.packages);
			assert.equal(projection.backend, "owned-ruby-v5"); assert.equal(projection.ecosystem, "rubygems");
			assert.equal(projection.runtimeIdentity, item.componentReceipt.runtimeIdentity);
			assert.equal(projection.glibcMinimumVersion, item.manifest.glibcMinimumVersion);
			assert.equal(projection.requirePath, item.manifest.requirePath);
			assert.equal(projection.namespace, item.manifest.namespace);
		}
	}
	assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
	assert.equal(item.cli.kind, "lean-bridge-cli-package"); assert.equal(item.cli.productionApproved, false);
	assert.equal(externalRegistryWrites, false); assert.equal(inventorySha256, hash(inventory));
	assert.match(archive.sha256, /^[a-f0-9]{64}$/u); assert.ok(archive.bytes > 0);
	const configPath = "config/cli-package.v1.json";
	const config = JSON.parse(beforeOwnedDotnetCallbackResults(configPath, await readFile(configPath, "utf8")));
	assert.equal(item.cli.schemaVersion, 1);
	assert.deepEqual(item.cli.package, { name: config.name, version: config.version });
	assert.equal(item.cli.files.length, config.files.length + 2);
	assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
	for(const path of config.files)
	{
		const file = item.cli.files.find(value => value.path === path);
		assert.ok(file, path);
		const bytes = Buffer.from(beforeOwnedDotnetCallbackResults(path, await readFile(path), file.sha256));
		assert.equal(file?.bytes, bytes.length, path); assert.equal(file?.sha256, sha256(bytes), path);
	}
};
