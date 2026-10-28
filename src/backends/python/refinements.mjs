/**
 * Document compiler-checked top-level Fin sites in generated Python packages.
 *
 * @file
 */
export { nativeFinRefinements as pythonFinRefinements, nativeFinSummary as pythonFinSummary } from "../native/fin-refinements.mjs";
import { nativeFinContainerNote, nativeFinRefinements, nativeRefinementReadme } from "../native/fin-refinements.mjs";

// A dependent Fin bound is an earlier Nat argument of the same call, not a constant.
const dependentFin = (declarations, types) => declarations.some(declaration =>
	nativeFinRefinements(declaration, types)?.parameters.some(site => site?.kind === "fin-parameter"));

/**
 * Shared README contract for packages with at least one checked Fin site.
 *
 * @param declarations - Binding IR declarations of the package's exports.
 * @param types - Binding IR type definitions, to document record and variant fields.
 */
export const pythonFinReadme = (declarations, types = []) => "\n" + nativeRefinementReadme(declarations, "Lean Fin n parameters and results are exact Python int values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs. A Boolean or other non-int argument raises TypeError and a negative int raises ValueError, as for Nat; an int at or above its bound raises LeanBridgeError with status 1, naming the parameter and bound. Fin 0 has no values, so every call to a function taking one is rejected. Results are int values below their declared bound. " + (dependentFin(declarations, types) ? "A bound listed below as an earlier parameter name, from a Lean signature such as (n : Nat) → Fin n → α, is that argument's value in the same call: both ints are checked as Nat first, and the LeanBridgeError message names the value and its bound parameter, such as \"arg1 is not below its dependent Fin bound arg0\". " : "") + nativeFinContainerNote(declarations, "Python packages", types) + "\n", "Python packages", types);
