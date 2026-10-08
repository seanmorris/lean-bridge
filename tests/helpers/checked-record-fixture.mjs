/**
 * Checked records (VO #1220): records with erased proof fields, built at each parameter site by
 * its own checked constructor and produced by Lean at results. The review here is written
 * independently of any compiled model; fresh Lean must resolve exactly what it states.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const checkedRecordFixture = "tests/fixtures/onboarding/checked-records";
export const erasedProofsKey = "lean-lang.org/erased-proofs";
export const instantiationKey = "lean-lang.org/instantiation";
export const refinementsKey = "lean-lang.org/refinements";
const nat = { kind: "primitive", name: "nat" };
const value = index => ({ kind: "value", type: nat, value: index });

/** Each checked record: payload fields, erased proof names and, for an alias, its instantiation. */
const records = {
	Interval: { fields: { lo: "nat", hi: "nat" }, erased: ["ordered"] }
	, Triple: { fields: { data: { array: "nat" } }, erased: ["sized"], structure: "Sized", arguments: [value("3")] }
	, Percent: { fields: { value: "nat" }, erased: ["above", "below"], structure: "Bounded", arguments: [value("0"), value("101")] } };

/** Each export: parameter types with their site constructors, and the result type. */
const exports = {
	width: [[["Interval", "mkInterval"]], "nat"]
	, span: [[["Interval", "mkInterval"], ["Interval", "mkInterval"]], "nat"]
	, total: [[["Triple", "mkTriple"]], "nat"]
	, firstOf: [[["Triple", "mkTriple"]], "nat"]
	// The same record with another constructor: normalization happens only inside Lean.
	, smallest: [[["Triple", "sortedTriple"]], "nat"]
	, scale: [[["nat", null], ["Triple", "mkTriple"]], "Triple"]
	// Lean produces the proof; no constructor is selected at a result.
	, repeated: [[["nat", null]], "Triple"]
	, complement: [[["Percent", "mkPercent"]], "nat"] };

const site = constructor => ({ ownership: "copy", lifetime: null, refinement: { constructor } });
const plain = { ownership: "copy", lifetime: null };

/**
 * Export contracts naming the checked constructor at every checked parameter.
 *
 * @param module - Lean module and namespace name.
 */
export const checkedRecordContracts = (module = "CheckedRecords") => Object.fromEntries(Object.entries(exports).map(([name, [parameters]]) => [`${module}.${name}`
	, { parameters: parameters.map(([, constructor]) => constructor ? site(`${module}.${constructor}`) : plain), result: plain }]));

/**
 * Describe every checked record and export before Lean runs.
 *
 * @param options - Fixture identity.
 * @param options.module - Lean module and namespace name.
 * @param options.component - Component name of the Lake package.
 */
export const checkedRecordReview = ({ module = "CheckedRecords", component = "checkedrecords" } = {}) => {
	const type = name => name === "nat" ? "nat" : { record: `${module}.${name}`, fields: records[name].fields };
	const signature = ([name, [parameters, result]]) => ({ name: `${module}.${name}`, parameters: parameters.map(([parameter]) => type(parameter)), result: type(result) });
	const ir = corpusReviewedIr({ id: component }, Object.entries(exports).map(signature));
	for(const definition of ir.types)
	{
		const record = records[definition.name];
		definition.source.extensions[erasedProofsKey] = { fields: [...record.erased] };
		if(record.structure) definition.source.extensions[instantiationKey] = { structure: `${module}.${record.structure}`, arguments: structuredClone(record.arguments) };
	}
	for(const declaration of ir.declarations)
	{
		const [parameters] = exports[declaration.name];
		if(parameters.some(([, constructor]) => constructor))
			declaration.source.extensions[refinementsKey] = { parameters: parameters.map(([, constructor]) => constructor ? { kind: "checked-record", constructor: `${module}.${constructor}` } : null), result: null };
	}
	return ir;
};

