/**
 * Ruby callback owners remain independent of host callbacks and export anchors.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRubyCallbackResultReviewedIr, ownedRubyCallbackResultCombinedReviewedIr } from "./helpers/owned-ruby-callback-result-fixture.mjs";

test("Ruby callback anchors preserve original owners without phantom export capabilities", () => {
	for(const [hostCallbacks, combined] of [[false, false], [true, false], [true, true]])
	{
		const ir = (combined ? ownedRubyCallbackResultCombinedReviewedIr : ownedRubyCallbackResultReviewedIr)();
		const before = structuredClone(ir), options = {
			hostCallbacks, callbackResultAnchors: true, transferredInputs: combined
			, anchoredResults: combined, receiverExports: combined
		};
		assert.throws(() => generateOwnedRubyPackage(ir, null, { ...options, callbackResultAnchors: false }), /explicit output leases/u);
		const generated = generateOwnedRubyPackage(ir, null, options);
		assert.deepEqual(ir, before);
		assert.equal(generated.contract.schemaVersion, 5);
		assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-ruby-v5");
		assert.equal(generated.contract.callbackResultAnchors.signatures.length, 4);
		assert.equal(generated.contract.callbackResultAnchors.parameterNumbering, "callback-local");
		for(const callback of generated.c.callbacks.filter(item => item.anchor !== undefined))
			assert.equal(generated.contract.callbackResultAnchors.signatures.find(item => item.id === callback.id).parameter, callback.anchor - 1);
		for(const key of ["resultAnchors", "receiverExports", "inputTransfers"])
			assert.equal(Boolean(generated.contract[key]), combined, key);
		assert.match(generated.valuesSource, /Value = Owned::Value/u);
		assert.match(generated.files[`lib/${generated.requirePath}/owned.rb`], /result_validate/u);
		if(!hostCallbacks)
		{
			assert.deepEqual(generated.callbackLayouts, []);
			assert.doesNotMatch(generated.valuesSource, /WithRecovery|with_recovery/u);
			assert.doesNotMatch(generated.files["README.md"], /Pass synchronous Ruby callables/u);
		}
		const reversed = structuredClone(ir); reversed.types.reverse();
		const reordered = generateOwnedRubyPackage(reversed, null, options);
		for(const field of ["valuesSource", "source", "cSource", "abiHeader", "contract"])
			assert.deepEqual(reordered[field], generated[field]);
	}
	const base = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedRubyPackage(base, null, { callbackResultAnchors: true }).files, generateOwnedRubyPackage(base).files);
});
