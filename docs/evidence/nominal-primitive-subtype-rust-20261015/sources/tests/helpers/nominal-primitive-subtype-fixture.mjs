/**
 * Independently author the nineteen-base nominal API and per-site constructor choices.
 * This fixture does not read compiler metadata, generated bindings or runtime output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const nominalPrimitiveSubtypeFixture = "tests/fixtures/onboarding/nominal-primitive-subtypes";
export const nominalPrimitiveSubtypeModule = "NominalPrimitiveSubtypes";
export const nominalPrimitiveSubtypeName = "nominalprimitivesubtypes";
const qualified = name => `${nominalPrimitiveSubtypeModule}.${name}`;

// Keep the expected catalog explicit rather than deriving it from the compiler.
export const nominalPrimitiveSubtypeFields = Object.freeze([
	{ name: "unitValue", primitive: "unit", constructor: "unit" }
	, { name: "boolValue", primitive: "bool", constructor: "bool" }
	, { name: "uint8Value", primitive: "uint8", constructor: "uint8" }
	, { name: "uint16Value", primitive: "uint16", constructor: "uint16" }
	, { name: "uint32Value", primitive: "uint32", constructor: "uint32" }
	, { name: "uint64Value", primitive: "uint64", constructor: "uint64" }
	, { name: "int8Value", primitive: "int8", constructor: "int8" }
	, { name: "int16Value", primitive: "int16", constructor: "int16" }
	, { name: "int32Value", primitive: "int32", constructor: "int32" }
	, { name: "int64Value", primitive: "int64", constructor: "int64" }
	, { name: "natValue", primitive: "nat", constructor: "nat" }
	, { name: "intValue", primitive: "int", constructor: "int" }
	, { name: "float32Value", primitive: "float32", constructor: "float32" }
	, { name: "float64Value", primitive: "float64", constructor: "float64" }
	, { name: "textValue", primitive: "string", constructor: "text" }
	, { name: "bytesValue", primitive: "bytes", constructor: "bytes" }
	, { name: "charValue", primitive: "char", constructor: "char" }
	, { name: "usizeValue", primitive: "usize", constructor: "usize" }
	, { name: "isizeValue", primitive: "isize", constructor: "isize" }
].map(Object.freeze));

const payload = Object.fromEntries(nominalPrimitiveSubtypeFields.map(field => [field.name, field.primitive]));
const packet = { record: qualified("Packet"), fields: { ...payload, digit: "nat" } };
const rawPacket = { record: qualified("RawPacket"), fields: { ...payload, digit: "nat" } };
const alias = { record: qualified("PacketAlias"), fields: {} };
const group = { array: { option: alias } };
const pair = { record: qualified("Pair"), fields: { left: group, right: group } };
const event = { record: qualified("Event"), fields: {} };
const fin = { kind: "fin", bound: "3" };
const field = (name, refinement) => ({ name, refinement });
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const record = (name, ...members) => ({ kind: "record", name: qualified(name), fields: members });
const packetTree = (selection, refuseUnit = false) => record("Packet"
	, ...nominalPrimitiveSubtypeFields.map(item => field(item.name, {
		kind: "subtype"
		, constructor: selection === null ? null : qualified(item.primitive === "unit" && refuseUnit ? "unitReject" : item.constructor + selection)
	}))
	, field("digit", { ...fin }));
const groupTree = selection => tree("array", tree("option", packetTree(selection)));
const pairTree = (first, second) => record("Pair", field("left", groupTree(first)), field("right", groupTree(second)));
const eventTree = (first, second) => ({
	kind: "variant", name: qualified("Event")
	, cases: [
		{ name: "empty", fields: [] }
		, { name: "box", fields: [field("value", packetTree(first))] }
		, { name: "choices", fields: [field("values", tree("array", tree("option", tree("result", packetTree(first), packetTree(second)))))] }
	]
});

const inputs = [
	["echoA", [packet], packet, [packetTree("A")], packetTree(null)]
	, ["echoB", [packet], packet, [packetTree("B")], packetTree(null)]
	, ["refuseUnit", [packet], packet, [packetTree("A", true)], packetTree(null)]
	, ["combine", [packet, packet], { tuple: [packet, packet] }, [packetTree("A"), packetTree("B")], tree("tuple", packetTree(null), packetTree(null))]
	, ["echoPair", [pair], pair, [pairTree("A", "B")], pairTree(null, null)]
	, ["echoEventA", [event], event, [eventTree("A", "B")], eventTree(null, null)]
	, ["echoEventB", [event], event, [eventTree("B", "A")], eventTree(null, null)]
	, ["aliases", [group, group], group, [groupTree("A"), groupTree("B")], groupTree(null)]
];
const results = [
	["produce", [rawPacket], { option: packet }, [null], tree("option", packetTree(null))]
	, ["produceGroup", [rawPacket], group, [null], groupTree(null)]
	, ["producePair", [rawPacket], pair, [null], pairTree(null, null)]
	, ["produceEvent", [rawPacket], event, [null], eventTree(null, null)]
	, ["produceChoices", [rawPacket], event, [null], eventTree(null, null)]
	, ["wordBits", [], "uint32", [], null]
];
const signatures = resultOnly => [...resultOnly ? [] : inputs, ...results];

/**
 * Author all nominal identities and complete directional refinement trees.
 *
 * @param resultOnly - Select only the six constructor-free result exports.
 */
