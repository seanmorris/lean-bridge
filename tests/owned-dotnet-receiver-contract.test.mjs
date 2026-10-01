/**
 * Receiver package metadata records the actual CLR member and owner surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateOwnedDotnetPackage } from "../src/backends/dotnet/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverReviewedIr, ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";

const capabilities = { receiverExports: true, anchoredResults: true, transferredInputs: true };

test("C# package receipts describe nominal owners and read-only receiver properties", () => {
	const ir = ownedRustReceiverReviewedIr(), before = structuredClone(ir);
	const generated = generateOwnedDotnetPackage(ir, null, capabilities);
	assert.deepEqual(ir, before);
	const manifest = JSON.parse(generated.files["binding-manifest.json"]);
	assert.equal(generated.contract.schemaVersion, 4);
	assert.equal(generated.contract.backend, "owned-dotnet-v4");
	assert.equal(manifest.schemaVersion, 4);
	assert.equal(manifest.backend, "owned-dotnet-v4");
	assert.equal(manifest.generator, "dotnet-owned-values-v4");
	assert.equal(generated.contract.receiverExports.exports.length, 16);
	assert.deepEqual(generated.contract.receiverExports.exports.find(fn => fn.member === "Serial"), {
		bindingId: "lean:Owned.serial", owner: "lean:Owned.Ticket"
		, kind: "property", member: "Serial"
	});
	assert.equal(generated.contract.receiverExports.properties, "read-only-properties");
	assert.equal(generated.contract.inputTransfers.arguments, "whole-values");
	const invalid = structuredClone(ir), receiver = invalid.declarations.find(fn => fn.name === "serial");
	receiver.owner = "lean:Owned.Payload";
	receiver.receiver = { type: { kind: "named", id: receiver.owner }, ownership: "copy", lifetime: null, mutability: "immutable" };
	assert.throws(() => generateOwnedDotnetPackage(invalid, null, capabilities), /owner must name a resource or owned aggregate/u);
	assert.ok(manifest.supportedFeatures.includes("receiver-properties"));
	assert.deepEqual(manifest.capabilityGaps.map(item => item.feature), ["callback-result-anchors", "additional-platforms"]);
	assert.match(generated.files["README.md"], /TicketValue : Value<Ticket>/u);
	assert.doesNotMatch(generated.files["README.md"], /Receiver anchors and callback-result anchors are not admitted/u);
	const permuted = structuredClone(ir); permuted.types.reverse();
	const shuffled = generateOwnedDotnetPackage(permuted, null, capabilities);
	for(const [path, source] of Object.entries(generated.files))
		if(path !== "binding-manifest.json") assert.equal(shuffled.files[path], source, path);
	for(const previous of [ownedAggregateReviewedIr(), ownedRustBorrowReviewedIr()])
		assert.deepEqual(generateOwnedDotnetPackage(previous, null, capabilities).files,
			generateOwnedDotnetPackage(previous, null, { ...capabilities, receiverExports: false }).files);
});

test("C# receiver-only packages do not advertise missing callback or result-anchor capabilities", () => {
	for(const consuming of [false, true])
	{
		const generated = generateOwnedDotnetPackage(ownedRustPlainReceiverReviewedIr(consuming), null, {
			receiverExports: true, hostCallbacks: false, transferredInputs: consuming
		});
		assert.equal(generated.contract.resultAnchors, undefined);
		assert.equal(generated.contract.receiverExports.exports.length, consuming ? 3 : 2);
		assert.equal(generated.contract.inputTransfers?.arguments, consuming ? "whole-values" : undefined);
		assert.doesNotMatch(generated.files["README.md"], /Callbacks are|SameIdentity/u);
		assert.match(generated.files["README.md"], /Share creates another guard for the same owner/u);
		assert.ok(!JSON.parse(generated.files["binding-manifest.json"]).supportedFeatures.includes("callbacks"));
	}
});
