/**
 * Admit only implemented host projections of the finite native graph carrier.
 *
 * @file
 */
import { compileCopiedGraphPackageModel } from "../backends/c/graph-package.mjs";
import { compileCopiedRustGraphPackageModel } from "../backends/rust/copied-graph-package.mjs";
import { compileCopiedPythonGraphPackageModel } from "../backends/python/copied-graph-package.mjs";
import { compileCopiedRubyGraphPackageModel } from "../backends/ruby/copied-graph-package.mjs";

/**
 * Validate all requested graph hosts without inventing an extra public C target.
 *
 * @param ir - Compiler-checked copied graph contract.
 * @param targets - Explicit native package targets.
 */
export const compileNativeGraphProjection = (ir, targets) => {
	if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["c", "cpp", "cargo", "pypi", "rubygems"].includes(target)))
		throw Object.assign(new TypeError("Native copied graphs currently require C, C++, Cargo, PyPI or RubyGems target adapters"), { code: "native-graph-projection-unavailable" });
	const cTargets = targets.filter(target => ["c", "cpp"].includes(target));
	const c = cTargets.length ? compileCopiedGraphPackageModel(ir, cTargets) : null;
	const rust = targets.includes("cargo") ? compileCopiedRustGraphPackageModel(ir) : null;
	const python = targets.includes("pypi") ? compileCopiedPythonGraphPackageModel(ir) : null;
	const ruby = targets.includes("rubygems") ? compileCopiedRubyGraphPackageModel(ir) : null;
	return c ?? rust ?? python ?? ruby;
};
