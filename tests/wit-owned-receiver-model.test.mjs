/**
 * Preserve receiver identity and remaining-parameter anchors in typed WIT.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { ownedRustReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverReviewedIr } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";

const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true };

test("WIT receiver signatures retain the original first argument and remaining anchors", () => {
	const ir = ownedRustReceiverReviewedIr();
	assert.throws(() => compileOwnedWitGraphModel(ir, {}, { transferredInputs: true, anchoredResults: true }), /synchronous function/u);
	const model = compileOwnedWitGraphModel(ir, {}, capabilities);
	assert.equal(model.manifest.graph.schemaVersion, 3);
	assert.equal(model.manifest.graph.receiverExports.length, 16);
	assert.equal(model.manifest.graph.resultAnchors.length, 20);
	assert.equal(model.layout.functions.length, 27);
	assert.equal(model.manifest.deferred.includes("receiver-result-anchors"), false);
	assert.ok(model.manifest.deferred.includes("callback-result-anchors"));
	for(const declaration of ir.declarations)
	{
		const fn = model.functions.find(item => item.declaration.id === declaration.id);
		const native = model.layout.functions.find(item => item.id === declaration.id);
		assert.equal(fn.parameters.length, native.parameters.length, declaration.name);
		const manifest = model.manifest.declarations.find(item => item.id === declaration.id);
		if(declaration.receiver)
		{
			assert.equal(manifest.receiver.witType, fn.parameters[0].copy.wit);
			assert.equal(manifest.parameters.length, declaration.parameters.length);
			for(const [index, parameter] of manifest.parameters.entries())
				assert.equal(parameter.witType, fn.parameters[index + 1].copy.wit);
			assert.deepEqual(model.manifest.graph.receiverExports.find(item => item.bindingId === declaration.id)
				, { bindingId: declaration.id, kind: declaration.kind, owner: declaration.owner, argument: 0 });
		}
	}
	assert.deepEqual(model.manifest.graph.resultAnchors.find(item => item.bindingId === "lean:Owned.chooseTicket")
		, { bindingId: "lean:Owned.chooseTicket", parameter: 1 });
	assert.deepEqual(model.manifest.graph.resultAnchors.find(item => item.bindingId === "lean:Owned.primary")
		, { bindingId: "lean:Owned.primary", parameter: 0 });
	for(const name of ["transferTicket", "moveRecord"])
		assert.deepEqual(model.layout.functions.find(item => item.name === name).transfers, [0]);
	assert.deepEqual(model.layout.functions.find(item => item.name === "mixedTicket").transfers, [1]);
	assert.deepEqual(model.model.bindingIr, ir);
});

test("WIT resource methods and Unit properties require no callback or result-anchor capability", () => {
	for(const consuming of [false, true])
	{
		const model = compileOwnedWitGraphModel(ownedJvmPlainReceiverReviewedIr(consuming), {}, {
			receiverExports: true, transferredInputs: consuming
		});
		assert.equal(model.manifest.graph.schemaVersion, 3);
		assert.equal(model.manifest.graph.receiverExports.length, consuming ? 4 : 3);
		assert.equal(model.manifest.graph.resultAnchors, undefined);
		assert.equal(model.layout.callbacks.length, 0);
		const property = model.functions.find(item => item.declaration.name === "pingTicket");
		assert.equal(property.parameters.length, 1);
		assert.equal(property.resultCopy.scalarName, "unit");
		assert.ok(property.parameters[0].copy.borrowed);
		if(consuming) assert.equal(model.functions.find(item => item.declaration.name === "transferTicket").parameters[0].copy.borrowed, false);
	}
});

test("admitting WIT receivers leaves existing function-only projections byte-identical", () => {
	const ir = ownedRustBorrowReviewedIr();
	const previous = compileOwnedWitGraphModel(ir, {}, { transferredInputs: true, anchoredResults: true });
	const admitted = compileOwnedWitGraphModel(ir, {}, capabilities);
	for(const key of ["layout", "manifest", "wit", "wat"]) assert.deepEqual(admitted[key], previous[key]);
});

test("synthetic WIT receiver labels do not collide with authored parameter names", () => {
	const ir = ownedRustReceiverReviewedIr();
	const fn = ir.declarations.find(item => item.name === "chooseTicket");
	fn.parameters[0].name = "receiver";
	fn.result.lifetime.anchor = "receiver";
	const model = compileOwnedWitGraphModel(ir, {}, capabilities);
	const projected = model.functions.find(item => item.declaration.id === fn.id);
	assert.deepEqual(projected.parameters.map(item => item.witName), ["receiver-1", "receiver"]);
	assert.equal(model.layout.functions.find(item => item.id === fn.id).anchor, 1);
	assert.equal(model.manifest.declarations.find(item => item.id === fn.id).receiver.witName, "receiver-1");
});