export const nominalPrimitiveSubtypeReview = (resultOnly = false) => {
	assert.equal(typeof resultOnly, "boolean");
	const selected = signatures(resultOnly);
	const document = corpusReviewedIr({ id: nominalPrimitiveSubtypeName }, selected.map(([name, parameters, result]) => ({ name: qualified(name), parameters, result })));
	const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
	const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
	const documentation = { summary: "Independent nineteen-base nominal contract.", details: "" };
	const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
	const variant = document.types.find(type => type.name === "Event");
	variant.kind = "variant";
	variant.cases = [
		{ name: "empty", fields: [], documentation }
		, { name: "box", fields: [member("value", named("Packet"))], documentation }
		, { name: "choices", fields: [member("values", apply("array", apply("option", apply("result", named("Packet"), named("Packet")))))], documentation }
	];
	const definition = document.types.find(type => type.name === "PacketAlias");
	definition.kind = "alias"; definition.target = named("Packet");
	document.types.find(type => type.name === "Packet").source.extensions["lean-lang.org/nominal-refinements"] = {
		kind: "record"
		, fields: [...nominalPrimitiveSubtypeFields.map(() => null), { ...fin }]
	};
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, , , parameters, result] = selected[index];
		if(result !== null || parameters.some(parameter => parameter !== null))
			declaration.source.extensions["lean-lang.org/refinements"] = structuredClone({ parameters, result });
	}
	return document;
};

// This projection does not call the production reviewed-selection derivation.
// Route agreement is tested independently; bounds and output projection are compiler-owned.
const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null ? null : { constructor: refinement.constructor };
	if(refinement.kind === "record")
	{
		const selected = refinement.fields.map(item => field(item.name, choice(item.refinement)));
		return selected.some(item => item.refinement) ? { ...refinement, fields: selected } : null;
	}
	if(refinement.kind === "variant")
	{
		const cases = refinement.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(item => field(item.name, choice(item.refinement))) }));
		return cases.some(branch => branch.fields.some(item => item.refinement)) ? { ...refinement, cases } : null;
	}
	const arguments_ = refinement.arguments.map(choice);
	return arguments_.some(Boolean) ? tree(refinement.kind, ...arguments_) : null;
};
const site = refinement => ({ ownership: "copy", lifetime: null, ...choice(refinement) ? { refinement: choice(refinement) } : {} });

/**
 * Independently select ordinary constructors or a reviewed package.
 *
 * @param route - Ordinary source or reviewed source.
 * @param profiles - Explicit C, C++ or npm package targets before host-specific retargeting.
 * @param resultOnly - Omit every input constructor choice.
 */
export const nominalPrimitiveSubtypeConfiguration = (route, profiles, resultOnly = false) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.equal(typeof resultOnly, "boolean");
	assert.ok(Array.isArray(profiles) && profiles.length > 0 && profiles.every(profile => ["c", "cpp", "npm"].includes(profile)));
	assert.equal(new Set(profiles).size, profiles.length);
	const targets = Object.fromEntries(profiles.map(profile => [profile, { name: nominalPrimitiveSubtypeName, version: "1.0.0" }]));
	const base = { schemaVersion: 1, modules: [nominalPrimitiveSubtypeModule], targets };
	if(route === "reviewed") return base;
	const selected = signatures(resultOnly);
	const contracts = Object.fromEntries(selected.filter(([, , , parameters, result]) => parameters.some(choice) || choice(result))
		.map(([name, , , parameters, result]) => [qualified(name), { parameters: parameters.map(site), result: site(result) }]));
	return { ...base, exports: selected.map(([name]) => qualified(name)), ...Object.keys(contracts).length ? { contracts } : {} };
};
