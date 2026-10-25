/**
 * Independent author review for the callback lifetime and recovery fixture.
 * This describes signatures without importing extraction or adapter generation.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";

/** State resource callback inputs and results independently of fresh Lean facts. */
export const ownedHostCallbackReviewedIr = () => {
	const ir = ownedAggregateReviewedIr();
	const callbackTemplate = ir.types.find(type => type.kind === "callback");
	const declarationTemplate = ir.declarations.find(item => item.name === "callbackRecord");
	const plainTemplate = ir.declarations.find(item => item.name === "newTicket");
	const primitive = name => ({ kind: "primitive", name });
	const named = name => ({ kind: "named", id: `lean:Owned.${name}` });
	const source = name => ({ producer: "corpusReview", declaration: name, extensions: {} });
	const site = (type, result = false) => ({ type
		, ownership: type.kind === "primitive" ? "copy" : result ? "lease" : "borrow"
		, lifetime: type.kind === "primitive" ? null : { scope: result ? "explicit" : "call", anchor: null }
	});
	const parameter = (type, index) => ({ name: `argument${index}`
		, ...site(type)
		, mutability: "immutable", optional: false, default: null });
	ir.types = ir.types.filter(type => ["Ticket", "Payload", "Bundle", "Tree"].includes(type.name));
	const callback = (parameters, result) => {
		const name = `Callback${sha256(canonicalJson({ parameters, result })).slice(0, 20)}`;
		const id = `bridge:${name}`;
		ir.types.push({ ...callbackTemplate, id, name, source: source(name)
			, callable: { ...callbackTemplate.callable
				, parameters: parameters.map(parameter), result: site(result, true) } });
		return { kind: "named", id };
	};
	const bundle = named("Bundle"), tree = named("Tree"), ticket = named("Ticket");
	const recordCallback = callback([bundle], bundle), recursive = callback([tree], tree);
	const factory = callback([primitive("unit")], ticket), construct = callback([ticket], bundle);
	const signatures = [
		["callbackRecord", [bundle, recordCallback], bundle]
		, ["callbackRecursive", [tree, recursive], tree]
		, ["twice", [bundle, recordCallback], bundle]
		, ["repeatedly", [bundle, recordCallback, primitive("nat")], bundle]
		, ["retainCallback", [recordCallback], recordCallback]
		, ["factory", [factory], ticket], ["construct", [ticket, construct], bundle]
	];
	ir.declarations = [
		...ir.declarations.filter(item => ["newTicket", "serial", "echoRecord"].includes(item.name))
		, { ...plainTemplate, id: "lean:Owned.identityClosure"
			, name: "identityClosure", overloadKey: "Owned.identityClosure"
			, source: source("Owned.identityClosure")
			, parameters: [parameter(primitive("unit"), 0)]
			, result: site(recordCallback, true)
			, effects: ["allocates"] }
		, ...signatures.map(([name, parameters, result]) => ({ ...declarationTemplate
			, id: `lean:Owned.${name}`, name, overloadKey: `Owned.${name}`
			, source: source(`Owned.${name}`)
			, parameters: parameters.map(parameter), result: site(result, true)
		}))
	];
	return ir;
};
