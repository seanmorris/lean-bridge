/**
 * Admit only implemented host projections of the finite native graph carrier.
 *
 * @file
 */
import { compileCopiedGraphPackageModel } from "../backends/c/graph-package.mjs";
import { compileCopiedRustGraphPackageModel } from "../backends/rust/copied-graph-package.mjs";
import { compileCopiedPythonGraphPackageModel } from "../backends/python/copied-graph-package.mjs";
import { compileCopiedRubyGraphPackageModel } from "../backends/ruby/copied-graph-package.mjs";
import { compileCopiedPerlGraphPackageModel } from "../backends/perl/copied-graph-package.mjs";
import { compileCopiedDotnetGraphPackageModel } from "../backends/dotnet/copied-graph-package.mjs";
import { compileCopiedJvmGraphPackageModel } from "../backends/jvm/copied-graph-package.mjs";
import { compileCopiedPhpGraphPackageModel } from "../backends/php/copied-graph-package.mjs";
import { compileCopiedWitGraphPackageModel } from "../backends/wit/copied-graph-package.mjs";
import { compileCallableGraphPackageModel } from "../backends/c/callable-graph-model.mjs";
import { compileCallablePythonGraphPackageModel } from "../backends/python/callable-graph-model.mjs";
import { compileCallableRustGraphPackageModel } from "../backends/rust/callable-graph-model.mjs";

/**
 * Validate all requested graph hosts without inventing an extra public C target.
 *
 * @param ir - Compiler-checked copied graph contract.
 * @param targets - Explicit native package targets.
 * @param moduleName - Explicit namespace when selecting CPAN.
 */
export const compileNativeGraphProjection = (ir, targets, moduleName) => {
	if(ir.types.some(type => type.kind === "callback"))
	{
		if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["c", "cpp", "pypi", "cargo"].includes(target)))
			throw Object.assign(new TypeError("Recursive callable packages currently require C, C++, PyPI or Cargo projections"), { code: "native-graph-projection-unavailable" });
		const cTargets = targets.filter(target => ["c", "cpp"].includes(target));
		const c = cTargets.length ? compileCallableGraphPackageModel(ir, cTargets) : null;
		const python = targets.includes("pypi") ? compileCallablePythonGraphPackageModel(ir) : null;
		const rust = targets.includes("cargo") ? compileCallableRustGraphPackageModel(ir) : null;
		const selected = c ?? python ?? rust;
		for(const projection of [c, python, rust].filter(Boolean))
			if(projection.layoutSha256 !== selected.layoutSha256)
				throw new TypeError("Native callable graph layouts differ across selected targets");
		return selected;
	}
	if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["c", "cpp", "cargo", "pypi", "rubygems", "cpan", "nuget", "maven", "php-native", "wit-wasi"].includes(target)))
		throw Object.assign(new TypeError("Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems, CPAN, NuGet, Maven, native PHP or WIT/WASI target adapters"), { code: "native-graph-projection-unavailable" });
	if(targets.includes("cpan") && moduleName === undefined)
		throw Object.assign(new TypeError("CPAN copied graph projection requires its checked module namespace"), { code: "native-graph-projection-unavailable" });
	const cTargets = targets.filter(target => ["c", "cpp"].includes(target));
	const c = cTargets.length ? compileCopiedGraphPackageModel(ir, cTargets) : null;
	const rust = targets.includes("cargo") ? compileCopiedRustGraphPackageModel(ir) : null;
	const python = targets.includes("pypi") ? compileCopiedPythonGraphPackageModel(ir) : null;
	const ruby = targets.includes("rubygems") ? compileCopiedRubyGraphPackageModel(ir) : null;
	const perl = targets.includes("cpan") ? compileCopiedPerlGraphPackageModel(ir, moduleName) : null;
	const dotnet = targets.includes("nuget") ? compileCopiedDotnetGraphPackageModel(ir) : null;
	const jvm = targets.includes("maven") ? compileCopiedJvmGraphPackageModel(ir) : null;
	const php = targets.includes("php-native") ? compileCopiedPhpGraphPackageModel(ir) : null;
	const wit = targets.includes("wit-wasi") ? compileCopiedWitGraphPackageModel(ir) : null;
	return c ?? rust ?? python ?? ruby ?? perl ?? dotnet ?? jvm ?? php ?? wit;
};
