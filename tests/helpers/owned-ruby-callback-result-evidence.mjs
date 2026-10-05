/**
 * Reconstruct Ruby callback-owner reports and their complete failure oracles.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedRubyCallbackResultSource, ownedRubyCallbackResultCombinedSource } from "./owned-ruby-callback-result-fixture.mjs";
import { ownedRubyCallbackNativeSource } from "./owned-ruby-callback-result-native.mjs";
import { ownedRubyCallbackMutations } from "./owned-ruby-callback-result-mutations.mjs";
import { ownedRubyCallbackInstalledProbe } from "./owned-ruby-callback-result-installed.mjs";
import { normalizeOwnedRubySanitizer } from "./owned-ruby-callback-result-sanitizers.mjs";

const faults = hostCallbacks => Object.fromEntries([
	["nativeRecord", 59, 33], ["nativeArgument", 59, 33]
	, ["nativePassback", 56, 32], ["nativeRawPassback", 56, 32]
	, ["recursive", 22, 5], ["recursivePassback", 19, 5]
	, ...hostCallbacks ? [
		["hostRaw", 101, 96], ["hostWhole", 101, 96]
		, ["recoveryRaw", 126, 107], ["recoveryWhole", 126, 107]
		, ["recursiveWhole", 29, 14]
	] : []
].map(([name, ruby, native]) => [name, { rubyCheckpoints: ruby, rubyFaults: ruby, nativeFaults: native }]));
const transfers = () => ["raw", "whole", "native"].flatMap(reply => [
	{ reply, allocator: "ruby", before: 36, after: reply === "native" ? 24 : 69 }
	, { reply, allocator: "native", before: reply === "native" ? 9 : 11, after: reply === "native" ? 19 : 81 }
]);

/**
 * Require fresh compiler inputs, exact ownership results and active detectors.
 *
 * @param item - One complete compiled Ruby runtime report.
 */
export const assertOwnedRubyCallbackRuntime = async item => {
	assert.ok(["ordinary", "reviewed"].includes(item.mode));
	assert.ok(["no-host", "host", "combined"].includes(item.name));
	const combined = item.name === "combined", hostCallbacks = item.name !== "no-host";
	assert.equal(item.combined, combined); assert.equal(item.hostCallbacks, hostCallbacks);
	const options = { hostCallbacks, callbackResultAnchors: true, valueCopies: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	for(const [key, value] of Object.entries(options)) assert.equal(item.input[key], value, key);
	const model = createCompiledNativeModel(item.input, {
		ownedGraphs: true, ownedHostCallbacks: hostCallbacks
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true
	});
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["resultAnchors", "inputTransfers", "receiverExports"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(item.input.sourceIdentity.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), item.input.sourceIdentity.extractorSha256)));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(item.input.sourceIdentity.modules.find(value => value.module === "Owned").source.sha256
		, sha256(lean + (combined ? ownedRubyCallbackResultCombinedSource : ownedRubyCallbackResultSource)));
	const c = generateOwnedCPackage(item.input);
	const generated = generateOwnedRubyPackage(c.layout.model.bindingIr, null, options);
	assert.equal(generated.c.header, c.publicHeader);
	assert.equal(item.nativeSha256, sha256(ownedRubyCallbackNativeSource(c, combined) + generated.cSource));
	for(const [field, text] of [
		["publicSha256", generated.valuesSource]
		, ["conversionsSha256", generated.source]
		, ["boundarySha256", generated.cSource]
		, ["runtimeSha256", generated.files[`lib/${generated.requirePath}/owned.rb`]]
	]) assert.equal(item[field], sha256(text), field);
	const prefix = `HOST_CALLBACKS = ${hostCallbacks}\nCOMBINED = ${combined}\n`;
	assert.equal(item.probeSha256, sha256(prefix + await readFile("tests/fixtures/structured-types/owned-ruby-callback-results.rb", "utf8")));
	assert.equal(item.helpersSha256, sha256(await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb")));
	assert.deepEqual(item.contract, generated.contract); assert.equal(item.contract.schemaVersion, 5);
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false); assert.equal(item.restored, true);
	const mutations = ownedRubyCallbackMutations(generated, hostCallbacks)
		.map(({ name, path, occurrences, source, diagnostic }) => ({
			name, path, occurrences, sourceSha256: sha256(source)
			, compiled: true, semanticRejection: true, diagnostic
		}));
	assert.deepEqual(item.mutations, mutations);
	const { ruby, ...observed } = item.observed;
	assert.match(ruby, /^ruby 3\.3\./u);
	assert.deepEqual(observed, {
		checks: combined ? 4849 : hostCallbacks ? 2776 : 906
		, live: 0, identities: 0, hostCallbacks, combined
		, faults: faults(hostCallbacks), transfers: combined ? transfers() : []
		, foreignCloseSchedules: ["get", "retain", "dup", "clone"]
		, boundedAncestry: true, garbageCollection: true, threadExit: true
		, forkRejection: true, exitedThreadCollected: true
		, nonlocalExits: hostCallbacks
		, asynchronousInterruptions: hostCallbacks ? 2 : 0
	});
	assert.equal(item.publicProbeSha256, sha256(await ownedRubyCallbackInstalledProbe(hostCallbacks, combined)));
	assert.deepEqual(item.publicObservation, {
		checks: combined ? 206 : hostCallbacks ? 185 : 173, ordinaryRequire: true
		, scenarios: ["original_owners", "independent_closures", "native_passback"
			, "recursive_owners", "affinity", ...hostCallbacks ? ["host_replies"] : []
			, ...combined ? ["combined_transfers"] : []]
	});
	assert.deepEqual(item.nativeSanitizers, ["address", "undefined"]);
	assert.equal(item.leakCheckpoint, "after-interpreter-shutdown");
	const { LD_PRELOAD, ...environment } = item.sanitizerEnvironment;
	assert.match(LD_PRELOAD, /^\/[^:]+\/libasan\.so:\/[^:]+\/libubsan\.so$/u);
	assert.deepEqual(environment, {
		PATH: "/usr/bin:/bin", RUBY_FREE_AT_EXIT: "1"
		, LEAN_BRIDGE_OWNED_SANITIZER_CHECK: "1"
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1:malloc_context_size=8:intercept_tls_get_addr=0:use_sigaltstack=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		, LSAN_OPTIONS: "exitcode=0"
	});
	const baseline = item.startupLeakBaseline;
	assert.equal(typeof baseline, "string");
	assert.equal(normalizeOwnedRubySanitizer(baseline, "<probe>"), baseline);
	assert.equal(item.exercisedLeakReport, baseline);
	assert.deepEqual(item.sanitizedObservation, item.observed);
	assert.doesNotMatch(baseline, /ERROR: AddressSanitizer|runtime error:|Tracer caught|fatal error|rb_threadptr_root_fiber_setup/u);
	assert.equal(item.sanitizerProbes.length, 5);
	for(const [index, fault, diagnostic] of [
		[0, "address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
		, [1, "undefined", /runtime error: shift exponent 40 is too large/u]
		, [2, "leak", /Direct leak of 73 byte\(s\) in 1 object\(s\)/u]
		, [4, "tls-leak", /Direct leak of 89 byte\(s\) in 1 object\(s\)/u]
	]) {
		const probe = item.sanitizerProbes[index];
		assert.equal(probe.fault, fault); assert.equal(probe.rejected, true);
		assert.match(probe.diagnostic, diagnostic); assert.notEqual(probe.diagnostic, baseline);
	}
	assert.deepEqual(item.sanitizerProbes[3], { fault: "tls-live", reachable: true, diagnostic: baseline });
};
