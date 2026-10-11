/**
 * Independently authored nominal API shape and bounds, never copied from compiler metadata.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { nominalSelectionContracts } from "./nominal-subtype-selection-fixture.mjs";

const envelope = { record: "NominalConversion.Envelope", fields: { payload: "nat", digit: "nat" } };
const pair = { record: "NominalConversion.Pair", fields: { left: envelope, right: envelope } };
const event = { record: "NominalConversion.Event", fields: {} };
const alias = { record: "NominalSelection.EnvelopeAlias", fields: {} };
const group = { array: { option: alias } };
const aliasPair = { record: "NominalSelection.AliasPair", fields: { left: group, right: group } };
const nat = { kind: "primitive", name: "nat" };
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const documentation = { summary: "Independent nominal review.", details: "" };
const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
const fin = { kind: "fin", bound: "3" };
const predicate = selection => {
	if(selection === null || selection === undefined) return null;
	if(Object.hasOwn(selection, "constructor")) return { kind: "subtype", constructor: selection.constructor };
	const fields = members => members.map(member => ({ name: member.name, refinement: member.name === "digit" ? { ...fin } : predicate(member.refinement) }));
	if(selection.kind === "record") return { ...selection, fields: fields(selection.fields) };
	if(selection.kind === "variant") return { ...selection, cases: selection.cases.map(branch => ({ name: branch.name, fields: fields(branch.fields) })) };
	return { kind: selection.kind, arguments: selection.arguments.map(predicate) };
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
	document.types.find(type => type.id === "lean:NominalConversion.Envelope").source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [null, { ...fin }] };
	const selections = nominalSelectionContracts();
	for(const item of document.declarations)
	{
		const contract = selections[item.source.declaration];
		item.source.extensions["lean-lang.org/refinements"] = { parameters: contract.parameters.map(site => predicate(site.refinement)), result: predicate(contract.result.refinement) };
		if(item.source.declaration === "NominalSelection.plainFin") item.source.extensions["lean-lang.org/refinements"].parameters[0] = { ...fin };
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
