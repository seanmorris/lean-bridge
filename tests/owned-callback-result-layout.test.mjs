/**
 * Keep callback-local owners separate from the implicit closure and export flags.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileOwnedNativeValueLayout } from "../src/backends/native/owned-value-layout.mjs";
import { createOwnedCompiledNativeModel, generateOwnedNativeLeanAdapters } from "../src/build/owned-native-model.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedCallbackResultReviewedIr } from "./helpers/owned-callback-result-fixture.mjs";

test("callback result anchors account for the implicit closure argument on both word widths", () => {
	for(const wordBits of [32, 64])
	{
		const ir = ownedCallbackResultReviewedIr();
		const layout = compileOwnedNativeValueLayout(ir, { wordBits, callbackResultAnchors: true });
		assert.equal(layout.callbacks.filter(value => value.anchor !== undefined).length, 4);
		assert.equal(layout.callbacks.filter(value => value.anchor === undefined).length, 1);
		for(const callback of layout.callbacks)
		{
			const type = ir.types.find(value => value.id === callback.id);
			assert.equal(callback.parameters[0], callback.id);
			if(type.callable.result.ownership !== "borrow") continue;
			const expected = type.callable.parameters.findIndex(value => value.name === type.callable.result.lifetime.anchor);
			assert.equal(callback.anchor, expected + 1);
			assert.equal(callback.anchor, callback.parameters.length - 1);
			assert.notEqual(callback.parameters[callback.anchor], callback.id);
		}
	}
});

test("callback and export lifetime capabilities cannot silently authorize one another", () => {
	const ir = ownedCallbackResultReviewedIr();
	for(const options of [{}, { anchoredResults: true }, { transferredInputs: true }, { receiverExports: true }])
		assert.throws(() => compileOwnedNativeValueLayout(ir, options), /explicit output leases/u);
	for(const flag of [1, "true", null])
		assert.throws(() => compileOwnedNativeValueLayout(ir, { callbackResultAnchors: flag }), /capability must be explicit/u);
	const anchored = structuredClone(ir), exported = anchored.declarations.find(value => value.name === "echoRecord");
	exported.result.ownership = "borrow"; exported.result.lifetime = { scope: "parameter", anchor: exported.parameters[0].name };
	assert.throws(() => compileOwnedNativeValueLayout(anchored, { callbackResultAnchors: true }), /explicit output leases/u);
	assert.doesNotThrow(() => compileOwnedNativeValueLayout(anchored, { callbackResultAnchors: true, anchoredResults: true }));
	const transferred = structuredClone(ir), input = transferred.declarations.find(value => value.name === "echoRecord").parameters[0];
	input.ownership = "transfer";
	assert.throws(() => compileOwnedNativeValueLayout(transferred, { callbackResultAnchors: true }), /call-scoped input borrows/u);
	assert.doesNotThrow(() => compileOwnedNativeValueLayout(transferred, { callbackResultAnchors: true, transferredInputs: true }));
});

test("enabling callback result anchors leaves lease-only layouts byte-identical", () => {
	const ir = ownedAggregateReviewedIr();
	for(const wordBits of [32, 64])
		assert.deepEqual(compileOwnedNativeValueLayout(ir, { wordBits, callbackResultAnchors: true }), compileOwnedNativeValueLayout(ir, { wordBits }));
});

test("admitting callback result anchors preserves existing receiver models and carriers", async () => {
	const record = JSON.parse(await readFile("docs/evidence/owned-jvm-receiver-gc-20261001.json", "utf8"));
	for(const { input } of record.runtime)
	{
		const previous = createOwnedCompiledNativeModel(input);
		const admitted = createOwnedCompiledNativeModel({ ...input, callbackResultAnchors: true });
		assert.deepEqual(admitted, previous);
		assert.deepEqual(generateOwnedNativeLeanAdapters(admitted), generateOwnedNativeLeanAdapters(previous));
	}
});
