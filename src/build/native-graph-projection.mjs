/**
 * Admit only implemented host projections of the finite native graph carrier.
 *
 * @file
 */
import { compileCopiedGraphPackageModel } from "../backends/c/graph-package.mjs";
import { compileCopiedRustGraphPackageModel } from "../backends/rust/copied-graph-package.mjs";

/**
 * Validate all requested graph hosts without inventing an extra public C target.
 *
 * @param ir - Compiler-checked copied graph contract.
 * @param targets - Explicit native package targets.
 */
export const compileNativeGraphProjection = (ir, targets) => {
	if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["c", "cpp", "cargo"].includes(target)))
		throw Object.assign(new TypeError("Native copied graphs currently require C, C++ or Cargo target adapters"), { code: "native-graph-projection-unavailable" });
	const cTargets = targets.filter(target => target !== "cargo");
	const c = cTargets.length ? compileCopiedGraphPackageModel(ir, cTargets) : null;
	const rust = targets.includes("cargo") ? compileCopiedRustGraphPackageModel(ir) : null;
	return c ?? rust;
};
