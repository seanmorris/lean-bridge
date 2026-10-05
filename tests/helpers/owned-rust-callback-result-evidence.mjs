/**
 * Reconstruct Rust callback-owner reports from the current compiler contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../../src/binding-ir/canonical.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedRustCallbackResultSource, ownedRustCallbackResultCombinedSource } from "./owned-rust-callback-result-fixture.mjs";
import { ownedRustCallbackMutations } from "./owned-rust-callback-result-mutations.mjs";

/**
 * Rebuild every generated source and require the complete fault/mutation oracle.
 *
 * @param item - Original runtime report, not a support summary.
 */
export const assertOwnedRustCallbackRuntime = async item => {
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
		, sha256(source + (combined ? ownedRustCallbackResultCombinedSource : ownedRustCallbackResultSource)));
	const c = generateOwnedCPackage(item.input);
	const rust = generateOwnedRustCallables(c.layout.model.bindingIr, options);
	const package_ = generateOwnedRustPackage(c.layout.model.bindingIr, null, {}, options);
	assert.equal(rust.c.header, c.publicHeader);
	assert.equal(item.sourceSha256, sha256(c.source));
	assert.equal(item.rustApiSha256, sha256(rust.apiSource));
	assert.equal(item.rustSourceSha256, sha256(rust.source));
	assert.equal(item.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-rust-callback-results.rs")));
	assert.deepEqual(item.contract, package_.contract); assert.equal(item.contract.schemaVersion, 5);
	assert.deepEqual(item.result, {
		checks: combined ? 6811 : hostCallbacks ? 3827 : 1119
		, rustFaults: combined ? 272 : hostCallbacks ? 157 : 46
		, nativeFaults: combined ? 316 : hostCallbacks ? 179 : 40
		, panicFaults: combined ? 272 : hostCallbacks ? 157 : 46
		, before: combined ? 583 : hostCallbacks ? 493 : 132
		, after: combined ? 277 : 0, live: 0, identities: 0
	});
	assert.deepEqual(item.restored, item.result);
	assert.deepEqual(item.nativeSanitizers, ["address", "undefined"]);
	assert.deepEqual(item.sanitizerEnvironment, { PATH: "/usr/bin:/bin"
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1:use_sigaltstack=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		, LSAN_OPTIONS: "exitcode=0" });
	assert.equal(typeof item.startupLeakBaseline, "string");
	assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(item.sanitizerProbes.length, 2);
	for(const [index, fault, diagnostic] of [
		[0, "address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
		, [1, "undefined", /runtime error: shift exponent 40 is too large/u]
	]) {
		const probe = item.sanitizerProbes[index];
		assert.equal(probe.fault, fault); assert.equal(probe.rejected, true);
		assert.match(probe.diagnostic, diagnostic);
	}
	const expected = item.name === "host" ? [] : ownedRustCallbackMutations(rust, combined);
	assert.deepEqual(item.mutations.map(({ diagnostic, ...mutation }) => {
		assert.match(diagnostic, /test owned_values::tests::callbacks \.\.\. FAILED/u); return mutation;
	}), expected.map(({ source, ...mutation }) => ({ ...mutation
		, sourceSha256: sha256(source), compiled: true, semanticRejection: true })));
	assert.equal(sha256(canonicalizeJsonValue(model.bindingIr)), model.bindingIrSha256);
};
