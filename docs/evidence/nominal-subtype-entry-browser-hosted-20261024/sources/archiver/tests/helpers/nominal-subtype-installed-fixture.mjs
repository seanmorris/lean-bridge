/**
 * Independent nominal Subtype package API, per-use choices and result projection.
 * This author fixture does not read generated compiler metadata.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const nominalSubtypeFixture = "tests/fixtures/onboarding/nominal-subtypes";
export const nominalSubtypeModule = "NominalSubtypes";
export const nominalSubtypeName = "nominalsubtypes";
export const genericSubtypeModule = "NominalSubtypes.GenericCompositions";
export const genericSubtypeSource = "tests/fixtures/generic-subtype-compositions/GenericCompositions.lean";
const qualified = name => `${nominalSubtypeModule}.${name}`;
const genericQualified = name => `${genericSubtypeModule}.${name}`;
const publicName = name => name.includes(".") ? name : qualified(name);
const envelope = { record: qualified("Envelope"), fields: { payload: "nat", digit: "nat" } };
const pair = { record: qualified("Pair"), fields: { left: envelope, right: envelope } };
const alias = { record: qualified("EnvelopeAlias"), fields: {} };
const group = { array: { option: alias } };
const aliasPair = { record: qualified("AliasPair"), fields: { left: group, right: group } };
const event = { record: qualified("Event"), fields: {} };
const genericNat = { record: genericQualified("GenericNat"), fields: { value: "nat", marker: "nat" } };
const sub = constructor => ({ kind: "subtype", constructor: constructor === null ? null : qualified(constructor) });
const fin = { kind: "fin", bound: "3" };
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const field = (name, refinement) => ({ name, refinement });
const record = (name, ...fields) => ({ kind: "record", name: qualified(name), fields });
const envelopeTree = constructor => record("Envelope", field("payload", sub(constructor)), field("digit", fin));
const groupTree = constructor => tree("array", tree("option", envelopeTree(constructor)));
const pairTree = (first, second) => record("AliasPair", field("left", groupTree(first)), field("right", groupTree(second)));
const eventTree = (first, second) => ({
	kind: "variant", name: qualified("Event")
	, cases: [
		{ name: "empty", fields: [] }
		, { name: "box", fields: [field("value", envelopeTree(first))] }
		, { name: "choices", fields: [field("values", tree("array", tree("option", tree("result", sub(first), sub(second)))))] }
	]
});
const genericTree = constructor => ({
	kind: "record"
	, name: genericQualified("GenericNat")
	, fields: [field("value", sub(constructor)), field("marker", null)]
});
const genericSpecializations = Object.freeze(["First", "Second"].map(name => ({
	name: genericQualified(`echoGeneric${name}`)
	, declaration: genericQualified("genericEcho")
	, types: [genericQualified("GenericNat")]
})));

const results = [
	["scalar", "nat", sub(null)]
	, ["produceEnvelope", envelope, envelopeTree(null)]
	, ["arrayValues", { array: "nat" }, tree("array", sub(null))]
	, ["listValues", { list: "nat" }, tree("list", sub(null))]
	, ["optional", { option: "nat" }, tree("option", sub(null))]
	, ["product", { tuple: ["nat", "nat"] }, tree("tuple", sub(null), sub(null))]
	, ["branch", { result: ["nat", "nat"] }, tree("result", sub(null), sub(null))]
	, ["groupValues", group, groupTree(null)]
	, ["pairValues", aliasPair, pairTree(null, null)]
	, ["eventValue", event, eventTree(null, null)]
	, ["eventEmpty", event, eventTree(null, null)]
	, ["eventChoices", event, eventTree(null, null)]
	, ["noItems", { array: "nat" }, tree("array", sub(null))]
].map(([name, result, resultTree]) => [name, ["nat"], result, [null], resultTree]);
const inputs = [
	["first", [envelope], "nat", [envelopeTree("plusOne")], null]
	, ["second", [envelope], "nat", [envelopeTree("plusTwo")], null]
	, ["combine", [envelope, envelope], "nat", [envelopeTree("plusOne"), envelopeTree("plusTwo")], null]
	, ["nested", [pair], "nat", [record("Pair", field("left", envelopeTree("plusOne")), field("right", envelopeTree("plusTwo")))], null]
	, ["eventFirst", [event], "nat", [eventTree("plusOne", "plusTwo")], null]
	, ["eventSecond", [event], "nat", [eventTree("plusTwo", "plusOne")], null]
	, ["echo", [envelope], envelope, [envelopeTree("plusOne")], envelopeTree(null)]
	, ["aliases", [group, group], "nat", [groupTree("plusOne"), groupTree("plusTwo")], null]
	, ["inspectAliasPair", [aliasPair], "nat", [pairTree("plusOne", "plusTwo")], null]
	, ["echoGroups", [group], group, [groupTree("plusOne")], groupTree(null)]
	, ["echoPair", [aliasPair], aliasPair, [pairTree("plusOne", "plusTwo")], pairTree(null, null)]
	, ["echoEvent", [event], event, [eventTree("plusOne", "plusTwo")], eventTree(null, null)]
	, ["plainFin", ["nat"], "nat", [fin], null]
];
const genericInputs = [
	[genericQualified("genericUse"), [genericNat], "nat", [genericTree("plusOne")], null]
	, [genericQualified("echoGenericFirst"), [genericNat], genericNat, [genericTree("plusOne")], genericTree(null)]
	, [genericQualified("echoGenericSecond"), [genericNat], genericNat, [genericTree("plusTwo")], genericTree(null)]
];
const signatures = (resultOnly, genericCompositions = false) => [
	...resultOnly ? [] : inputs
	, ...genericCompositions && !resultOnly ? genericInputs : []
	, ...results
];

/**
 * Author the nominal identities and complete directional refinement trees.
 *
 * @param resultOnly - Select only the thirteen constructor-free result exports.
 * @param options - Optional current generic/Subtype composition lane.
 * @param options.genericCompositions - Include one generic record and two specializations.
 */
