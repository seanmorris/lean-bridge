/**
 * Independent signatures and consumer for aliases occurring only in callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { witVariantConsumer } from "./wit-variant-fixture.mjs";

export const witNestedAliasExports = ["Structured.callNestedAlias", "Structured.makeNestedAlias", "Structured.callNestedPlain", "Structured.makeNestedPlain"];

/** Describe both exports independently of the Lean compiler's metadata. */
export const witNestedAliasReviewedIr = () => {
	const ir = structuredCallableReviewedIr();
	const call = structuredClone(ir.declarations.find(fn => fn.name === "afterFailure"));
	const make = structuredClone(ir.declarations.find(fn => fn.name === "makeAlias"));
	const callback = structuredClone(ir.types.find(type => type.id === call.parameters[1].type.id));
	const nested = { kind: "apply", constructor: "array", arguments: [{ kind: "apply", constructor: "option", arguments: [{ kind: "named", id: "lean:Structured.Alias" }] }] };
	callback.name = `Callback${sha256(canonicalJson({ parameters: [nested], result: nested })).slice(0, 20)}`;
	callback.id = `bridge:${callback.name}`; callback.source.declaration = callback.name;
	callback.callable.parameters[0].type = nested; callback.callable.result.type = nested;
	call.parameters[1].type = { kind: "named", id: callback.id };
	make.result.type = { kind: "named", id: callback.id };
	const plain = structuredClone(callback);
	const plainNested = { kind: "apply", constructor: "array", arguments: [{ kind: "apply", constructor: "option", arguments: [{ kind: "named", id: "lean:Structured.Payload" }] }] };
	plain.callable.parameters[0].type = plainNested; plain.callable.result.type = plainNested;
	plain.name = `Callback${sha256(canonicalJson({ parameters: [plainNested], result: plainNested })).slice(0, 20)}`;
	plain.id = `bridge:${plain.name}`; plain.source.declaration = plain.name;
	const plainCall = structuredClone(call), plainMake = structuredClone(make);
	plainCall.parameters[1].type = { kind: "named", id: plain.id };
	plainMake.parameters[0].type = { kind: "named", id: "lean:Structured.Payload" };
	plainMake.result.type = { kind: "named", id: plain.id };
	ir.types = ir.types.filter(type => ["Payload", "Alias"].includes(type.name)).concat(callback, plain);
	ir.declarations = [call, make, plainCall, plainMake].map((fn, index) => {
		const name = witNestedAliasExports[index];
		return { ...fn, id: `lean:${name}`
			, name: name.split(".").at(-1), overloadKey: name
			, source: { ...fn.source, declaration: name } };
	});
	return ir;
};

/**
 * Bind the generated resource name without deriving values or expected results.
 *
 * @param model - WIT model for the two callback-only alias exports.
 */
export const witNestedAliasConsumer = async model => {
	assert.equal(model.resources.length, 2);
	const previous = await witVariantConsumer();
	const start = previous.indexOf("static void ok("), end = previous.indexOf("static bool named(");
	assert.ok(start > 0 && end > start);
	const bindings = ["Alias", "Plain"].map(suffix => {
		const fn = action => model.surface.functions.find(fn => fn.declaration.name === `${action}Nested${suffix}`);
		const callback = model.resources.find(resource => resource.type.id === fn("call").declaration.parameters[1].type.id);
		return `  {${[callback.witName, "invoke-" + callback.witName, fn("call").witName, fn("make").witName].map(JSON.stringify).join(", ")}}`;
	});
	return (await readFile("tests/fixtures/structured-callable-consumers/wit-aliases.c", "utf8"))
		.replace("/* COPIED_ORACLES */", previous.slice(start, end).replaceAll("static value ", "static inline value "))
		.replace("/* CALLBACK_NAMES */", bindings.join(",\n"));
};
