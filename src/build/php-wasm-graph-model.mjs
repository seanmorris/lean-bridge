/**
 * Compiler-authenticated recursive carriers for the fixed 32-bit PHP-Wasm target.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { createElaboratedSemanticModel } from "../analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../analyze/reviewed-source.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { componentRecordDefinitions } from "../abi/component-records.mjs";
import { assertComponentRecursiveBindings, componentRecursiveAbi, componentRecursiveDispatch } from "../abi/component-recursive-abi.mjs";
import { componentRecursiveHelper, componentRecursiveLeanSource, componentRecursiveTypes } from "./component-recursive-lean.mjs";
import { createPhpWasmCopiedModel, generateNativeLeanAdapters } from "./native-model.mjs";
import { createNativeCallableGraphDescriptor, nativeCallableGraphCarrierAbi, nativeCallableGraphHeader } from "./native-callable-graph.mjs";
import { componentStructuredCopiedView, componentStructuredCallableLeanSource } from "./component-structured-callable-lean.mjs";

const primitives = {
	unit: "Unit", bool: "Bool", uint8: "UInt8", uint16: "UInt16"
	, uint32: "UInt32", uint64: "UInt64", int8: "Int8", int16: "Int16"
	, int32: "Int32", int64: "Int64", nat: "Nat", int: "Int"
	, float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray"
	, char: "Char", usize: "USize", isize: "ISize"
};
const leanType = type => {
	if(type.kind === "primitive") return `_root_.${primitives[type.name]}`;
	if(type.kind === "named") return `_root_.${type.id.slice(5)}`;
	const args = type.arguments.map(leanType);
	if(type.constructor === "result") return `(_root_.Except ${args[1]} ${args[0]})`;
	return `(_root_.${{ array: "Array", list: "List", option: "Option", tuple: "Prod" }[type.constructor]} ${args.join(" ")})`;
};
const containsGraph = value => value && typeof value === "object"
	&& (value.kind === "graph" || Object.values(value).some(containsGraph));

const descriptor = ir => ir.types.some(type => type.kind === "callback")
	? createNativeCallableGraphDescriptor(ir) : ({ schemaVersion: 1
		, types: componentRecordDefinitions(ir, true)
		, exports: ir.declarations.map(item => ({ bindingId: item.id
			, symbol: `lean_bridge_${sha256(`${ir.component.id}\0${item.id}`).slice(0, 24)}`
			, parameters: item.parameters.map(site => site.type)
			, result: item.result.type, resultMode: item.resultMode })) });

/**
 * Adapt the semantic descriptor for the shared total-carrier generators only.
 * The compiled model retains graph types and typed carriers, not a JS wire ABI.
 *
 * @param model - Reconstructed PHP-Wasm copied-graph component model.
 */
export const phpWasmGraphCarrierAbi = model => {
	if(model.profile !== "php-wasm-copied-v1" || model.pointerBits !== 32 || model.byteOrder !== "little"
		|| ![4, 5].includes(model.schemaVersion) || canonicalJson(model.copiedGraph) !== canonicalJson(descriptor(model.bindingIr)))
		throw new TypeError("PHP-Wasm graph carriers differ from the compiled profile or public types");
	if(model.copiedGraph.callbacks)
		return nativeCallableGraphCarrierAbi(model.copiedGraph, model.bindingIr);
	const abi = { version: componentRecursiveAbi
		, dispatch: componentRecursiveDispatch
		, types: model.copiedGraph.types
		, exports: model.copiedGraph.exports };
	assertComponentRecursiveBindings(abi, model.bindingIr);
	return abi;
};

/**
 * Preserve the existing model for non-graph exports. Graph components retain
 * finite compiler metadata and lower every copied export through total carriers.
 * Host-specific package admission is separate from component compilation.
 *
 * @param options - Measured metadata, source identity and component coordinates.
 */
