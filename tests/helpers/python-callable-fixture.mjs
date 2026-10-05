/**
 * Independent additional Python callable signatures.
 *
 * @file
 */
import { callableSignatures, callableArities } from "./callable-fixture.mjs";

export const pythonCallableSignatures = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [{ callback: { parameters: ["uint32"], result: "uint32" } }], result: { callback: { parameters: ["uint32"], result: "uint32" } } }
	, { name: "Callables.combine", parameters: ["string", "uint64", { callback: { parameters: ["string", "uint64"], result: "string" } }, { callback: { parameters: ["string"], result: "string" } }], result: "string" }];
export const pythonCallableArities = { ...callableArities, "Callables.retainCallback": 1 };
