/**
 * Bind original-owner C# results to fresh Lean and installed package observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedDotnetCalls } from "../../src/backends/dotnet/owned-calls.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedDotnetNativeProbe, ownedDotnetProbeLoader } from "./owned-dotnet-native.mjs";
import { ownedDotnetBorrowInvalidPrograms } from "./owned-dotnet-borrow-installed.mjs";
import { ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";

export const ownedDotnetBorrowScript = "LEAN_BRIDGE_OWNED_DOTNET_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-dotnet-borrows.test.mjs tests/owned-dotnet-borrow-packaging.test.mjs";
export const ownedDotnetBorrowCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-dotnet-borrows";
export const ownedDotnetBorrowScope = Object.freeze({
	profiles: ["dotnet"]
	, sharedComponentConsumers: ["cpp", "rust", "python", "ruby"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedNuget: true, sourceFreeInstallation: true
	, offlineInstall: true, relocated: true, sdkFreeExecution: true
	, deterministicReassembly: true, independentRebuild: false
	, publicExports: 26, anchoredResults: 19, consumingFunctions: 4
	, wholeValueOwners: true, emptyValues: true, recursiveValues: true
	, returnedClosures: true, callbackReentry: true, canonicalIdentity: true
	, independentRetains: true, originalOwnerTransfers: true
	, transitiveExpiration: true
	, rawResourceViews: "borrowed-from-whole-owner"
	, borrowOnlyExecuted: true, wrongThread: true, threadExit: true
	, gcCleanup: true
	, allocationFaults: true, retainedExceptions: true, mutationChecks: true
	, safePublicApi: true, typedRejections: 16, documentationExecuted: true
	, otherConsumerProjections: false, inheritedProcess: false
	, receiverAnchors: false, callbackResultAnchors: false
	, sanitizers: [], docker: false, installedSupportPromotions: 0
});
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const options = { transferredInputs: true, anchoredResults: true };
const fields = ["values", "anchor", "expiration", "descendants", "emptyValues"
	, "aliases", "independentOwnership", "copyType", "rawViews", "resourceEquality"
	, "invalidEquality", "transfers"];

/**
 * Reconstruct generated contracts and require both installed execution paths.
 *
 * @param record - Source-bound private and installed transfer observations.
 */
