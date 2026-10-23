/**
 * Synthetic compiler metadata for nominal adapter unit tests, not source evidence.
 *
 * @file
 */
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";
import { nominalSubtypeConversionFixture } from "./nominal-subtype-conversion-fixture.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const typed = (type, refinement) => {
	if(["fin", "subtype"].includes(refinement?.kind))
	{
		const base = typed(type, null);
		return { kind: "refinement", base
			, predicate: refinement.kind === "subtype" ? { ...refinement } : refinement
			, abi: base.abi };
	}
	if(type.kind === "primitive") return { kind: type.kind, name: type.name, lean: type.lean, abi: { ...heap, heap: false } };
	if(["array", "list", "option"].includes(type.kind)) return { kind: type.kind, element: typed(type.element, refinement?.arguments[0] ?? null), abi: heap };
	if(["tuple", "result"].includes(type.kind)) return { kind: type.kind, arguments: type.arguments.map((child, index) => typed(child, refinement?.arguments[index] ?? null)), abi: heap };
	if(type.kind === "record") return { kind: type.kind
		, name: type.lean, lean: type.lean
		, constructor: type.constructor
		, fields: type.fields.map((field, index) => ({ ...field, type: typed(field.type, refinement?.arguments[index] ?? null) }))
		, abi: heap };
	return { kind: type.kind, name: type.lean, lean: type.lean
		, cases: type.cases.map((branch, index) => ({ ...branch, fields: branch.fields.map((field, position) => ({ ...field, type: typed(field.type, refinement?.cases[index].arguments[position] ?? null) })) }))
		, abi: heap };
};

/** Give each exported use independent compiler-shaped facts and an authenticated synthetic request. */
export const nominalSubtypeNativeFixture = () => {
	const input = nativeMetadataFixture(), template = input.metadata.modules[0].declarations[0];
	input.metadata.modules[0].declarations = nominalSubtypeConversionFixture().exports.map(item => {
		const name = `Sample.${item.name.split(".").at(-1)}`;
		return { ...structuredClone(template), identity: name
			, parameters: item.parameters.map((parameter, index) => ({ name: `arg${index}`, binderInfo: "explicit", typeExpression: parameter.type.lean ?? "Nat" }))
			, projection: { status: "supported", bindingShape: "native-function"
				, parameters: item.parameters.map((parameter, index) => ({ name: parameter.name, type: typed(parameter.type, item.refinements.parameters[index]) }))
				, result: typed(item.result, item.refinements.result) } };
	}).sort((left, right) => left.identity.localeCompare(right.identity));
	const { metadata: context, ...selection } = input.sourceIdentity.request;
	input.sourceIdentity.request = createMetadataRequest({ ...selection, exports: input.metadata.modules[0].declarations.map(item => item.identity) }, {
		toolchain: context.toolchain, modules: context.modules
		, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256
		, extractorSha256: input.sourceIdentity.extractorSha256
	});
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	return { ...input, component: { id: "nominal-subtypes@1.0.0", name: "nominal-subtypes", version: "1.0.0" } };
};