export const nominalSubtypeInstalledReview = (resultOnly = false, { genericCompositions = false } = {}) => {
	assert.equal(typeof genericCompositions, "boolean");
	const selected = signatures(resultOnly, genericCompositions);
	const document = corpusReviewedIr({ id: nominalSubtypeName }, selected.map(([name, parameters, result]) => ({ name: publicName(name), parameters, result })));
	const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
	const nat = { kind: "primitive", name: "nat" };
	const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
	const documentation = { summary: "Independent nominal package contract.", details: "" };
	const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
	const variant = document.types.find(type => type.name === "Event");
	variant.kind = "variant";
	variant.cases = [
		{ name: "empty", fields: [], documentation }
		, { name: "box", fields: [member("value", named("Envelope"))], documentation }
		, { name: "choices", fields: [member("values", apply("array", apply("option", apply("result", nat, nat))))], documentation }
	];
	const definition = document.types.find(type => type.name === "EnvelopeAlias");
	definition.kind = "alias"; definition.target = named("Envelope");
	if(genericCompositions && !resultOnly)
	{
		const generic = document.types.find(type => type.id === `lean:${genericQualified("GenericNat")}`);
		generic.source.extensions["lean-lang.org/instantiation"] = {
			structure: genericQualified("GenericCarrier")
			, arguments: [structuredClone(nat)]
		};
	}
	document.types.find(type => type.name === "Envelope").source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [null, structuredClone(fin)] };
	const specializations = new Map(genericSpecializations.map(item => [item.name, item]));
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, , , parameters, result] = selected[index];
		declaration.source.extensions["lean-lang.org/refinements"] = structuredClone({ parameters, result });
		const specialization = specializations.get(declaration.source.declaration);
		if(specialization)
		{
			declaration.source.declaration = specialization.declaration;
			declaration.source.extensions["lean-lang.org/specialization"] = { ...specialization
				, application: `(@_root_.${specialization.declaration}.{0} (@_root_.${specialization.types[0]}))` };
		}
	}
	return document;
};

// Ordinary choices come from this hand-authored fixture, not the production
// reviewed-contract derivation. Fin bounds and output projection are compiler-owned.
const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null ? null : { constructor: refinement.constructor };
	if(refinement.kind === "record")
	{
		const fields = refinement.fields.map(member => field(member.name, choice(member.refinement)));
		return fields.some(member => member.refinement) ? { kind: "record", name: refinement.name, fields } : null;
	}
	if(refinement.kind === "variant")
	{
		const cases = refinement.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(member => field(member.name, choice(member.refinement))) }));
		return cases.some(branch => branch.fields.some(member => member.refinement)) ? { kind: "variant", name: refinement.name, cases } : null;
	}
	const arguments_ = refinement.arguments.map(choice);
	return arguments_.some(Boolean) ? tree(refinement.kind, ...arguments_) : null;
};
const site = refinement => ({ ownership: "copy", lifetime: null, ...choice(refinement) ? { refinement: choice(refinement) } : {} });

/**
 * Independently select ordinary contracts or a reviewed package.
 *
 * @param route - Ordinary source or reviewed source.
 * @param profiles - Explicit package targets.
 * @param resultOnly - Omit every input constructor choice.
 * @param options - Optional current generic/Subtype composition lane.
 * @param options.genericCompositions - Include one generic record and two specializations.
 */
export const nominalSubtypeInstalledConfiguration = (route, profiles, resultOnly = false, { genericCompositions = false } = {}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(profiles.length && profiles.every(profile => ["c", "cpp", "npm"].includes(profile)));
	assert.equal(new Set(profiles).size, profiles.length);
	assert.equal(typeof genericCompositions, "boolean");
	const targets = Object.fromEntries(profiles.map(profile => [profile, { name: nominalSubtypeName, version: "1.0.0" }]));
	const generic = genericCompositions && !resultOnly;
	const base = { schemaVersion: 1, modules: [nominalSubtypeModule, ...generic ? [genericSubtypeModule] : []], targets };
	if(route === "reviewed") return base;
	const selected = signatures(resultOnly, genericCompositions);
	const contracts = Object.fromEntries(selected.filter(([, , , parameters, result]) => parameters.some(choice) || choice(result))
		.map(([name, , , parameters, result]) => [publicName(name), { parameters: parameters.map(site), result: site(result) }]));
	return { ...base
		, exports: selected.map(([name]) => publicName(name))
		, ...generic ? { specializations: genericSpecializations.map(item => structuredClone(item)) } : {}
		, ...Object.keys(contracts).length ? { contracts } : {} };
};
