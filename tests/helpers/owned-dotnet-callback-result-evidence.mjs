/**
 * Reconstruct callback-owner inputs, generated bindings and executable probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetCalls } from "../../src/backends/dotnet/owned-calls.mjs";
import { ownedDotnetNativeProbe } from "./owned-dotnet-native.mjs";
import { ownedDotnetReceiverProject, instrumentOwnedDotnetReceivers } from "./owned-dotnet-receiver-fixture.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedDotnetCallbackResultProbe, ownedDotnetCallbackLifetimeProbe
	, ownedDotnetCallbackSanitizerProbe, ownedDotnetCallbackForkProbe } from "./owned-dotnet-callback-result-probes.mjs";
import { ownedDotnetCallbackInvalidPrograms } from "./owned-dotnet-callback-result-installed.mjs";
import { ownedDotnetSanitizerControls } from "./owned-dotnet-callback-result-sanitizers.mjs";

/**
 * Require the complete author or independent reviewed contract, not a hash alone.
 *
 * @param item - One compiled runtime observation.
 * @param hostCallbacks - Selected host delegate capability.
 * @param combined - Selected receiver, export-anchor and transfer capabilities.
 */
export const assertOwnedDotnetCallbackInputs = async (item, hostCallbacks, combined) => {
	assert.ok(["ordinary", "reviewed"].includes(item.mode));
	const options = { hostCallbacks, callbackResultAnchors: true, valueCopies: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const native = createCompiledNativeModel(item.input, {
		ownedGraphs: true, ownedHostCallbacks: hostCallbacks
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true
	});
	assert.equal(native.schemaVersion, 11); assert.equal(native.ownedGraph.schemaVersion, 6);
	assert.equal(native.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["resultAnchors", "inputTransfers", "receiverExports"])
		assert.equal(Boolean(native.ownedGraph[key]), combined, key);
	const identity = item.input.sourceIdentity;
	assert.equal(Boolean(identity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(identity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(identity.modules.find(value => value.module === "Owned").source.sha256,
		sha256(lean + (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource)));
	const configuration = item.mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(identity.exportConfigurationSha256, sha256(identity.exportConfigurationSource));
	if(item.mode === "reviewed")
	{
		const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(ir));
		assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(ir)));
	}
	const c = generateOwnedCPackage({ ...item.input, ...options });
	const generated = generateOwnedDotnetCalls(native.bindingIr, options);
	assert.equal(c.publicHeader, generated.c.header);
	assert.deepEqual(item.generated, Object.fromEntries(Object.entries(generated.files).map(([path, text]) => [path, sha256(text)])));
	assert.equal(item.nativeProbeSha256, sha256(ownedDotnetNativeProbe(c, combined)));
	return generated;
};

const observation = (host, combined) => ({
	checks: combined ? 1378 : host ? 1365 : 252
	, ...host ? { hostFaults: [157, 111, 158, 111] } : {}
	, managedFaults: 74, nativeFaults: 37, live: 0, identities: 0
});
const checkpoint = source => source.replace("internal static void Checkpoint() { }", "internal static void Checkpoint() { global::Program.Allocation(); }");
const mutations = (files, cases, occurrences = false) => cases.map(([name, path, before, after, diagnostic]) => {
	const count = files[path].split(before).length - 1; assert.ok(count > 0, name);
	return { name, compiled: true, semanticRejection: true
		, ...occurrences ? { occurrences: count } : {}
		, sourceSha256: sha256(files[path].replaceAll(before, after)), diagnostic };
});

/**
 * Verify one named report without widening runtime or sanitizer claims.
 *
 * @param name - Report basename including source mode, variant and optional kind.
 * @param item - Complete report from the executable test.
 */
export const assertOwnedDotnetCallbackRuntime = async (name, item) => {
	const match = /^(ordinary|reviewed)-(no-host|host|combined)(?:-(lifetime|sanitizers|process))?\.json$/u.exec(name);
	assert.ok(match, name);
	const [, mode, variant, kind = "calls"] = match;
	const combined = variant === "combined", host = variant !== "no-host";
	assert.equal(item.mode, mode); assert.equal(item.combined, combined);
	if(kind !== "process") assert.equal(item.hostCallbacks, host);
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	if(["sanitizers", "process"].includes(kind)) assert.notEqual(variant, "host");
	const generated = await assertOwnedDotnetCallbackInputs(item, host, combined);
	if(kind === "calls")
	{
		assert.deepEqual(item.observed, observation(host, combined)); assert.equal(item.restored, true);
		assert.equal(item.probeSha256, sha256(await ownedDotnetCallbackResultProbe(host, combined)));
		assert.deepEqual(item.rejected, ownedDotnetCallbackInvalidPrograms(generated, host).map(([name, statement, diagnostic]) => ({
			name
			, source: `using ${generated.namespace};\ninternal static class Misuse { internal static ${statement} }`
			, diagnostic: diagnostic.source
		})));
		const files = { ...generated.files, "Lifetime.cs": checkpoint(generated.files["Lifetime.cs"]) };
		assert.deepEqual(item.rejectedMutations, mutations(files, [
			["non-whole-closure-used-as-original-owner", "Calls.cs", "var anchor = arg2.Guard.Require(state).Owner(state);", "var anchor = arg0.Lease.Owner(state);", "LeanBridgeException: Invalid argument"]
			, ["unchecked-whole-result", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (global::System.Threading.Volatile.Read(ref closed)", "expired callback owner was accepted"]
			, ...host ? [["escaped-host-frame", "Lifetime.cs", "public void Dispose() { scope.Active = false; }", "public void Dispose() { scope.Active = true; }", "escaped host callback view expires"]] : []
		], true));
	}
	else if(kind === "lifetime")
	{
		assert.equal(item.variant, variant); assert.equal(item.restored, true);
		assert.equal(item.optimizedProject, ownedDotnetReceiverProject);
		assert.equal(item.probeSha256, sha256(await ownedDotnetCallbackLifetimeProbe(host, combined)));
		assert.deepEqual(item.observed, {
			checks: combined ? 975 : host ? 323 : 307
			, lifetimeCollections: host ? 12 : 9, exitedThreads: 4, concurrentReads: 1
			, ...combined ? { managedBefore: 45, managedAfter: 120, nativeBefore: 14, nativeAfter: 143 } : {}
			, managedFaults: 74, nativeFaults: 37, live: 0, identities: 0
		});
		const files = { ...generated.files, "Lifetime.cs": instrumentOwnedDotnetReceivers(generated.files["Lifetime.cs"]) };
		assert.deepEqual(item.rejectedMutations, mutations(files, [
			["read-payload-after-close", "Lifetime.cs", "        return snapshot!.Value;", "        return global::System.Threading.Volatile.Read(ref payload) is { } late ? late.Value : default!;", "callback-result read preserves its validated snapshot during close"]
			, ["unrooted-callback-result", "Values.cs", "global::System.GC.KeepAlive(this);", ";", "temporary callback-result guard remains alive during operation"]
		]));
	}
	else if(kind === "sanitizers")
	{
		assert.deepEqual(item.observed, observation(host, combined));
		assert.equal(item.probeSha256, sha256(await ownedDotnetCallbackSanitizerProbe(combined)));
		assert.equal(item.nativeControlsSha256, sha256(ownedDotnetSanitizerControls));
		assert.deepEqual(item.sanitizedSources, ["api.c", "guard.cpp", "sanitizer-controls.c"]);
		assert.equal(item.leanRuntimeInstrumented, false);
		const { environment, ...sanitized } = item.sanitized;
		assert.deepEqual(sanitized, {
			nativeSanitizers: ["address", "undefined"], leakSanitizer: false
			, nativeLeakChecks: "allocation-and-identity-ledgers"
			, observation: item.observed
			, rejected: [
				{ fault: "address", diagnostic: "ERROR: AddressSanitizer: heap-buffer-overflow", rejected: true }
				, { fault: "undefined", diagnostic: "runtime error: shift exponent 40 is too large", rejected: true }
			]
		});
		const { DOTNET_ROOT, LD_PRELOAD, ...options } = environment;
		assert.match(DOTNET_ROOT, /^\//u); assert.match(LD_PRELOAD, /^\/[^:]+\/libasan\.so:\/[^:]+\/libubsan\.so$/u);
		assert.deepEqual(options, {
			PATH: "/usr/bin:/bin", DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
			, ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1:intercept_tls_get_addr=0"
			, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		});
	}
	else
	{
		assert.equal(item.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-dotnet-callback-process.cs")));
		assert.equal(item.forkProbeSha256, sha256(ownedDotnetCallbackForkProbe));
		assert.equal(item.project, combined ? ownedDotnetReceiverProject.replace("<Optimize>", "<DefineConstants>HOST_CALLBACKS</DefineConstants><Optimize>") : ownedDotnetReceiverProject);
		assert.deepEqual(item.observations, [
			{ mode: "fork", checks: combined ? 20 : 18, rejected: 0, forkChecks: combined ? 7 : 6, live: 0, identities: 0 }
			, { mode: "retirement", checks: 2, rejected: combined ? 8 : 7, forkChecks: 0, live: 0, identities: 0 }
			, ...combined ? [
				{ mode: "host-retirement", checks: 2, rejected: 9, forkChecks: 0, live: 0, identities: 0 }
				, { mode: "transfer-retirement", checks: 3, rejected: 9, forkChecks: 0, live: 0, identities: 0 }
			] : []
		]);
	}
};