/**
 * Source-level refusals, appended inside the fixture namespace. Each export names the contract
 * its site needs and the diagnostic fresh Lean must report for it.
 */
export const checkedRecordRefusalSource = `
/-- A constructor for another index: its result is not the site's record. -/
def mkSized4 (data : Array Nat) : Option (Sized 4) := if h : data.size = 4 then some ⟨data, h⟩ else none
def mkTwo (data : Array Nat) (extra : Nat) : Option Triple := if extra = 0 then mkTriple data else none
def mkSwapped (hi lo : Nat) : Option Interval := mkInterval lo hi
def mkImplicit {lo : Nat} (hi : Nat) : Option Interval := mkInterval lo hi
unsafe def mkUnsafe (data : Array Nat) : Option Triple := mkTriple data
partial def mkPartial (data : Array Nat) : Option Triple := if data.size > 3 then mkPartial data.pop else mkTriple data
@[extern "lean_bridge_test_checked_record"] opaque mkForeign (data : Array Nat) : Option Triple
def mkSorry (data : Array Nat) : Option Triple := some ⟨data, sorry⟩
def bySized4 (value : Triple) : Nat := total value
def byTwo (value : Triple) : Nat := total value
def bySwapped (value : Interval) : Nat := width value
def byImplicit (value : Interval) : Nat := width value
def byUnsafe (value : Triple) : Nat := total value
def byPartial (value : Triple) : Nat := total value
def byForeign (value : Triple) : Nat := total value
def bySorry (value : Triple) : Nat := total value
/-- A checked input without a constructor, and a constructor on a Lean-produced result. -/
def unconstructed (value : Interval) : Nat := width value
def constructedResult (value : Nat) : Triple := repeated value
/-- Index kinds outside this slice. -/
abbrev SizedN (n : Nat) := Sized n
def openIndex (value : SizedN 3) : Nat := value.data.size
opaque hidden : Nat
abbrev Hidden := Sized hidden
def hiddenIndex (value : Hidden) : Nat := value.data.size
structure Flagged (flag : Bool) where
  count : Nat
  set : flag = true
abbrev On := Flagged true
def mkOn (count : Nat) : Option On := some ⟨count, rfl⟩
def boolIndex (value : On) : Nat := value.count
structure Labeled (label : String) where
  size : Nat
  named : label.length = size
abbrev Ab := Labeled "ab"
def mkAb (size : Nat) : Option Ab := if h : "ab".length = size then some ⟨size, h⟩ else none
def stringIndex (value : Ab) : Nat := value.size
/-- A payload field that depends on another field stays a dependent type. -/
structure Dep where
  bound : Nat
  below : Fin bound
def dependent (value : Dep) : Nat := value.bound
/-- Proofs with no payload, and a refined payload field. -/
structure Witness : Type where
  ok : 1 < 2
def mkWitness : Option Witness := some ⟨by decide⟩
def witnessed (value : Witness) : Nat := 0
structure Digit where
  digit : Fin 10
  positive : digit.val > 0
def mkDigit (digit : Fin 10) : Option Digit := if h : digit.val > 0 then some ⟨digit, h⟩ else none
def digitOf (value : Digit) : Nat := value.digit.val
/-- Checked records nested anywhere but a top-level site. -/
def inArray (values : Array Interval) : Nat := values.size
def inOption (value : Option Interval) : Nat := match value with | some _ => 1 | none => 0
structure Holder where
  inner : Interval
def held (value : Holder) : Nat := width value.inner
inductive Choice where
  | one (inner : Interval)
  | empty
def chosen (value : Choice) : Nat := match value with | .one inner => width inner | .empty => 0
def called (f : Nat → Interval) : Nat := width (f 0)
`;