export const createCompiledPhpWasmModel = options => {
	if(options.moduleName !== undefined) throw new TypeError("PHP-Wasm graph compilation does not accept a Perl namespace");
	const { metadata, component, sourceIdentity } = options;
	const elaborated = projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true });
	if(!elaborated.declarations.some(containsGraph)) return createPhpWasmCopiedModel(options);
	const semantic = createElaboratedSemanticModel({ metadata
		, request: sourceIdentity.request
		, component, elaborationSha256: elaborated.sha256 });
	const bindingIr = sourceIdentity.reviewedBindingIr === undefined ? semantic.document
		: reconcileReviewedSource(sourceIdentity.reviewedBindingIr, semantic.document, sourceIdentity);
	const copiedGraph = descriptor(bindingIr), sources = new Map(elaborated.declarations.map(item => [item.name, item]));
	const exports = bindingIr.declarations.map(item => {
		const source = sources.get(item.source.declaration), entry = copiedGraph.exports.find(value => value.bindingId === item.id);
		if(!source) throw new TypeError("PHP-Wasm graph export lacks a compiler-selected source declaration");
		return { ...source, bindingId: item.id, symbol: `${entry.symbol}_lean` };
	});
	const model = { schemaVersion: sourceIdentity.reviewedBindingIr === undefined ? 4 : 5
		, profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
		, component, bindingIr, bindingIrSha256: hashBindingIr(bindingIr)
		, sourceIdentity
		, exports
		, types: [], copiedGraph };
	phpWasmGraphCarrierAbi(model);
	return Object.freeze(model);
};

const carrierHeader = (abi, exportCarriers = true) => {
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const lines = ["#include <lean/lean.h>", "#include <stdint.h>", "LEAN_CASSERT(sizeof(size_t) * 8 == 32);"];
	const declare = (symbol, count = 1, result = "lean_object *") => lines.push(`${result} ${symbol}(${Array(Math.max(1, count)).fill("lean_object *").join(", ")});`);
	for(const type of componentRecursiveTypes(abi).filter(type => type.kind !== "primitive"))
	{
		const symbol = componentRecursiveHelper(abi, type), definition = definitions.get(type.id);
		const fields = (values, make = "make", field = "field") => {
			declare(`${symbol}_${make}`, values.length);
			values.forEach((_, index) => declare(`${symbol}_${field}${index}`));
		};
		if(definition?.kind === "alias") fields([definition.target]);
		else if(definition?.kind === "record") fields(definition.fields);
		else if(definition?.kind === "variant")
		{
			declare(`${symbol}_branch`, 1, "uint32_t");
			definition.cases.forEach((branch, index) => fields(branch.fields, `make${index}`, `case${index}_field`));
		}
		else if(["array", "list"].includes(type.constructor))
		{ declare(`${symbol}_make`); declare(`${symbol}_items`); }
		else if(type.constructor === "tuple") fields(type.arguments);
		else
		{
			declare(`${symbol}_branch`, 1, "uint32_t");
			if(type.constructor === "option") declare(`${symbol}_none`);
			type.arguments.forEach((_, index) => { declare(`${symbol}_make${index}`); declare(`${symbol}_field${index}`); });
		}
	}
	if(exportCarriers) for(const item of abi.exports) declare(`${item.symbol}_lean`, item.parameters.length);
	return `${lines.join("\n")}\n`;
};

/**
 * Emit the selected wasm32 transport and ABI-check all carrier definitions with
 * the actual C compiler. Lean itself checks construction and field projection.
 *
 * @param model - Compiler-authenticated PHP-Wasm model.
 */
export const generateCompiledPhpWasmLeanAdapters = model => {
	if(!model.copiedGraph) return generateNativeLeanAdapters(model);
	const abi = phpWasmGraphCarrierAbi(model), module = `LeanBridgeNative${sha256(model.component.id).slice(0, 16)}`;
	const exports = model.exports.map((item, index) => ({ bindingId: item.bindingId
		, symbol: abi.exports.find(value => value.bindingId === item.bindingId).symbol
		, wrapper: `export${index}`, sourceDeclaration: item.name
		, ...(item.specialization ? { sourceApplication: item.specialization.application } : {}) }));
	const lines = [...new Set(model.exports.map(item => `import ${item.module}`))
		, "set_option maxRecDepth 10000", `namespace ${module}`
		, ...(abi.callbacks ? componentStructuredCallableLeanSource(abi, exports)
			: componentRecursiveLeanSource(abi, exports, leanType))
		, `end ${module}`, ""];
	const header = abi.callbacks
		? carrierHeader(componentStructuredCopiedView(abi), false) + nativeCallableGraphHeader(abi)
		: carrierHeader(abi);
	return { module, leanSource: lines.join("\n"), header };
};
