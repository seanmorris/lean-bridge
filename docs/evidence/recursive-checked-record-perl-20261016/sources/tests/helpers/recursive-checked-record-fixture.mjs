/**
 * Independent recursive checked-record package contract and constructor choices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const recursiveCheckedRecordFixtureRoot
	= "tests/fixtures/onboarding/recursive-checked-records";
export const recursiveCheckedRecordModule = "RecursiveCheckedRecords";
const qualified = name => `${recursiveCheckedRecordModule}.${name}`;
const nat = { kind: "primitive", name: "nat" };
const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const documentation = { summary: "Independent recursive checked-record contract.", details: "" };
const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
const field = (name, refinement) => ({ name, refinement });
const subtype = constructor => ({ kind: "subtype"
	, constructor: constructor === null ? null : qualified(constructor) });
const fin = { kind: "fin", bound: "3" };
const checked = (constructor, valueConstructor) => ({
	kind: "checked-record", name: qualified("Packet")
	, constructor: constructor === null ? null : qualified(constructor)
	, fields: [
		field("value", subtype(valueConstructor))
		, field("digit", structuredClone(fin))
		, field("tail", null)]
});
const packet = named("Packet"), packetAlias = named("PacketAlias");
const groups = apply("array", apply("option", packetAlias));
const groupTree = (constructor, valueConstructor) => ({
	kind: "array"
	, arguments: [{
		kind: "option", arguments: [checked(constructor, valueConstructor)]
	}]
});
const signatures = [
	["first", [packet], nat, [checked("mkPacket", "plusOne")], null]
	, ["second", [packet], nat, [checked("normalizePacket", "plusTwo")], null]
	, ["echo", [packet], packet, [checked("mkPacket", "plusOne")], checked(null, null)]
	, ["groups", [groups], nat, [groupTree("mkPacket", "plusOne")], null]
	, ["echoGroups", [groups], groups, [groupTree("normalizePacket", "plusTwo")]
		, groupTree(null, null)]
	, ["produce", [nat], packet, [null], checked(null, null)]
];

const definition = (name, kind, values) => ({
	id: `lean:${qualified(name)}`, name, kind, representation: "copied"
	, mutability: "immutable", typeParameters: []
	, fields: [], cases: [], target: null
	, resource: null, callable: null, host: null
	, documentation
	, source: { producer: "corpusReview", declaration: qualified(name), extensions: {} }
	, assurance: []
	, ...(kind === "record" ? { fields: values }
		: kind === "alias" ? { target: values } : {})
});

/** Build the independent finite recursive graph and per-site refinements. */
export const recursiveCheckedRecordReview = () => {
	const document = corpusReviewedIr({ id: "recursivecheckedrecords" }, signatures.map(([name, parameters]) => ({
		name: qualified(name)
		, parameters: parameters.map(() => "unit")
		, result: "unit"
	})));
	const packetDefinition = definition("Packet", "record", [
		member("value", nat), member("digit", nat)
		, member("tail", apply("option", packet))
	]);
	packetDefinition.source.extensions["lean-lang.org/erased-proofs"] = { fields: ["linked"] };
	packetDefinition.source.extensions["lean-lang.org/nominal-refinements"] = {
		kind: "record", fields: [null, structuredClone(fin), null]
	};
	document.types = [packetDefinition, definition("PacketAlias", "alias", packet)]
		.sort((left, right) => left.id.localeCompare(right.id));
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, parameterTypes, resultType, parameters, result] = signatures[index];
		declaration.parameters.forEach((parameter, offset) => {
			parameter.type = structuredClone(parameterTypes[offset]);
		});
		declaration.result.type = structuredClone(resultType);
		declaration.source.extensions["lean-lang.org/refinements"]
			= structuredClone({ parameters, result });
	}
	return document;
};

const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null
		? null : { constructor: refinement.constructor };
	if(refinement.kind === "checked-record")
	{
		if(refinement.constructor === null) return null;
		return { kind: "checked-record", name: refinement.name
			, constructor: refinement.constructor
			, fields: refinement.fields.map(item => field(item.name, choice(item.refinement))) };
	}
	const arguments_ = refinement.arguments.map(choice);
	return arguments_.some(Boolean) ? { kind: refinement.kind, arguments: arguments_ } : null;
};
const site = refinement => ({ ownership: "copy", lifetime: null
	, ...choice(refinement) ? { refinement: choice(refinement) } : {} });

/**
 * Select the ordinary contract or an independently reviewed Binding IR.
 *
 * @param route - Ordinary author configuration or reviewed Binding IR route.
 */
export const recursiveCheckedRecordConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const targets = { "php-wasm": {
		npm: { name: "lean-bridge-recursive-checked-records-wasm", version: "1.0.0" }
		, composer: { name: "lean-bridge-recursive-checked-records/wasm", version: "1.0.0" }
	} };
	const base = { schemaVersion: 1, modules: [recursiveCheckedRecordModule], targets };
	if(route === "reviewed") return base;
	const contracts = Object.fromEntries(signatures.filter(([, , , parameters, result]) =>
		parameters.some(choice) || choice(result)).map(([name, , , parameters, result]) => [
		qualified(name), { parameters: parameters.map(site), result: site(result) }])
	);
	return { ...base, exports: signatures.map(([name]) => qualified(name)), contracts };
};

export const recursiveCheckedRecordRefinements = Object.freeze(Object.fromEntries(
	signatures.map(([name, , , parameters, result]) => [
		qualified(name), structuredClone({ parameters, result })
	])
));
