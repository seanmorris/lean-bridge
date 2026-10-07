/**
 * Document compiler-checked top-level Fin sites in generated Python packages.
 *
 * @file
 */
export { nativeFinRefinements as pythonFinRefinements, nativeFinSummary as pythonFinSummary } from "../native/fin-refinements.mjs";
import { nativeFinContainerNote, nativeRefinementReadme } from "../native/fin-refinements.mjs";

/**
 * Shared README contract for packages with at least one checked Fin site.
 *
 * @param declarations - Binding IR declarations of the package's exports.
 */
export const pythonFinReadme = declarations => "\n" + nativeRefinementReadme(declarations, "Lean Fin n parameters and results are exact Python int values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs. A Boolean or other non-int argument raises TypeError and a negative int raises ValueError, as for Nat; an int at or above its bound raises LeanBridgeError with status 1, naming the parameter and bound. Fin 0 has no values, so every call to a function taking one is rejected. Results are int values below their declared bound. " + nativeFinContainerNote(declarations, "Python packages") + "\n", "Python packages");
