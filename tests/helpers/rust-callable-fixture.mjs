/**
 * Independent additional Rust callable signatures.
 *
 * @file
 */
import { callableSignatures, callableArities } from "./callable-fixture.mjs";

export const rustCallableSignatures = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [{ callback: { parameters: ["uint32"], result: "uint32" } }], result: { callback: { parameters: ["uint32"], result: "uint32" } } }
	, { name: "Callables.combine", parameters: ["string", "uint64", { callback: { parameters: ["string", "uint64"], result: "string" } }, { callback: { parameters: ["string"], result: "string" } }], result: "string" }];
export const rustCallableArities = { ...callableArities, "Callables.retainCallback": 1 };
