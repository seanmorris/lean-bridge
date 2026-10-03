/**
 * Callback-local Perl ownership projection, without native or CPAN admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateOwnedPerlValues } from "../../src/backends/perl/owned-values.mjs";
import { generateOwnedPerlConversions } from "../../src/backends/perl/owned-conversions.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultCombinedReviewedIr } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./owned-cpp-composition-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./owned-rust-transfer-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverReviewedIr, ownedRustPlainReceiverReviewedIr } from "./owned-rust-receiver-fixture.mjs";

const namespace = "LeanBridge::CallbackResults";
const combinedOptions = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const fixtures = [ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultCombinedReviewedIr];

test("Perl callback-result anchors require their own explicit capability", () => {
	for(const fixture of fixtures)
		for(const hostCallbacks of [false, true])
			for(const generate of [generateOwnedPerlValues, generateOwnedPerlConversions])
				for(const capability of [{}, { callbackResultAnchors: false }])
					assert.throws(() => generate(fixture(), namespace, {
						...combinedOptions, hostCallbacks, ...capability
					}), /explicit output leases/u);
});

test("Perl callback-result C owners select the last argument after the private closure", () => {
	for(const hostCallbacks of [false, true])
	{
		const ir = ownedDotnetCallbackResultReviewedIr();
		const model = generateOwnedPerlValues(ir, namespace, { callbackResultAnchors: true, hostCallbacks });
		const anchored = model.c.callbacks.filter(callback => callback.anchor !== undefined);
		assert.equal(anchored.length, 4); assert.equal(model.c.callbacks.length, 6);
		assert.deepEqual(anchored.map(callback => callback.anchor).sort(), [1, 1, 2, 2]);
		for(const callback of anchored)
		{
			const { callable } = ir.types.find(type => type.id === callback.id);
			const anchor = callable.parameters.findIndex(parameter => parameter.name === callable.result.lifetime.anchor);
			assert.equal(anchor, callable.parameters.length - 1);
			assert.equal(callback.anchor, anchor + 1);
			assert.equal(callback.parameters[0], callback.id);
			assert.equal(callback.anchor, callback.parameters.length - 1);
			const signature = model.c.signature(callback);
			assert.ok(signature.includes(` a${callback.anchor}, ${model.c.prefix}_result *a${callback.anchor}_owner, `));
			assert.deepEqual([...signature.matchAll(/\*a(\d+)_owner/gu)].map(match => Number(match[1])), [callback.anchor]);
			assert.ok(model.c.header.includes(signature + ";"));
		}
		for(const callback of model.c.callbacks.filter(item => item.anchor === undefined))
			assert.doesNotMatch(model.c.signature(callback), /a\d+_owner/u);
	}
});

test("Perl callback-only anchors enable whole owners and copies without host descriptors", () => {
	for(const hostCallbacks of [false, true])
	{
		const model = generateOwnedPerlConversions(ownedDotnetCallbackResultReviewedIr(), namespace, {
			callbackResultAnchors: true, hostCallbacks
		});
		assert.ok(model.functions.every(fn => fn.anchor === undefined && fn.receiver === undefined && !fn.transfers?.length));
		assert.equal(model.wholeOwners, true); assert.equal(model.c.anchoredResults, true);
		assert.equal(model.receiverExports, false); assert.equal(model.hostCallbacks, hostCallbacks);
		assert.ok(model.publicTypes.includes(namespace + "::Value"));
		assert.ok(model.types.every(node => node.ownerType === undefined));
		assert.match(model.valuesSource, /package LeanBridge::CallbackResults::Value;/u);
		assert.match(model.valuesSource, /sub copy_value \{/u);
		assert.match(model.source, /static int lpo_owner_open\(lpo_owner \*owner\)/u);
		assert.ok(model.source.includes(`${model.c.prefix}_result_validate(lpo_state.session, owner->result)`));
		for(const node of model.types.filter(node => node.identity))
			assert.ok(model.source.includes(`*out = (${node.cName})lpo_leaf_borrow(aTHX_ value, ${node.index});`));
		const copied = model.types.filter(node => !node.identity);
		assert.equal(copied.length, 20);
		assert.deepEqual(model.c.copies.map(copy => copy.id), copied.map(node => node.id));
		for(const copy of model.c.copies)
		{
			assert.equal(copy.copy, true);
			assert.ok(model.c.header.includes(model.c.signature(copy) + ";"));
		}
		assert.equal(Object.hasOwn(model.c, "hostArgument"), hostCallbacks);
		for(const callback of model.c.callbacks)
		{
			const node = model.types.find(type => type.id === callback.id);
			assert.equal(model.c.header.includes(`} ${node.cName}_host;`), hostCallbacks);
			assert.equal(model.c.header.includes(`${node.cName.toUpperCase()}_REQUIRES_RECOVERY`), hostCallbacks);
		}
		if(!hostCallbacks) assert.doesNotMatch(model.c.header, /_host\b/u);
	}
});

test("Perl callback anchors compose with original-owner receivers and consuming inputs", () => {
	for(const hostCallbacks of [false, true])
	{
		const ir = ownedDotnetCallbackResultCombinedReviewedIr();
		const options = { ...combinedOptions, callbackResultAnchors: true, hostCallbacks };
		const model = generateOwnedPerlValues(ir, namespace, options);
		assert.equal(model.wholeOwners, true); assert.equal(model.receiverExports, true);
		assert.equal(model.c.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
		assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 5);
		assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 1);
		assert.equal(model.functions.filter(fn => fn.transfers?.length).length, 2);
		for(const fn of model.functions)
		{
			if(fn.anchor !== undefined)
				assert.ok(model.c.signature(fn).includes(`${model.c.prefix}_result *a${fn.anchor}_owner`));
			for(const index of fn.transfers ?? [])
				assert.ok(model.c.signature(fn).includes(`${model.c.prefix}_result **a${index}_owner`));
		}
		assert.ok(model.types.some(node => node.name === "Bundle" && node.ownerType === namespace + "::BundleValue"));
		for(const capability of Object.keys(combinedOptions))
			assert.throws(() => generateOwnedPerlValues(ir, namespace, { ...options, [capability]: false }));
	}
});

test("Perl callback ownership projection is immutable and stable under type reordering", () => {
	for(const fixture of fixtures)
		for(const hostCallbacks of [false, true])
		{
			const ir = fixture(), before = structuredClone(ir);
			const options = { ...combinedOptions, callbackResultAnchors: true, hostCallbacks };
			const { c, ...model } = generateOwnedPerlConversions(ir, namespace, options);
			assert.deepEqual(ir, before);
			const { c: repeatedC, ...repeated } = generateOwnedPerlConversions(ir, namespace, options);
			assert.deepEqual(repeated, model);
			assert.equal(repeatedC.header, c.header); assert.deepEqual(repeatedC.native, c.native);
			const reordered = structuredClone(ir); reordered.types.reverse();
			const reorderedBefore = structuredClone(reordered);
			const reorderedModel = generateOwnedPerlConversions(reordered, namespace, options);
			// Private native names bind the input IR; public generated bytes are canonical.
			for(const field of ["source", "valuesSource"]) assert.equal(reorderedModel[field], model[field]);
			assert.equal(reorderedModel.c.header, c.header);
			assert.deepEqual(reorderedModel.publicTypes, model.publicTypes);
			assert.deepEqual(ir, before); assert.deepEqual(reordered, reorderedBefore);
		}
});

test("Perl callback capability leaves legacy generated bytes unchanged without actual anchors", () => {
	for(const fixture of [ownedAggregateReviewedIr
		, ownedCppCompositionReviewedIr, ownedRustTransferReviewedIr
		, ownedRustBorrowReviewedIr, ownedRustReceiverReviewedIr
		, ownedRustPlainReceiverReviewedIr
		, () => ownedRustPlainReceiverReviewedIr(true)])
		for(const hostCallbacks of [false, true])
		{
			const ir = fixture(), options = { ...combinedOptions, hostCallbacks };
			assert.ok(ir.types.every(type => type.kind !== "callback" || type.callable.result.ownership !== "borrow"));
			const { c, ...baseline } = generateOwnedPerlConversions(ir, namespace, options);
			for(const callbackResultAnchors of [false, true])
			{
				const { c: enabledC, ...enabled } = generateOwnedPerlConversions(ir, namespace, { ...options, callbackResultAnchors });
				assert.deepEqual(enabled, baseline);
				assert.equal(enabledC.header, c.header);
				assert.deepEqual(enabledC.native, c.native);
				assert.deepEqual(enabledC.copies, c.copies);
				if(!hostCallbacks) assert.equal(Object.hasOwn(enabledC, "copies"), false);
			}
		}
});
