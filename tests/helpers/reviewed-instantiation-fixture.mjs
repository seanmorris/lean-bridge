/**
 * Independent reviewed API restating the GenericRecords instantiations (VO #1220, design C).
 * Each instantiation records what the reviewer expects fresh Lean to resolve; the compiler
 * never receives it, and reconciliation fails if Lean resolves anything else.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { genericRecordInstantiations, genericRecordProvenanceOnly } from "./generic-record-packages.mjs";

export const instantiationKey = "lean-lang.org/instantiation";
const module = "GenericRecords";
const box = value => ({ value, count: "nat" });
const record = (name, fields) => ({ record: `${module}.${name}`, fields });
const natBox = record("NatBox", box("nat"));
const textBox = record("TextBox", box("string"));
const wordPair = record("WordPair", { first: "string", second: "nat" });
const natBoxAgain = record("NatBoxAgain", box("nat"));
const maybeBox = record("MaybeBox", box({ option: "nat" }));
const boxPair = record("BoxPair", { first: natBox, second: textBox });
const taggedNat = record("TaggedNat", { tag: "string", payload: "nat" });
const markerTag = record("MarkerTag", { label: "string" });
// The placeholder record becomes the transparent Boxes alias below.
const boxes = record("Boxes", {});

/** Public signatures of the ten exports, in the fixture's own types. */
export const reviewedGenericRecordSignatures = Object.freeze([
	["swapNamed", [wordPair], wordPair]
	, ["bump", [natBox], natBox]
	, ["shout", [textBox], textBox]
	, ["again", [natBoxAgain], natBoxAgain]
	, ["orZero", [maybeBox], "nat"]
	, ["total", [boxes], "nat"]
	, ["firstBoxes", ["nat"], { option: boxes }]
	, ["unpair", [boxPair], "nat"]
	, ["retag", [taggedNat], taggedNat]
	, ["relabel", [markerTag], markerTag]].map(([name, parameters, result]) => ({ name: `${module}.${name}`, parameters, result })));

const qualify = argument => argument.kind === "named" ? { kind: "named", id: `lean:${module}.${argument.id}` }
	: argument.kind === "apply" ? { ...argument, arguments: argument.arguments.map(qualify) } : argument;

/** Describe every export, alias-named record and phantom argument before Lean runs. */
export const genericRecordInstantiationReview = () => {
	const ir = corpusReviewedIr({ id: "genericrecords" }, reviewedGenericRecordSignatures);
	for(const declaration of ir.declarations) declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
	const types = new Map(ir.types.map(type => [type.id, type]));
	const alias = types.get(`lean:${module}.Boxes`);
	alias.kind = "alias";
	alias.target = { kind: "apply", constructor: "list", arguments: [{ kind: "named", id: `lean:${module}.NatBox` }] };
	// Marker appears in no signature: only MarkerTag's instantiation names it.
	for(const name of genericRecordProvenanceOnly)
		ir.types.push({ ...structuredClone(types.get(`lean:${module}.MarkerTag`))
			, id: `lean:${module}.${name}`, name
			, fields: [{ name: "id", type: { kind: "primitive", name: "nat" }, mutability: "immutable", documentation: { summary: "Independent corpus contract.", details: "" } }]
			, source: { producer: "corpusReview", declaration: `${module}.${name}`, extensions: {} } });
	for(const [name, { structure, arguments: values }] of Object.entries(genericRecordInstantiations))
		types.get(`lean:${module}.${name}`).source.extensions[instantiationKey] = { structure: `${module}.${structure}`, arguments: values.map(qualify) };
	return ir;
};
