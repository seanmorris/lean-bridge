/**
 * A compiler-shaped native model of the FinProducts fixture, for generated-source checks
 * without a Lean build. The metadata mirrors the extractor: an alias of a bare Fin folds
 * into its uses, so DigitPair is the only nominal definition.
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
const pair = (first, second) => ({ kind: "tuple", arguments: [first, second], abi: heap });
const branches = (ok, error) => ({ kind: "result", arguments: [ok, error], abi: heap });
const option = element => ({ kind: "option", element, abi: heap });
const list = element => ({ kind: "list", element, abi: heap });
const digitPair = { kind: "alias", name: "FinProducts.DigitPair", lean: "FinProducts.DigitPair", target: pair(fin("10"), fin("10")), abi: heap };
/** Parameter and result shapes of every exported declaration, as the extractor reports them. */
const signatures = {
	absentOnly: [option(pair(fin("0"), nat)), nat]
	, aliased: [digitPair, digitPair]
	, both: [branches(fin("7"), fin("3")), nat]
	, errorOnly: [branches(nat, fin("5")), nat]
	, first: [pair(fin("10"), nat), pair(fin("10"), nat)]
	, nested: [list(option(pair(fin("3"), branches(nat, fin("2"))))), nat]
	, okOnly: [branches(fin("10"), text), nat]
	, pairUp: [nat, pair(fin("10"), nat)]
	, produce: [nat, branches(text, fin("10"))]
	, second: [pair(nat, fin("1")), nat]
	, wide: [pair(fin("184467440737095516170"), fin("10")), nat] };
export { signatures as finProductSignatures };

/** Build the checked native model for the fixture's exports under the finproducts component. */
export const finProductCompilerModel = () => createNativeModel(finProductCompilerInput(), { refinements: true });

/**
 * Compiler-shaped model input for the fixture's exports, for any native model reader.
 *
 * @param shapes - Exported shapes; the fixture's by default.
 */
export const finProductCompilerInput = (shapes = signatures) => {
	const input = nativeMetadataFixture(), module = input.metadata.modules[0], template = module.declarations[0];
	module.declarations = Object.entries(shapes).sort(([a], [b]) => a < b ? -1 : 1).map(([name, [parameter, result]]) => ({ ...structuredClone(template), identity: `Sample.${name}`
		, projection: { ...structuredClone(template.projection), parameters: [{ name: "value", type: parameter }], result } }));
	const { metadata, ...selection } = input.sourceIdentity.request;
	void metadata;
	selection.exports = module.declarations.map(item => item.identity);
	const modules = [{ name: "Sample", sourcePath: "Sample.lean", sourceSha256: "e".repeat(64), interfaceSha256: "1".repeat(64) }];
	const identity = { toolchain: "leanprover/lean4:v4.32.2", modules, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256, extractorSha256: input.sourceIdentity.extractorSha256 };
	input.sourceIdentity.request = { ...selection, metadata: createMetadataRequest(selection, identity).metadata };
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	return { ...input, component: { id: "finproducts@1.0.0", name: "finproducts", version: "1.0.0" } };
};
