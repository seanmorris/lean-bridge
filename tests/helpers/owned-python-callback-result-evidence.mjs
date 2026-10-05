/**
 * Reconstruct Python callback-owner reports and their complete failure oracles.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedPythonCallbackResultSource, ownedPythonCallbackResultCombinedSource } from "./owned-python-callback-result-fixture.mjs";
import { ownedPythonCallbackNativeSource } from "./owned-python-callback-result-native.mjs";
import { ownedPythonCallbackMutations } from "./owned-python-callback-result-mutations.mjs";
import { normalizeOwnedPythonSanitizer } from "./owned-python-callback-result-sanitizers.mjs";

const faults = (hostCallbacks, combined) => [
	["native-record", 42, 40], ["native-empty", 14, 5], ["retain", 41, 37]
	, ...hostCallbacks ? [
		["host-raw", 81, 115], ["host-whole", 81, 115]
		, ["recovery-raw", 99, 129], ["recovery-whole", 99, 129]
	] : []
	, ...combined ? [
		["transfer-raw", 26, 11, 57, 97]
		, ["transfer-whole", 26, 11, 57, 97]
		, ["transfer-native", 25, 9, 20, 22]
	] : []
].flatMap(([kind, python, native, pythonAfter = 0, nativeAfter = 0]) => [
	{ kind, allocator: "python", before: python, after: pythonAfter, successAt: python + pythonAfter }
	, { kind, allocator: "native", before: native, after: nativeAfter, successAt: native + nativeAfter }
]);

/**
 * Rebuild generated code and require all three interpreter configurations.
 *
 * @param item - Complete executed runtime report.
 */
export const assertOwnedPythonCallbackRuntime = async item => {
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
	const source = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(item.input.sourceIdentity.modules.find(value => value.module === "Owned").source.sha256
		, sha256(source + (combined ? ownedPythonCallbackResultCombinedSource : ownedPythonCallbackResultSource)));
	const c = generateOwnedCPackage(item.input);
	const generated = generateOwnedPythonPackage(c.layout.model.bindingIr, null, options);
	assert.equal(generated.c.header, c.publicHeader);
	assert.equal(item.nativeSha256, sha256(ownedPythonCallbackNativeSource(c, combined)));
	for(const [field, text] of [
		["publicSha256", generated.valuesSource], ["stubSha256", generated.stub]
		, ["conversionsSha256", generated.source]
		, ["runtimeSha256", generated.files[`${generated.packageDir}/_owned.py`]]
	]) assert.equal(item[field], sha256(text), field);
	const prefix = `HOST_CALLBACKS = ${hostCallbacks ? "True" : "False"}\nCOMBINED = ${combined ? "True" : "False"}\nINSTALLED = False\n`;
	assert.equal(item.probeSha256, sha256(prefix + await readFile("tests/fixtures/structured-types/owned-python-callback-results.py", "utf8")));
	assert.deepEqual(item.contract, generated.contract); assert.equal(item.contract.schemaVersion, 5);
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	assert.deepEqual(item.observations.map(({ name, typing }) => ({ name, typing })), [
		{ name: "3.11-minimum", typing: "4.6.0" }
		, { name: "3.11-current", typing: "4.16.0" }
		, { name: "3.12-standard", typing: null }
	]);
	const expectedMutations = (item.name === "host" ? [] : ownedPythonCallbackMutations(generated, combined))
		.map(({ name, path, occurrences, source, diagnostic }) => ({
			name, path, occurrences, sourceSha256: sha256(source)
			, compiled: true, semanticRejection: true, diagnostic
		}));
	for(const observed of item.observations)
	{
		assert.equal(observed.checks, combined ? 15511 : hostCallbacks ? 10770 : 2066);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		assert.deepEqual(observed.faults, faults(hostCallbacks, combined));
		assert.deepEqual(observed.scenarios, [
			"original_owner", "independent_closure", "native_passback"
			, "recursive_owners", "bounded_depth", "affinity"
			, ...hostCallbacks ? ["host_replies"] : []
			, ...combined ? ["combined_transfers"] : []
		]);
		assert.equal(observed.restored, true);
		assert.deepEqual(observed.mutations, expectedMutations);
		assert.deepEqual(observed.nativeSanitizers, ["address", "undefined"]);
		const { LD_PRELOAD, ...environment } = observed.sanitizerEnvironment;
		assert.match(LD_PRELOAD, /^\/[^:]+\/libasan\.so:\/[^:]+\/libubsan\.so$/u);
		assert.deepEqual(environment, {
			PATH: "/usr/bin:/bin", PYTHONMALLOC: "malloc"
			, LEAN_BRIDGE_OWNED_SANITIZER_CHECK: "1"
			, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1:malloc_context_size=8:intercept_tls_get_addr=0"
			, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
			, LSAN_OPTIONS: "exitcode=0"
		});
		const baseline = observed.startupLeakBaseline;
		assert.equal(typeof baseline, "string");
		assert.equal(normalizeOwnedPythonSanitizer(baseline, "<probe>"), baseline);
		assert.doesNotMatch(baseline, /ERROR: AddressSanitizer|runtime error:|Tracer caught|fatal error/u);
		assert.equal(observed.sanitizerProbes.length, 5);
		for(const [index, fault, diagnostic] of [
			[0, "address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
			, [1, "undefined", /runtime error: shift exponent 40 is too large/u]
			, [2, "leak", /Direct leak of 73 byte\(s\) in 1 object\(s\)/u]
			, [4, "tls-leak", /Direct leak of 89 byte\(s\) in 1 object\(s\)/u]
		]) {
			const probe = observed.sanitizerProbes[index];
			assert.equal(probe.fault, fault); assert.equal(probe.rejected, true);
			assert.match(probe.diagnostic, diagnostic);
			assert.notEqual(probe.diagnostic, baseline);
		}
		assert.deepEqual(observed.sanitizerProbes[3], { fault: "tls-live", reachable: true, diagnostic: baseline });
	}
};
