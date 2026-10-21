/**
 * Independent review of the zero-payload checked-record fixture: proof-only records, a
 * Unit-bearing record and a plain empty record, each kept distinct from Option, null and
 * default values. A proof-only parameter is built by a nullary checked constructor, the only
 * proof source; a Lean-produced result erases its proof to the empty carrier.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const zeroPayloadCheckedRecordFixture = "tests/fixtures/onboarding/zero-payload-checked-records";
export const zeroPayloadCheckedRecordModule = "ZeroPayloadCheckedRecords";
export const erasedProofsKey = "lean-lang.org/erased-proofs";
export const refinementsKey = "lean-lang.org/refinements";

/** Each record: payload fields and erased proof names. A plain empty record has neither. */
const records = {
	Witness: { fields: {}, erased: ["positive"] }
	, Token: { fields: { tag: "unit" }, erased: ["fresh"] }
	, Marker: { fields: {}, erased: [] } };

/** Each export: parameter types with their site constructors, and the result type. */
const exports = {
	witnessCount: [[["Witness", "mkWitness"]], "nat"]
	// The refusing constructor is accepted at analysis time and rejects every host value at runtime.
	, absentCount: [[["Witness", "mkAbsent"]], "nat"]
	, tokenTag: [[["Token", "mkToken"]], "unit"]
	// Lean produces the proof; no constructor is selected at a result.
	, produceWitness: [[], "Witness"]
	, produceToken: [[], "Token"]
	, witnesses: [[["nat", null]], { array: "Witness" }]
	, maybeWitness: [[["bool", null]], { option: "Witness" }]
	// A plain empty record is an ordinary copied record and takes no constructor.
	, markerCount: [[["Marker", null]], "nat"]
	, produceMarker: [[], "Marker"] };

const site = constructor => ({ ownership: "copy", lifetime: null, refinement: { constructor } });
const plain = { ownership: "copy", lifetime: null };

/**
 * Export contracts naming the checked constructor at every checked parameter.
 *
 * @param module - Lean module and namespace name.
 */
export const zeroPayloadCheckedRecordContracts = (module = zeroPayloadCheckedRecordModule) => Object.fromEntries(
	Object.entries(exports).map(([name, [parameters]]) => [`${module}.${name}`
		, { parameters: parameters.map(([, constructor]) => constructor ? site(`${module}.${constructor}`) : plain), result: plain }]));

/**
 * Describe every record and export before Lean runs.
 *
 * @param options - Fixture identity.
 * @param options.module - Lean module and namespace name.
 * @param options.component - Component name of the Lake package.
 */
export const zeroPayloadCheckedRecordReview = ({ module = zeroPayloadCheckedRecordModule, component = "zeropayloadcheckedrecords" } = {}) => {
	const type = name => typeof name === "string"
		? (Object.hasOwn(records, name) ? { record: `${module}.${name}`, fields: records[name].fields } : name)
		: name.array ? { array: type(name.array) } : { option: type(name.option) };
	const signature = ([name, [parameters, result]]) => ({ name: `${module}.${name}`, parameters: parameters.map(([parameter]) => type(parameter)), result: type(result) });
	const ir = corpusReviewedIr({ id: component }, Object.entries(exports).map(signature));
	for(const definition of ir.types)
	{
		const record = records[definition.name];
		if(record.erased.length) definition.source.extensions[erasedProofsKey] = { fields: [...record.erased] };
	}
	// A produced record inside a container keeps its payload tree so generated mirrors can erase it.
	const produced = name => ({ kind: "checked-record", name: `${module}.${name}`, constructor: null, fields: [] });
	const resultTree = result => typeof result === "string" ? null
		: { kind: result.array ? "array" : "option", arguments: [produced(result.array ?? result.option)] };
	for(const declaration of ir.declarations)
	{
		const [parameters, result] = exports[declaration.name];
		const tree = resultTree(result);
		if(parameters.some(([, constructor]) => constructor) || tree !== null)
			declaration.source.extensions[refinementsKey] = { parameters: parameters.map(([, constructor]) => constructor ? { kind: "checked-record", constructor: `${module}.${constructor}` } : null), result: tree };
	}
	return ir;
};

/** Refused sites appended to the fixture: each names exactly one diagnostic. */
export const zeroPayloadCheckedRecordRefusalSource = `
/-- A constructor with a binder for a record that has no payload. -/
def mkWitnessNat (count : Nat) : Option Witness := if count = 0 then mkWitness else none
/-- A nullary constructor for another record. -/
def mkTokenOnly : Option Token := some ⟨(), trivial⟩
def mkWitnessSorry : Option Witness := some ⟨sorry⟩
/-- A Unit-bearing record whose constructor omits its unit payload. -/
def mkTokenBare : Option Token := some ⟨(), trivial⟩
def byNat (value : Witness) : Nat := witnessCount value
def byOther (value : Witness) : Nat := witnessCount value
def bySorry (value : Witness) : Nat := witnessCount value
def byBare (value : Token) : Unit := tokenTag value
/-- A checked input without a constructor, and a constructor on a Lean-produced result. -/
def unconstructed (value : Witness) : Nat := witnessCount value
def constructedResult (count : Nat) : Witness := produceWitness
`;

const refusals = {
	byNat: [["mkWitnessNat"], /checked record constructor must take exactly the payload fields/u]
	, byOther: [["mkTokenOnly"], /checked record constructor must return Option of the exact record/u]
	, bySorry: [["mkWitnessSorry"], /checked record constructor depends on sorry/u]
	, byBare: [["mkTokenBare"], /checked record constructor must take exactly the payload fields/u]
	, unconstructed: [[null], /checked records require a configured checked constructor/u]
	, constructedResult: [[null], /Lean-produced checked records take no constructor/u, "mkWitness"] };

/**
 * Contracts and expected diagnostics for every refused export.
 *
 * @param module - Lean module and namespace name.
 */
export const zeroPayloadCheckedRecordRefusals = (module = zeroPayloadCheckedRecordModule) => Object.fromEntries(
	Object.entries(refusals).map(([name, [parameters, pattern, result]]) => [`${module}.${name}`
		, { contract: { parameters: parameters.map(constructor => constructor ? site(`${module}.${constructor}`) : plain), result: result ? site(`${module}.${result}`) : plain }, pattern }]));