export const assertOwnedDotnetBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedDotnetBorrowScope);
	assert.equal(record.run.command, ownedDotnetBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 7, pass: 7, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const probe = await readFile("tests/fixtures/structured-types/owned-dotnet-borrows.cs");
	const fixture = await readFile("tests/fixtures/structured-types/owned-installed-dotnet-borrows.cs");
	const documentation = await readFile("tests/fixtures/documentation/consumers/dotnet/owned-borrows.cs");
	const baseLean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const lean = baseLean + ownedRustBorrowSource;
	const extractor = sha256(await readFile("src/analyze/NativeExports.lean"));
	assert.equal((await readFile("docs/consume/dotnet.md", "utf8")).match(/\x60\x60\x60csharp file=dotnet\/owned-borrows\.cs\n([\s\S]*?)\x60\x60\x60/u)?.[1], documentation.toString("utf8"));
	assert.equal(record.borrowOnly.probeSha256, sha256(record.borrowOnly.probe));
	assert.ok((await readFile("tests/owned-dotnet-borrows.test.mjs", "utf8")).includes(record.borrowOnly.probe));
	assert.deepEqual(record.borrowOnly.observations.map(item => item.mode), ["ordinary", "reviewed"]);
	for(const item of record.borrowOnly.observations)
	{
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(baseLean));
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.exports.length, 22); assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 18);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, anchoredResults: true });
		const generated = generateOwnedDotnetCalls(model.bindingIr, { anchoredResults: true });
		assert.deepEqual(item.generated, Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path, sha256(source)])));
		assert.equal(item.nativeProbeSha256, sha256(ownedDotnetNativeProbe(c, false)));
		assert.equal(item.loaderSha256, sha256(ownedDotnetProbeLoader(generated.namespace)));
		assert.equal(item.stdout, "borrow-only-ok\n");
	}
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(probe));
			const generated = generateOwnedDotnetCalls(model.bindingIr, options);
			assert.deepEqual(item.generated, Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path, sha256(source)])));
			const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, ...options });
			assert.equal(item.nativeProbeSha256, sha256(ownedDotnetNativeProbe(c, true)));
			assert.equal(item.loaderSha256, sha256(ownedDotnetProbeLoader(generated.namespace)));
			const mutations = [
				["unchecked-whole-value", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (global::System.Threading.Volatile.Read(ref closed)"]
				, ["unchecked-empty-value", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (value is not global::System.Array { Length: 0 }) Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)"]
				, ["escaped-callback-frame", "Lifetime.cs", "    public void Dispose() { scope.Active = false; }", "    public void Dispose() { scope.Active = true; }"]
				, ["wrapper-equality", "Values.cs", "        return equal(Handle, other.Handle);", "        return global::System.Object.ReferenceEquals(this, other);"]
			];
			assert.deepEqual(item.rejectedMutations, mutations.map(([name, path, before, after]) => {
				assert.ok(generated.files[path].includes(before));
				return { name, compiled: true, sourceSha256: sha256(generated.files[path].replaceAll(before, after)) };
			}));
			assert.deepEqual(item.observed, { checks: 499, managedBefore: 36
				, managedAfter: 61, nativeBefore: 10, nativeAfter: 68
				, live: 0, identities: 0 });
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "installedNuget"
			, "sourceUnchanged", "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemoved", "packageCacheRemoved", "sdkFreeExecution"
			, "consumerSourceRemoved", "deterministicReassembly", "safePublicApi"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.tamperRejected, [...fields.map(field => "anchor-" + field)
			, "native-anchors", "adapter-version", "contract-version"
			, "consumption", "aliases", "native-transfers", "lifetime", "source"
			, "guard", "gmp-receipt", "gmp-source", "library", "unrecorded"
			, "managed-source", "managed-version"]);
		assert.equal(item.incapableReadersRejected, 2);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library"]);
		assert.equal(item.documentation.sourceSha256, sha256(documentation));
		assert.equal(item.documentation.stdout, "42\n"); assert.equal(item.documentation.stderr, "");
		assert.equal(item.documentation.code, 0); assert.equal(item.consumerSha256, sha256(fixture));
		assert.deepEqual(item.observation, { checks: 138, safePublicApi: true });
		assert.deepEqual(item.relocatedObservation, item.observation);
		assert.deepEqual(item.rejectedConsumers.map(entry => entry.name), ["whole-owner constructor"
			, "private owner guard", "raw anchor input", "typed whole owner"
			, "sealed whole owner"
			, "resource constructor"
			, "raw handle", "sealed resource", "resource field", "immutable record"
			, "typed option", "typed callback", "typed closure input", "async callback"
			, "transparent alias", "closed variant"]);
		const { componentReceipt: component, adapterReceipt: adapter
			, runtimeReceipt: runtime, packageSetReceipt: packages
			, compiledProjection: compiled, manifest } = item;
		for(const receipt of [component, adapter, compiled, manifest])
			assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
		assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
		assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
		assert.deepEqual(manifest.component, model.component);
		assert.equal(manifest.kind, "lean-bridge-owned-nuget-package");
		assert.equal(manifest.ecosystem, "nuget");
		assert.equal(manifest.name, "Owned.Borrows"); assert.equal(manifest.version, "1.2.3");
		const native = generateCompiledNativeLeanAdapters(model);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, ...options });
		const dotnet = generateOwnedDotnetPackage(model.bindingIr, null, options);
		assert.equal(manifest.namespace, dotnet.namespace); assert.equal(manifest.assembly, dotnet.assembly);
		assert.deepEqual(item.rejectedConsumers, ownedDotnetBorrowInvalidPrograms.map(([name, body, diagnostic]) => {
			const external = body.startsWith("class ");
			const source = `using ${dotnet.namespace};\ninternal static class Program { static void Main() { ${external ? "" : body} } }\n${external ? body : ""}`;
			return { name, source, diagnostic: diagnostic.source };
		}));
		assert.equal(component.schemaVersion, 5); assert.equal(adapter.schemaVersion, 3);
		assert.equal(adapter.ownedValues.schemaVersion, 4); assert.deepEqual(adapter.dotnetValues, dotnet.contract);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(adapter.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		assert.equal(item.needed[0], "libgmp-lean-bridge.so.10"); assert.ok(item.needed.includes(component.library));
		for(const [path, source] of Object.entries(ownedDotnetAdapterSources(c, dotnet)))
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
			, ownedValues: dotnet.contract, library: adapter.library, libraries };
		assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, dotnet.contract);
		assert.equal(compiled.schemaVersion, 3); assert.equal(compiled.profile, "native-library-v1");
		assert.equal(compiled.bindingIrSha256, model.bindingIrSha256); assert.equal(compiled.assembly, dotnet.assembly);
		assert.match(compiled.sdk, /^8\.0\.\d+$/u);
		const packaged = generateOwnedDotnetPackage(model.bindingIr, evidence, options);
		assert.equal(manifest.schemaVersion, 3); assert.deepEqual(manifest.ownedValues, dotnet.contract);
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		assert.equal(manifest.glibcMinimumVersion, "2.36");
		for(const [path, source] of Object.entries(packaged.files))
		{
			const expected = { bytes: Buffer.byteLength(source), sha256: sha256(source) };
			assert.deepEqual(compiled.files[path], expected, path);
			if(path.startsWith("src/") || path === "binding-manifest.json")
				assert.deepEqual(manifest.files[`lean-bridge/dotnet/${path}`], expected, path);
		}
		for(const extension of ["dll", "xml"])
			assert.deepEqual(manifest.files[`lib/net8.0/${dotnet.assembly}.${extension}`], compiled.files[`lib/net8.0/${dotnet.assembly}.${extension}`]);
		for(const [file, hash] of Object.entries(libraries))
			assert.equal(manifest.files[`runtimes/linux-x64/native/${file}`].sha256, hash, file);
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(item => item.target).sort(), item.mode === "reviewed" ? ["c", "cargo", "cpp", "nuget", "pypi", "rubygems"] : ["nuget"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(item.companions, item.mode === "reviewed" ? { cpp: 407, rust: 440, python: 328, ruby: 137 } : {});
	}
};

/**
 * Require seven enabled tests, both source paths and retained execution reports.
 *
 * @param workflow - Complete downstream workflow.
 * @param manifest - Package scripts.
 */
export const assertOwnedDotnetBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-dotnet-borrows"], ownedDotnetBorrowScript);
	const step = workflow.split("id: type_corpus_dotnet\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-dotnet-borrows > build/owned-dotnet-borrows.log 2>&1\n"));
	for(const summary of ["pass 7", "fail 0", "skipped 0"]) assert.ok(step.includes(`          rg '^# ${summary}$' build/owned-dotnet-borrows.log\n`));
	for(const directory of ["owned-dotnet-borrows", "owned-dotnet-borrow-packaging"])
	{
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
	assert.ok(step.includes("          test -s build/owned-dotnet-borrows/borrow-only.json\n"));
	assert.ok(workflow.includes("            build/owned-dotnet-borrows.log\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-dotnet-borrows"'));
	assert.ok(workflow.includes("steps.type_corpus_dotnet.outcome != 'success'"));
};
