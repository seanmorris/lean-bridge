/**
 * Independent result-only API and predicate trees, not derived from a compiler report.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const envelope = { record: "NominalResults.Envelope", fields: { payload: "nat", digit: "nat" } };
const alias = { record: "NominalResults.EnvelopeAlias", fields: {} };
const group = { array: { option: alias } };
const pair = { record: "NominalResults.Pair", fields: { left: group, right: group } };
const event = { record: "NominalResults.Event", fields: {} };
const sub = { kind: "subtype", constructor: null }, fin = { kind: "fin", bound: "3" };
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const field = (name, refinement) => ({ name, refinement });
const record = (name, ...fields) => ({ kind: "record", name: `NominalResults.${name}`, fields });
const envelopeTree = record("Envelope", field("payload", sub), field("digit", fin));
const groupTree = tree("array", tree("option", envelopeTree));
const pairTree = record("Pair", field("left", groupTree), field("right", groupTree));
const eventTree = {
	kind: "variant", name: "NominalResults.Event"
	, cases: [
		{ name: "empty", fields: [] }
		, { name: "box", fields: [field("value", envelopeTree)] }
		, { name: "choices", fields: [field("values", tree("array", tree("option", tree("result", sub, sub))))] }
	]
};

/** Author all thirteen exported results, their nominal identities and Fin bounds. */
export const subtypeResultReviewedFixture = () => {
	const signatures = [
		["scalar", "nat", sub]
		, ["produceEnvelope", envelope, envelopeTree]
		, ["arrayValues", { array: "nat" }, tree("array", sub)]
		, ["listValues", { list: "nat" }, tree("list", sub)]
		, ["optional", { option: "nat" }, tree("option", sub)]
		, ["product", { tuple: ["nat", "nat"] }, tree("tuple", sub, sub)]
		, ["branch", { result: ["nat", "nat"] }, tree("result", sub, sub)]
		, ["groupValues", group, groupTree]
		, ["pairValues", pair, pairTree]
		, ["eventValue", event, eventTree]
		, ["eventEmpty", event, eventTree]
		, ["eventChoices", event, eventTree]
		, ["noItems", { array: "nat" }, tree("array", sub)]
	];
	const document = corpusReviewedIr({ id: "subtype-results" }, signatures.map(([name, result]) => ({ name: `NominalResults.${name}`, parameters: ["nat"], result })));
	const named = name => ({ kind: "named", id: `lean:NominalResults.${name}` });
	const nat = { kind: "primitive", name: "nat" };
	const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
	const documentation = { summary: "Independent result projection.", details: "" };
	const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
	const variant = document.types.find(type => type.name === "Event");
	variant.kind = "variant";
	variant.cases = [
		{ name: "empty", fields: [], documentation }
		, { name: "box", fields: [member("value", named("Envelope"))], documentation }
		, { name: "choices", fields: [member("values", apply("array", apply("option", apply("result", nat, nat))))], documentation }
	];
	const alias = document.types.find(type => type.name === "EnvelopeAlias");
	alias.kind = "alias"; alias.target = named("Envelope");
	document.types.find(type => type.name === "Envelope").source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [null, structuredClone(fin)] };
	for(const item of document.declarations)
		item.source.extensions["lean-lang.org/refinements"] = { parameters: [null], result: structuredClone(signatures.find(([name]) => name === item.name)[2]) };
	return document;
};

/** Add independently chosen input constructors beside the same constructor-free results. */
export const subtypeResultMixedFixture = () => {
	const document = subtypeResultReviewedFixture();
	const extra = corpusReviewedIr({ id: "subtype-results" }, [
		{ name: "NominalResults.echoGroups", parameters: [group], result: group }
		, { name: "NominalResults.echoPair", parameters: [pair], result: pair }
	]);
	const select = (value, name) => value?.kind === "subtype" ? { kind: "subtype", constructor: `NominalResults.${name}` }
		: Array.isArray(value) ? value.map(child => select(child, name))
			: value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, select(child, name)])) : value;
	extra.declarations[0].source.extensions["lean-lang.org/refinements"] = { parameters: [select(groupTree, "checkedOne")], result: structuredClone(groupTree) };
	extra.declarations[1].source.extensions["lean-lang.org/refinements"] = {
		parameters: [record("Pair", field("left", select(groupTree, "checkedOne")), field("right", select(groupTree, "checkedTwo")))]
		, result: structuredClone(pairTree)
	};
	document.declarations.push(...extra.declarations);
	return document;
};
