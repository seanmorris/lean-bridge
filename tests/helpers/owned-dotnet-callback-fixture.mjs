/**
 * Independent signatures for higher-order and all-primitive owned C# callbacks.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedCppCompositionReviewedIr } from "./owned-cpp-composition-fixture.mjs";

/** Extend the authored contract without reading extraction or generated code. */
export const ownedDotnetCallbacksReviewedIr = () => {
	const ir = ownedCppCompositionReviewedIr();
	const callbackTemplate = ir.types.find(type => type.kind === "callback");
	const functionTemplate = ir.declarations.find(fn => fn.name === "callbackRecord");
	const source = declaration => ({ producer: "corpusReview", declaration, extensions: {} });
	const site = (type, result = false) => ({ type
		, ownership: type.kind === "primitive" ? "copy" : result ? "lease" : "borrow"
		, lifetime: type.kind === "primitive" ? null : { scope: result ? "explicit" : "call", anchor: null } });
	const parameter = (type, index) => ({ name: `arg${index}`
		, ...site(type)
		, mutability: "immutable", optional: false, default: null });
	const callback = (parameters, result) => {
		const name = `Callback${sha256(canonicalJson({ parameters, result })).slice(0, 20)}`;
		const id = `bridge:${name}`;
		if(!ir.types.some(type => type.id === id)) ir.types.push({ ...callbackTemplate
			, id, name, source: source(name)
			, callable: { ...callbackTemplate.callable
				, parameters: parameters.map(parameter), result: site(result, true) } });
		return { kind: "named", id };
	};
	const fn = (name, parameters, result) => ir.declarations.push({ ...functionTemplate
		, id: `lean:Owned.${name}`, name, overloadKey: `Owned.${name}`
		, source: source(`Owned.${name}`)
		, parameters: parameters.map(parameter), result: site(result, true)
		, effects: ["reads-resource", ...result.kind === "primitive" ? [] : ["allocates"], "host-call", "fails"] });
	const bundle = { kind: "named", id: "lean:Owned.Bundle" };
	fn("withFunction", [bundle, callback([callback([bundle], bundle), bundle], bundle)], bundle);
	for(const [name, kind] of [
		["Unit", "unit"], ["Bool", "bool"], ["Char", "char"]
		, ["Nat", "nat"], ["Int", "int"]
		, ["U8", "uint8"], ["U16", "uint16"], ["U32", "uint32"], ["U64", "uint64"]
		, ["I8", "int8"], ["I16", "int16"], ["I32", "int32"], ["I64", "int64"]
		, ["Usize", "usize"], ["Isize", "isize"]
		, ["F32", "float32"], ["F64", "float64"]
		, ["String", "string"], ["Bytes", "bytes"]
	]) {
		const scalar = { kind: "primitive", name: kind };
		fn(`via${name}`, [callback([scalar], scalar), scalar], scalar);
	}
	return ir;
};
