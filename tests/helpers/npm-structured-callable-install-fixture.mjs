/**
 * Independent structured and primitive contracts for the same npm component.
 *
 * @file
 */
import { callableReviewedIr, callableSignatures, callableArities } from "./callable-fixture.mjs";
import { structuredCallableReviewedIr, structuredCallableArities } from "./structured-callable-fixture.mjs";

const callback = (parameters, result) => ({ callback: { parameters, result } });
const unary = callback(["uint32"], "uint32"), sixteen = callback(Array(16).fill("uint32"), "uint32");
const primitives = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [unary], result: unary }
	, { name: "Callables.combine", parameters: ["string", "uint64", callback(["string", "uint64"], "string"), callback(["string"], "string")], result: "string" }
	, { name: "Callables.apply16", parameters: [sixteen], result: "uint32" }
	, { name: "Callables.make16", parameters: ["uint32"], result: sixteen }
].map(item => ({ ...item, name: item.name.replace("Callables.", "Structured.") }));

export const npmStructuredCallableArities = { ...structuredCallableArities
	, ...Object.fromEntries(Object.entries(callableArities).map(([name, arity]) => [name.replace("Callables.", "Structured."), arity]))
	, "Structured.retainCallback": 1, "Structured.make16": 1 };

/** Build the complete independent contract, including recursive callback values. */
export const npmStructuredCallableReviewedIr = () => {
	const structured = structuredCallableReviewedIr({ recursive: true });
	const primitive = callableReviewedIr(primitives);
	return { ...structured, producers: [...structured.producers, ...primitive.producers]
		, types: [...new Map([...structured.types, ...primitive.types].map(type => [type.id, type])).values()]
		, declarations: [...structured.declarations, ...primitive.declarations] };
};
