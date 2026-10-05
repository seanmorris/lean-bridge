/**
 * Keep fresh invocation provenance separate from frozen callback semantics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";
import { callbackCompilerInputAtBaseline } from "./callback-compiler-identity.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";

test("callback evidence rebases only authenticated extractor invocation identities", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/owned-jvm-callback-results-20261003.json", "utf8"));
	const reports = unpackOwnedCallbackReports(receipt.archive);
	const extractor = sha256(await readFile("src/analyze/NativeExports.lean"));
	let checked = 0;
	for(const [name, report] of Object.entries(reports))
	{
		if(!name.endsWith("-runtime.json")) continue;
		const original = report.input, input = structuredClone(original), identity = input.sourceIdentity;
		assert.deepEqual(await callbackCompilerInputAtBaseline(original), original);
		identity.extractorSha256 = extractor;
		const selection = structuredClone(identity.request); delete selection.metadata;
		identity.request = createMetadataRequest(selection, {
			toolchain: `leanprover/lean4:v${identity.leanVersion}`
			, modules: identity.modules.map(item => ({
				name: item.module
				, sourcePath: item.source.path
				, sourceSha256: item.source.sha256
				, interfaceSha256: item.interface.interfaceSha256
			}))
			, leanCompilerSha256: identity.leanCompilerSha256
			, ...identity.reviewedBindingIr === undefined ? {} : { reviewedBindingIrSha256: sha256(canonicalJson(identity.reviewedBindingIr)) }
			, extractorSha256: extractor
		});
		input.metadata.producer.invocationIdentitySha256 = identity.request.metadata.invocationIdentitySha256;
		const unchanged = structuredClone(input);
		assert.deepEqual(await callbackCompilerInputAtBaseline(input), original);
		assert.deepEqual(input, unchanged, "normalization must not mutate observed evidence");
		for(const mutate of [
			item => { item.sourceIdentity.extractorSha256 = "0".repeat(64); }
			, item => { item.metadata.producer.invocationIdentitySha256 = "0".repeat(64); }
			, item => { item.sourceIdentity.request.metadata.invocationIdentitySha256 = "0".repeat(64); }
			, item => { item.sourceIdentity.modules[0].interface.interfaceSha256 = "0".repeat(64); }
		]) {
			const altered = structuredClone(input); mutate(altered);
			await assert.rejects(() => callbackCompilerInputAtBaseline(altered));
		}
		checked++;
	}
	assert.equal(checked, 6);
});
