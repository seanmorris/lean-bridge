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
const box = value => ({ value, count: "nat" });

/**
 * Public signatures of the ten exports, in the fixture's own types.
 *
 * @param module - Lean module and namespace name.
 */
const signatures = module => {
	const record = (name, fields) => ({ record: `${module}.${name}`, fields });
	const natBox = record("NatBox", box("nat")), textBox = record("TextBox", box("string"));
	const wordPair = record("WordPair", { first: "string", second: "nat" });
	const natBoxAgain = record("NatBoxAgain", box("nat"));
	const maybeBox = record("MaybeBox", box({ option: "nat" }));
	const boxPair = record("BoxPair", { first: natBox, second: textBox });
	const taggedNat = record("TaggedNat", { tag: "string", payload: "nat" });
	const markerTag = record("MarkerTag", { label: "string" });
	// The placeholder record becomes the transparent Boxes alias below.
	const boxes = record("Boxes", {});
	return [["swapNamed", [wordPair], wordPair]
		, ["bump", [natBox], natBox]
		, ["shout", [textBox], textBox]
		, ["again", [natBoxAgain], natBoxAgain]
		, ["orZero", [maybeBox], "nat"]
		, ["total", [boxes], "nat"]
		, ["firstBoxes", ["nat"], { option: boxes }]
		, ["unpair", [boxPair], "nat"]
		, ["retag", [taggedNat], taggedNat]
		, ["relabel", [markerTag], markerTag]].map(([name, parameters, result]) => ({ name: `${module}.${name}`, parameters, result }));
};
export const reviewedGenericRecordSignatures = Object.freeze(signatures("GenericRecords"));

/**
 * Describe every export, alias-named record and phantom argument before Lean runs.
 *
 * @param options - Fixture identity.
 * @param options.module - Lean module and namespace name.
 * @param options.component - Component name of the Lake package.
 */
export const genericRecordInstantiationReview = ({ module = "GenericRecords", component = "genericrecords" } = {}) => {
	const qualify = argument => argument.kind === "named" ? { kind: "named", id: `lean:${module}.${argument.id}` }
		: argument.kind === "apply" ? { ...argument, arguments: argument.arguments.map(qualify) } : argument;
	const ir = corpusReviewedIr({ id: component }, signatures(module));
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

const specializationKey = "lean-lang.org/specialization";
// The nine specializations of GenericRecords.echo, each over one closed type name.
const echoTypes = Object.freeze({
	echoNatBox: "NatBox"
	, echoAgain: "NatBoxAgain"
	, echoTextBox: "TextBox"
	, echoLeft: "Left.LeftBox"
	, echoRight: "Right.RightBox"
	, echoBoxes: "Boxes"
	, echoOptionalBoxes: "OptionalBoxes"
	, echoNats: "Nats"
	, echoOptionalNat: "OptionalNat"
});

/**
 * Compose design B with design C: specializations over alias-instantiated records in two
 * namespaces and over Option/List aliases. The application text is what the reviewer expects
 * fresh Lean to print; the compiler receives only the closed type names.
 *
 * @param options - Fixture identity.
 * @param options.module - Lean module and namespace name.
 * @param options.component - Component name of the Lake package.
 */
export const composedGenericRecordReview = ({ module = "GenericRecords", component = "genericrecords" } = {}) => {
	const ir = genericRecordInstantiationReview({ module, component });
	const natBox = ir.types.find(type => type.id === `lean:${module}.NatBox`), boxes = { kind: "named", id: `lean:${module}.Boxes` };
	const nat = { kind: "primitive", name: "nat" };
	const source = name => ({ producer: "corpusReview", declaration: `${module}.${name}`, extensions: {} });
	const template = ir.types.find(type => type.id === `lean:${module}.Boxes`);
	const alias = (name, target) => ({ ...structuredClone(template), id: `lean:${module}.${name}`, name, target, source: source(name) });
	// The same closed application in two namespaces keeps two public identities and one origin.
	for(const name of ["Left.LeftBox", "Right.RightBox"])
	{
		const record = { ...structuredClone(natBox), id: `lean:${module}.${name}`, name: name.split(".").at(-1) };
		record.source.declaration = `${module}.${name}`;
		ir.types.push(record);
	}
	ir.types.push(alias("OptionalBoxes", { kind: "apply", constructor: "option", arguments: [boxes] })
		, alias("Nats", { kind: "apply", constructor: "list", arguments: [nat] })
		, alias("OptionalNat", { kind: "apply", constructor: "option", arguments: [nat] }));
	const bump = ir.declarations.find(item => item.id === `lean:${module}.bump`);
	for(const [name, type] of Object.entries(echoTypes))
	{
		const named = { kind: "named", id: `lean:${module}.${type}` };
		const declaration = structuredClone(bump);
		Object.assign(declaration, { id: `lean:${module}.${name}`, name, overloadKey: `${module}.${name}` });
		declaration.parameters[0].type = named;
		declaration.result.type = structuredClone(named);
		const application = `(@_root_.${module}.echo.{0} (@_root_.${module}.${type}))`;
		const decision = { name: `${module}.${name}`, declaration: `${module}.echo`, types: [`${module}.${type}`], application };
		declaration.source = { ...source("echo"), extensions: { [specializationKey]: decision } };
		ir.declarations.push(declaration);
	}
	return ir;
};
