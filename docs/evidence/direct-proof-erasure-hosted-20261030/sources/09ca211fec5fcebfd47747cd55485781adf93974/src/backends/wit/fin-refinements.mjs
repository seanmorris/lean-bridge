/**
 * Document compiler-checked top-level Fin sites in WIT/WASI host packages.
 *
 * @file
 */
import { nativeFinContainerNote, nativeFinRefinements, nativeFinSummary, nativeRefinementReadme } from "../native/fin-refinements.mjs";

// A dependent Fin bound is an earlier Nat argument of the same call, not a constant.
const dependentFin = (functions, types) => functions.some(fn =>
	nativeFinRefinements(fn.declaration, types)?.parameters.some(site => site?.kind === "fin-parameter"));

/**
 * Describe each checked bound with its WIT export and parameter names.
 * The WIT text is unchanged: Fin travels as the same list<u32> limbs as Nat.
 *
 * @param projection - Admitted copied WIT model.
 */
export const witFinReadme = projection => {
	const lines = projection.surface.functions.flatMap(fn => {
		const bounds = nativeFinSummary(fn.declaration, fn.parameters.map(parameter => parameter.witName), projection.ir.types);
		return bounds ? [`- ${fn.witName}: ${bounds}`] : [];
	});
	return lines.length ? `\n## Bounded integers\n\n${nativeRefinementReadme(projection.surface.functions.map(fn => fn.declaration), `Lean Fin n parameters and results use the Nat representation, list<u32> little-endian limbs, with values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs; an argument at or above its bound fails the call with a Wasmtime error whose message names the Lean parameter and bound, leaving the result slot unchanged. Fin 0 has no values, so every call to an export taking one fails. Results are limb lists below their declared bound. ${dependentFin(projection.surface.functions, projection.ir.types) ? "A bound listed below as an earlier parameter name, from a Lean signature such as (n : Nat) → Fin n → α, is that argument's value in the same call: both limb lists are read first, and the Wasmtime error message names the value and its bound parameter, such as \"arg1 is not below its dependent Fin bound arg0\". " : ""}${nativeFinContainerNote(projection.surface.functions.map(fn => fn.declaration), "WIT packages", projection.ir.types)}`, "WIT packages", projection.ir.types)}\n\n${lines.join("\n")}\n` : "";
};
