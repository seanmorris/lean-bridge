/**
 * A compiler-shaped native model of the FinRecords fixture, for generated-source checks
 * without a Lean build. Record and variant shapes mirror the extractor's inline form.
 *
 * @file
 */
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
const fin = bound => ({ kind: "refinement", base: nat, predicate: { kind: "fin", bound }, abi: nat.abi });
/**
 * A plain record in the extractor's inline form.
 *
 * @param name - Unqualified record name in the FinRecords namespace.
 * @param fields - Field names and types, in declaration order.
 */
const record = (name, fields) => {
	const lean = `FinRecords.${name}`;
	const members = fields.map(([field, type]) => ({ name: field, projection: `${lean}.${field}`, type }));
	return { kind: "record", name: lean, lean, constructor: `${lean}.mk`, fields: members, abi: heap };
};
const variant = (name, cases) => {
	const lean = `FinRecords.${name}`;
	const branches = cases.map(([branch, fields]) => ({ name: branch, constructor: `${lean}.${branch}`, fields: fields.map(([field, type]) => ({ name: field, type })) }));
	return { kind: "variant", name: lean, lean, cases: branches, abi: heap };
};
const tile = record("Tile", [["digit", fin("5")], ["count", nat]]);
const shape = variant("Shape", [["circle", [["radius", fin("10")]]], ["label", [["text", text]]], ["empty", []]]);
export { record as finRecordShape, nat as finRecordNat };
/** Parameter and result shapes of every exported declaration, as the extractor reports them. */
export const finRecordSignatures = {
	tileExcept: [{ kind: "result", arguments: [tile, shape], abi: heap }, nat]
	, tileList: [{ kind: "list", element: tile, abi: heap }, nat]
	, tilePair: [{ kind: "tuple", arguments: [tile, shape], abi: heap }, nat]
	, tileSum: [tile, nat]
	, tiles: [{ kind: "array", element: tile, abi: heap }, nat]
	, bump: [tile, tile]
	, gateOpen: [variant("Gate", [["closed", []], ["never", [["value", fin("0")]]]]), nat]
	, lateSum: [record("Late", [["label", text], ["items", { kind: "array", element: nat, abi: heap }], ["digit", fin("5")]]), nat]
	, makeShape: [nat, shape]
	, maybeShape: [{ kind: "option", element: shape, abi: heap }, nat]
	, nestSum: [record("Nest", [["inner", tile], ["tag", fin("3")]]), nat]
	, shapeSize: [shape, nat]
	, slotCount: [record("Slot", [["maybe", { kind: "option", element: fin("0"), abi: heap }], ["count", nat]]), nat] };

/**
 * Build the checked native model for the fixture's exports under the finrecords component.
 *
 * @param options - Extra model options, such as a Perl module name.
 * @param signatures - Exported shapes; the fixture's by default.
 */
export const finRecordCompilerModel = (options = {}, signatures = finRecordSignatures) => {
	const input = nativeMetadataFixture(), module = input.metadata.modules[0], template = module.declarations[0];
	module.declarations = Object.entries(signatures).sort(([a], [b]) => a < b ? -1 : 1).map(([name, [parameter, result]]) => ({ ...structuredClone(template), identity: `Sample.${name}`
		, projection: { ...structuredClone(template.projection), parameters: [{ name: "value", type: parameter }], result } }));
	const { metadata, ...selection } = input.sourceIdentity.request;
	void metadata;
	selection.exports = module.declarations.map(item => item.identity);
	const modules = [{ name: "Sample", sourcePath: "Sample.lean", sourceSha256: "e".repeat(64), interfaceSha256: "1".repeat(64) }];
	const identity = { toolchain: "leanprover/lean4:v4.32.2", modules, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256, extractorSha256: input.sourceIdentity.extractorSha256 };
	input.sourceIdentity.request = { ...selection, metadata: createMetadataRequest(selection, identity).metadata };
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	return createNativeModel({ ...input, ...options, component: { id: "finrecords@1.0.0", name: "finrecords", version: "1.0.0" } }, { refinements: true });
};
