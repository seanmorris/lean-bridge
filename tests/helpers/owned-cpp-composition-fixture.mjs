/**
 * Independent author review for installed C++ owned-value compositions.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";
import { ownedHostCallbackReviewedIr } from "./owned-host-callback-fixture.mjs";

/** State boxed recursion, compound values and higher-order signatures independently. */
export const ownedCppCompositionReviewedIr = () => {
	const ir = ownedAggregateReviewedIr(), callbacks = ownedHostCallbackReviewedIr();
	for(const type of callbacks.types) if(!ir.types.some(item => item.id === type.id)) ir.types.push(type);
	for(const declaration of callbacks.declarations) if(!ir.declarations.some(item => item.id === declaration.id)) ir.declarations.push(declaration);
	const primitive = name => ({ kind: "primitive", name });
	const named = name => ({ kind: "named", id: `lean:Owned.${name}` });
	const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
	const source = declaration => ({ producer: "corpusReview", declaration, extensions: {} });
	const bundle = ir.types.find(item => item.name === "Bundle"), tree = ir.types.find(item => item.name === "Tree");
	const field = (name, type) => ({ ...bundle.fields[0], name, type });
	ir.types.push({ ...tree, id: "lean:Owned.Chain", name: "Chain"
		, source: source("Owned.Chain")
		, cases: [
			{ ...tree.cases[0], name: "stop", fields: [] }
			, { ...tree.cases[1], name: "link", fields: [field("ticket", named("Ticket")), field("next", apply("option", named("Chain")))] }
		]
	});
	ir.types.push({ ...bundle, id: "lean:Owned.Mixed", name: "Mixed"
		, source: source("Owned.Mixed")
		, fields: [
			field("ticket", named("Ticket"))
			, field("markers", apply("array", apply("option", apply("option", primitive("bool")))))
			, field("unit", apply("option", primitive("unit")))
			, field("result", apply("result", named("Bundle"), named("Ticket")))
			, field("signed", primitive("int")), field("unsigned", primitive("nat"))
			, field("scalar", primitive("char")), field("precise", primitive("float64"))
			, field("approximate", primitive("float32"))
			, field("bytes", primitive("bytes"))
			, field("words", apply("list", primitive("uint64")))
			, field("product", apply("tuple", named("Ticket"), apply("tuple", apply("option", named("Ticket")), named("Payload"))))
			, field("chain", named("Chain"))
		]
	});
	const echo = ir.declarations.find(item => item.name === "echoRecord");
	for(const [name, type] of [["echoChain", "Chain"], ["echoMixed", "Mixed"]]) ir.declarations.push({ ...echo
		, id: `lean:Owned.${name}`, name, overloadKey: `Owned.${name}`
		, source: source(`Owned.${name}`)
		, parameters: [{ ...echo.parameters[0], type: named(type) }]
		, result: { ...echo.result, type: named(type) } });
	const callback = ir.declarations.find(item => item.name === "callbackRecord").parameters[1];
	const parameters = [callback.type], result = named("Bundle");
	const name = `Callback${sha256(canonicalJson({ parameters, result })).slice(0, 20)}`;
	const template = ir.types.find(item => item.id === callback.type.id), id = `bridge:${name}`;
	ir.types.push({ ...template, id, name, source: source(name)
		, callable: { ...template.callable, parameters: [{ ...callback, name: "arg0" }] } });
	const factory = ir.declarations.find(item => item.name === "makeRecord");
	ir.declarations.push({ ...factory, id: "lean:Owned.dispatch", name: "dispatch"
		, overloadKey: "Owned.dispatch", source: source("Owned.dispatch")
		, result: { ...factory.result, type: { kind: "named", id } } });
	return ir;
};
