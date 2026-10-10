/**
 * The checked-record C-family rollout: exact host projections and source-only inputs.
 * Installed support is established separately by real package consumers.
 *
 * @file
 */
import { generatePythonBindingPackage } from "../../src/backends/python/generate.mjs";
import { generateRustBindingPackage } from "../../src/backends/rust/generate.mjs";
import { generateRubyBindingPackage } from "../../src/backends/ruby/generate.mjs";
import { generateDotnetBindingPackage } from "../../src/backends/dotnet/generate.mjs";
import { generateJvmBindingPackage } from "../../src/backends/jvm/generate.mjs";
import { generatePhpBindingPackage } from "../../src/backends/php/generate.mjs";
import { compileCopiedPythonModel } from "../../src/backends/python/copied-model.mjs";
import { compileCopiedRustModel } from "../../src/backends/rust/copied-model.mjs";
import { compileCopiedRubyModel } from "../../src/backends/ruby/copied-model.mjs";
import { compileCopiedDotnetModel } from "../../src/backends/dotnet/copied-model.mjs";
import { compileCopiedJvmModel } from "../../src/backends/jvm/copied-model.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../../src/backends/wit/copied-host.mjs";
import { witFinReadme } from "../../src/backends/wit/fin-refinements.mjs";
import { checkedRecordReview, refinementsKey } from "./checked-record-fixture.mjs";

export const checkedRecordNativeProfiles = Object.freeze(["python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
export const checkedRecordNativeModels = Object.freeze({
	python: compileCopiedPythonModel, rust: compileCopiedRustModel
	, ruby: compileCopiedRubyModel, dotnet: compileCopiedDotnetModel
	, java: compileCopiedJvmModel, kotlin: compileCopiedJvmModel
	, "php-native": compileCopiedPhpModel, "wit-wasi": compileCopiedWitModel });
export const checkedRecordNativeGenerators = Object.freeze({
	python: generatePythonBindingPackage, rust: generateRustBindingPackage
	, ruby: generateRubyBindingPackage, dotnet: generateDotnetBindingPackage
	, java: generateJvmBindingPackage, kotlin: generateJvmBindingPackage
	, "php-native": generatePhpBindingPackage
	, "wit-wasi": ir => {
		const projection = compileCopiedWitModel(ir);
		return { "api.wit": projection.wit, "api.wat": projection.wat
			, "api.h": renderWitHostHeader(projection)
			// This source-only test does not claim an executable component binary.
			, "api.c": renderWitHostSource(projection, Buffer.from([0, 97, 115, 109]))
			, "README.md": witFinReadme(projection) };
	}
});

/**
 * Mirror ordinary parameter names or retain independently reviewed names.
 * This is a generation input, not evidence of fresh Lean or installed execution.
 *
 * @param route - Ordinary-source or reviewed-ir selection.
 * @param resultOnly - A package without any checked input.
 */
export const checkedRecordNativeInput = (route, resultOnly = false) => {
	if(!["ordinary-source", "reviewed-ir"].includes(route)) throw new TypeError("Unknown checked-record source route");
	const ir = checkedRecordReview();
	if(route === "ordinary-source") for(const declaration of ir.declarations)
		declaration.parameters.forEach((site, index) => { site.name = `arg${index}`; });
	if(resultOnly)
	{
		ir.declarations = ir.declarations.filter(item => item.name === "repeated");
		ir.types = ir.types.filter(item => item.name === "Triple");
		if(ir.declarations.some(item => item.source.extensions[refinementsKey] !== undefined))
			throw new Error("Result-only input must carry no checked parameter");
	}
	return ir;
};
