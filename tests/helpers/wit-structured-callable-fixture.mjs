/**
 * Independent structured Wasmtime values and installed callback/closure checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { witVariantConsumer } from "./wit-variant-fixture.mjs";

export const witStructuredShapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];

/**
 * Compare semantic signatures without depending on compiler-created type IDs.
 *
 * @param ir - Compiled or independently reviewed Binding IR.
 */
export const witStructuredSignatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id); assert.ok(definition, ref.id);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record") return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant") return { variant: definition.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id, parameters: declaration.parameters.map(site), result: site(declaration.result) })).sort((a, b) => a.id.localeCompare(b.id));
};

/**
 * Bind only interface names; values and expected behavior remain independent.
 *
 * @param model - Checked WIT projection.
 */
export const witStructuredConsumer = async model => {
	const previous = await witVariantConsumer();
	const start = previous.indexOf("static void ok("), end = previous.indexOf("static bool named(");
	assert.ok(start > 0 && end > start);
	const oracles = previous.slice(start, end).replaceAll("static value ", "static inline value ");
	const names = witStructuredShapes.map(shape => {
		const fn = action => model.surface.functions.find(fn => fn.field === action + "_" + shape);
		const resource = ref => model.resources.find(resource => resource.type.id === ref.id);
		const callback = resource(fn("call").declaration.parameters[1].type), closure = resource(fn("make").declaration.result.type);
		return `  {${[shape, callback.witName, "invoke-" + callback.witName, "invoke-" + closure.witName].map(JSON.stringify).join(", ")}}`;
	});
	return (await readFile("tests/fixtures/structured-callable-consumers/wit-wasi.c", "utf8"))
		.replace("/* COPIED_ORACLES */", oracles).replace("/* CALLABLE_NAMES */", names.join(",\n"));
};
