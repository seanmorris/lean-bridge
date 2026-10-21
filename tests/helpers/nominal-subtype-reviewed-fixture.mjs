/**
 * Independently authored nominal API shape and bounds, never copied from compiler metadata.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { nominalSelectionContracts, nominalSelectionSpecializations, selectedEnvelope, selectedEvent, selectedGenericNat } from "./nominal-subtype-selection-fixture.mjs";

const envelope = { record: "NominalConversion.Envelope", fields: { payload: "nat", digit: "nat" } };
const pair = { record: "NominalConversion.Pair", fields: { left: envelope, right: envelope } };
const event = { record: "NominalConversion.Event", fields: {} };
const alias = { record: "NominalSelection.EnvelopeAlias", fields: {} };
const group = { array: { option: alias } };
const aliasPair = { record: "NominalSelection.AliasPair", fields: { left: group, right: group } };
const genericNat = { record: "NominalSelection.GenericNat", fields: { value: "nat", marker: "nat" } };
const nat = { kind: "primitive", name: "nat" };
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const documentation = { summary: "Independent nominal review.", details: "" };
const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
const fin = { kind: "fin", bound: "3" };
const predicate = (selection, produced = false) => {
	if(selection === null || selection === undefined) return null;
	if(Object.hasOwn(selection, "constructor")) return { kind: "subtype", constructor: produced ? null : selection.constructor };
	const fields = members => members.map(member => ({ name: member.name, refinement: member.name === "digit" ? { ...fin } : predicate(member.refinement, produced) }));
	if(selection.kind === "record") return { ...selection, fields: fields(selection.fields) };
	if(selection.kind === "variant") return { ...selection, cases: selection.cases.map(branch => ({ name: branch.name, fields: fields(branch.fields) })) };
	return { kind: selection.kind, arguments: selection.arguments.map(value => predicate(value, produced)) };
};
const producedResults = {
	"NominalConversion.echo": selectedEnvelope("plusOne")
	, "NominalConversion.produce": selectedEnvelope("plusOne")
	, "NominalConversion.produceEvent": selectedEvent("plusOne", "plusTwo")
	, "NominalSelection.echoGenericFirst": selectedGenericNat("plusOne")
	, "NominalSelection.echoGenericSecond": selectedGenericNat("plusTwo")
};

/** Author the complete twelve-export review without reading or lowering a Lean report. */
export const nominalSubtypeReviewedFixture = () => {
	const signatures = [
		["NominalConversion.first", [envelope], "nat"]
		, ["NominalConversion.second", [envelope], "nat"]
		, ["NominalConversion.combine", [envelope, envelope], "nat"]
		, ["NominalConversion.nested", [pair], "nat"]
		, ["NominalConversion.eventFirst", [event], "nat"]
		, ["NominalConversion.eventSecond", [event], "nat"]
		, ["NominalConversion.echo", [envelope], envelope]
		, ["NominalConversion.produce", ["nat"], envelope]
		, ["NominalConversion.produceEvent", ["nat"], event]
		, ["NominalSelection.aliases", [group, group], "nat"]
		, ["NominalSelection.inspectAliasPair", [aliasPair], "nat"]
		, ["NominalSelection.genericUse", [genericNat], "nat"]
		, ["NominalSelection.echoGenericFirst", [genericNat], genericNat]
		, ["NominalSelection.echoGenericSecond", [genericNat], genericNat]
		, ["NominalSelection.plainFin", ["nat"], "nat"]
	].map(([name, parameters, result]) => ({ name, parameters, result }));
	const document = corpusReviewedIr({ id: "nominal-subtypes" }, signatures);
	const variant = document.types.find(type => type.id === "lean:NominalConversion.Event");
	variant.kind = "variant";
	variant.cases = [
		{ name: "empty", fields: [], documentation }
		, { name: "box", fields: [field("value", { kind: "named", id: "lean:NominalConversion.Envelope" })], documentation }
		, { name: "choices", fields: [field("values", apply("array", apply("option", apply("result", nat, nat))))], documentation }
	];
	const definition = document.types.find(type => type.id === "lean:NominalSelection.EnvelopeAlias");
	definition.kind = "alias"; definition.target = { kind: "named", id: "lean:NominalConversion.Envelope" };
	const generic = document.types.find(type =>
		type.id === "lean:NominalSelection.GenericNat");
	generic.source.extensions["lean-lang.org/instantiation"] = {
		structure: "NominalSelection.GenericCarrier"
		, arguments: [structuredClone(nat)]
	};
	document.types.find(type => type.id === "lean:NominalConversion.Envelope").source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [null, { ...fin }] };
	const selections = nominalSelectionContracts();
	const specializations = new Map(nominalSelectionSpecializations().map(value => [value.name, value]));
	for(const item of document.declarations)
	{
		const publicName = item.source.declaration;
		const specialization = specializations.get(publicName);
		const contract = selections[publicName];
		item.source.extensions["lean-lang.org/refinements"] = {
			parameters: contract.parameters.map(site => predicate(site.refinement))
			// The review records the result's proof-erased shape, but never invents
			// an output-side constructor invocation.
			, result: predicate(producedResults[publicName], true)
		};
		if(publicName === "NominalSelection.plainFin") item.source.extensions["lean-lang.org/refinements"].parameters[0] = { ...fin };
		if(specialization)
		{
			item.source.declaration = specialization.declaration;
			item.source.extensions["lean-lang.org/specialization"] = { ...specialization
				, application: `(@_root_.${specialization.declaration}.{0} (@_root_.${specialization.types[0]}))` };
		}
	}
	return document;
};

/**
 * Bind an authored review to its exact text and semantic identity.
 *
 * @param document - Independently authored review, optionally mutated by a negative test.
 */
export const nominalSubtypeReviewInput = (document = nominalSubtypeReviewedFixture()) => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
