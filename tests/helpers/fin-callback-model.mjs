/**
 * A compiler-shaped native model of the FinCallbacks fixture (VO #1445), for generated-source
 * checks without a Lean build. Leased closures and host callbacks mirror the extractor's shapes.
 *
 * @file
 */
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
/**
 * A Fin type over Nat, as the extractor reports it.
 *
 * @param bound - Exact decimal bound.
 */
const fin = bound => ({ kind: "refinement", base: nat, predicate: { kind: "fin", bound }, abi: nat.abi });
const array = element => ({ kind: "array", element, abi: heap });
const option = element => ({ kind: "option", element, abi: heap });
const tuple = (first, second) => ({ kind: "tuple", arguments: [first, second], abi: heap });
const result = (ok, error) => ({ kind: "result", arguments: [ok, error], abi: heap });
/**
 * A callback type, as the extractor reports it.
 *
 * @param parameters - Argument types.
 * @param value - Result type.
 */
const callback = (parameters, value) => ({ kind: "callback", parameters, result: value, abi: heap });
export { callback as finCallback, fin as finCallbackBound, nat as finCallbackNat };
/** Parameter and result shapes of every exported declaration, with configured arity 1 where a closure is leased. */
export const finCallbackSignatures = {
	branch: [nat, callback([result(fin("7"), text)], nat)]
	, counter: [nat, callback([nat], fin("10"))]
	, digits: [nat, callback([array(fin("3"))], nat)]
	, impossible: [nat, callback([fin("0")], nat)]
	, pick: [nat, callback([option(tuple(fin("5"), nat))], nat)]
	, scaler: [nat, callback([fin("10")], nat)]
	, visit: [callback([fin("5")], nat), nat]
	, wide: [nat, callback([fin("184467440737095516170")], nat)] };

/**
 * Compiler-shaped model input for the given exports under the fincallbacks component.
 *
 * @param signatures - Exported shapes; the fixture's by default.
 */
export const finCallbackCompilerInput = (signatures = finCallbackSignatures) => {
	const input = nativeMetadataFixture(), module = input.metadata.modules[0], template = module.declarations[0];
	module.declarations = Object.entries(signatures).sort(([a], [b]) => a < b ? -1 : 1).map(([name, [parameter, value]]) => ({ ...structuredClone(template), identity: `Sample.${name}`
		, projection: { ...structuredClone(template.projection), parameters: [{ name: "value", type: parameter }], result: value } }));
	const { metadata, ...selection } = input.sourceIdentity.request;
	void metadata;
	selection.exports = module.declarations.map(item => item.identity);
	const modules = [{ name: "Sample", sourcePath: "Sample.lean", sourceSha256: "e".repeat(64), interfaceSha256: "1".repeat(64) }];
	const identity = { toolchain: "leanprover/lean4:v4.32.2", modules, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256, extractorSha256: input.sourceIdentity.extractorSha256 };
	input.sourceIdentity.request = { ...selection, metadata: createMetadataRequest(selection, identity).metadata };
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	return { ...input, component: { id: "fincallbacks@1.0.0", name: "fincallbacks", version: "1.0.0" } };
};

/**
 * Build the checked native model, with Fin in callbacks admitted as C and C++ packages do.
 *
 * @param signatures - Exported shapes; the fixture's by default.
 * @param callbackRefinements - Whether every selected package checks Fin in callbacks.
 */
export const finCallbackCompilerModel = (signatures = finCallbackSignatures, callbackRefinements = true) => createNativeModel(finCallbackCompilerInput(signatures), { refinements: true, callbackRefinements });