const refusals = {
	bySized4: [["mkSized4"], /checked record constructor must return Option of the exact record/u]
	, byTwo: [["mkTwo"], /checked record constructor must take exactly the payload fields/u]
	, bySwapped: [["mkSwapped"], /checked record constructor input hi must be named lo/u]
	, byImplicit: [["mkImplicit"], /checked record constructor takes only explicit payload values/u]
	, byUnsafe: [["mkUnsafe"], /mkUnsafe needs a reviewed unsafe, partial or foreign implementation contract/u]
	, byPartial: [["mkPartial"], /mkPartial needs a reviewed unsafe, partial or foreign implementation contract/u]
	, byForeign: [["mkForeign"], /mkForeign needs a reviewed unsafe, partial or foreign implementation contract/u]
	, bySorry: [["mkSorry"], /checked record constructor depends on sorry/u]
	, unconstructed: [[null], /checked records require a configured checked constructor/u]
	, constructedResult: [[null], /Lean-produced checked records take no constructor/u, "mkTriple"]
	, openIndex: [[null], /name this instantiation of a generic structure with an abbrev/u]
	, hiddenIndex: [[null], /generic record value arguments must be closed Nat literals/u]
	, boolIndex: [["mkOn"], /generic record value arguments must be Nat literals/u]
	, stringIndex: [["mkAb"], /generic record value arguments must be Nat literals/u]
	, dependent: [[null], /dependent or unresolved native type/u]
	, witnessed: [[null], /checked records need at least one payload field/u]
	, digitOf: [["mkDigit"], /checked record payload fields cannot carry refinements yet/u]
	, inArray: [[null], /checked records currently require a top-level parameter or result/u]
	, inOption: [[null], /checked records currently require a top-level parameter or result/u]
	, held: [[null], /checked records currently require a top-level parameter or result/u]
	, chosen: [[null], /checked records currently require a top-level parameter or result/u]
	, called: [[null], /checked records currently require a top-level parameter or result/u] };

/**
 * Contracts and expected diagnostics for every refused export.
 *
 * @param module - Lean module and namespace name.
 */
export const checkedRecordRefusals = (module = "CheckedRecords") => Object.fromEntries(Object.entries(refusals).map(([name, [parameters, pattern, result]]) => [`${module}.${name}`
	, { contract: { parameters: parameters.map(constructor => constructor ? site(`${module}.${constructor}`) : plain), result: result ? site(`${module}.${result}`) : plain }, pattern }]));

const diagnostic = /"arg(\d+) was rejected by ([\w.]+)"/gu;
const calls = { c: /\bcheckedrecords_([a-z_]+)\(/gu, cpp: /\bapi::([a-z_]+)\(/gu };

/**
 * Relabel the ordinary consumer's expected diagnostics with the reviewed parameter names. Each label
 * is checked against the review: the line calls exactly one export, and the reviewed parameter at that
 * position selects the named checked constructor. Every other byte stays.
 *
 * @param source - Ordinary consumer source.
 * @param profile - C or C++ consumer.
 * @param review - Independent reviewed Binding IR.
 */
export const relabelCheckedRecordDiagnostics = (source, profile, review = checkedRecordReview()) => {
	const relabel = line => line.replace(diagnostic, (text, position, constructor) => {
		const names = [...new Set([...line.matchAll(calls[profile])].map(match => match[1]))];
		if(names.length !== 1) throw new TypeError(`one export call per expected diagnostic: ${line}`);
		const id = `lean:CheckedRecords.${names[0].replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase())}`;
		const declaration = review.declarations.find(item => item.id === id);
		const parameter = declaration?.parameters[Number(position)];
		const refinement = declaration?.source.extensions[refinementsKey]?.parameters[Number(position)];
		if(!parameter || refinement?.kind !== "checked-record" || refinement.constructor !== constructor) throw new TypeError(`unreviewed diagnostic: ${text}`);
		return JSON.stringify(`${parameter.name} was rejected by ${constructor}`);
	});
	return source.split("\n").map(relabel).join("\n");
};
