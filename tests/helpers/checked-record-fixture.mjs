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
export const nominalRefinementsKey = "lean-lang.org/nominal-refinements";
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

/** Closed value-index examples admitted as provenance-only generic-record arguments. */
export const checkedRecordValueIndexSource = `
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
structure Token (α : Type) (index : α) where
  count : Nat
  fixed : index = index
abbrev EmptySized := Sized 0
abbrev ZeroToken := Token Nat 0
abbrev SumToken := Token Nat (1 + 2)
abbrev WideToken := Token Nat 340282366920938463463374607431768211457
abbrev OffToken := Token Bool false
abbrev DecidedToken := Token Bool (decide (1 < 2))
abbrev EmptyToken := Token String ""
abbrev UnicodeToken := Token String "λ🌱"
def mkZeroToken (count : Nat) : Option ZeroToken := some ⟨count, rfl⟩
def mkEmptySized (data : Array Nat) : Option EmptySized := if h : data.size = 0 then some ⟨data, h⟩ else none
def mkSumToken (count : Nat) : Option SumToken := some ⟨count, rfl⟩
def mkWideToken (count : Nat) : Option WideToken := some ⟨count, rfl⟩
def mkOffToken (count : Nat) : Option OffToken := some ⟨count, rfl⟩
def mkDecidedToken (count : Nat) : Option DecidedToken := some ⟨count, rfl⟩
def mkEmptyToken (count : Nat) : Option EmptyToken := some ⟨count, rfl⟩
def mkUnicodeToken (count : Nat) : Option UnicodeToken := some ⟨count, rfl⟩
def zeroIndex (value : ZeroToken) : Nat := value.count
def emptySizedIndex (value : EmptySized) : Nat := value.data.size
def sumIndex (value : SumToken) : Nat := value.count
def wideIndex (value : WideToken) : Nat := value.count
def falseIndex (value : OffToken) : Nat := value.count
def decidedIndex (value : DecidedToken) : Nat := value.count
def emptyStringIndex (value : EmptyToken) : Nat := value.count
def unicodeStringIndex (value : UnicodeToken) : Nat := value.count
`;

const valueIndex = (name, contents) => ({ kind: "value", type: { kind: "primitive", name }, value: contents });
const valueIndexRecords = {
	On: { fields: { count: "nat" }, erased: ["set"], structure: "Flagged", arguments: [valueIndex("bool", "true")] }
	, Ab: { fields: { size: "nat" }, erased: ["named"], structure: "Labeled", arguments: [valueIndex("string", "ab")] }
	, EmptySized: { fields: { data: { array: "nat" } }, erased: ["sized"], structure: "Sized", arguments: [valueIndex("nat", "0")] }
	, ZeroToken: { fields: { count: "nat" }, erased: ["fixed"], structure: "Token", arguments: [nat, valueIndex("nat", "0")] }
	, SumToken: { fields: { count: "nat" }, erased: ["fixed"], structure: "Token", arguments: [nat, valueIndex("nat", "3")] }
	, WideToken: { fields: { count: "nat" }
		, erased: ["fixed"]
		, structure: "Token"
		, arguments: [nat, valueIndex("nat", "340282366920938463463374607431768211457")] }
	, OffToken: { fields: { count: "nat" }
		, erased: ["fixed"]
		, structure: "Token"
		, arguments: [{ kind: "primitive", name: "bool" }, valueIndex("bool", "false")] }
	, DecidedToken: { fields: { count: "nat" }
		, erased: ["fixed"]
		, structure: "Token"
		, arguments: [{ kind: "primitive", name: "bool" }, valueIndex("bool", "true")] }
	, EmptyToken: { fields: { count: "nat" }
		, erased: ["fixed"]
		, structure: "Token"
		, arguments: [{ kind: "primitive", name: "string" }, valueIndex("string", "")] }
	, UnicodeToken: { fields: { count: "nat" }
		, erased: ["fixed"]
		, structure: "Token"
		, arguments: [{ kind: "primitive", name: "string" }, valueIndex("string", "λ🌱")] } };
const valueIndexExports = {
	boolIndex: ["On", "mkOn"]
	, stringIndex: ["Ab", "mkAb"]
	, emptySizedIndex: ["EmptySized", "mkEmptySized"]
	, zeroIndex: ["ZeroToken", "mkZeroToken"]
	, sumIndex: ["SumToken", "mkSumToken"]
	, wideIndex: ["WideToken", "mkWideToken"]
	, falseIndex: ["OffToken", "mkOffToken"]
	, decidedIndex: ["DecidedToken", "mkDecidedToken"]
	, emptyStringIndex: ["EmptyToken", "mkEmptyToken"]
	, unicodeStringIndex: ["UnicodeToken", "mkUnicodeToken"] };

/**
 * Contracts selecting the exact checked constructor for every admitted value-index example.
 *
 * @param module - Lean module and namespace name.
 */
export const checkedRecordValueIndexContracts = (module = "CheckedRecords") => Object.fromEntries(Object.entries(valueIndexExports).map(([name, [, constructor]]) => [`${module}.${name}`
	, { parameters: [site(`${module}.${constructor}`)], result: plain }]));

/**
 * Independently authored Binding IR for all admitted value-index examples.
 *
 * @param root0 - Fixture identity.
 * @param root0.module - Lean module and namespace name.
 * @param root0.component - Component name.
 */
export const checkedRecordValueIndexReview = ({ module = "CheckedRecords", component = "checkedrecords" } = {}) => {
	const signatures = Object.entries(valueIndexExports).map(([name, [record]]) => ({ name: `${module}.${name}`
		, parameters: [{ record: `${module}.${record}`, fields: valueIndexRecords[record].fields }]
		, result: "nat" }));
	const ir = corpusReviewedIr({ id: component }, signatures);
	for(const definition of ir.types)
	{
		const record = valueIndexRecords[definition.name];
		definition.source.extensions[erasedProofsKey] = { fields: [...record.erased] };
		definition.source.extensions[instantiationKey] = { structure: `${module}.${record.structure}`, arguments: structuredClone(record.arguments) };
	}
	for(const declaration of ir.declarations)
	{
		const [, constructor] = valueIndexExports[declaration.name];
		declaration.source.extensions[refinementsKey] = { parameters: [{ kind: "checked-record", constructor: `${module}.${constructor}` }], result: null };
	}
	return ir;
};

/** A checked record whose retained Fin payload is bounded by an earlier retained field. */
export const dependentCheckedRecordSource = `
structure Dependent where
  bound : Nat
  below : Fin bound
  valid : below.val < bound
def mkDependent (bound below : Nat) : Option Dependent :=
  if h : below < bound then some ⟨bound, ⟨below, h⟩, h⟩ else none
def dependentTotal (value : Dependent) : Nat := value.bound + value.below.val
def dependentRoundtrip (value : Dependent) : Dependent := value
def dependentResult (seed : Nat) : Dependent :=
  ⟨seed + 1, ⟨seed, Nat.lt_succ_self seed⟩, Nat.lt_succ_self seed⟩
`;

const dependentFin = Object.freeze({ kind: "fin-field", field: "bound" });
const dependentSelection = module => ({
	kind: "checked-record"
	, name: `${module}.Dependent`
	, constructor: `${module}.mkDependent`
	, fields: [
		{ name: "bound", refinement: null }
		, { name: "below", refinement: null }
	]
});
const dependentParameter = (module, constructor = `${module}.mkDependent`) => ({
	kind: "checked-record", name: `${module}.Dependent`, constructor
	, fields: [
		{ name: "bound", refinement: null }
		, { name: "below", refinement: structuredClone(dependentFin) }
	]
});
const dependentResult = module => ({
	...dependentParameter(module, null), constructor: null
});

/**
 * Exact export contracts for the dependent checked-record fixture.
 *
 * @param module - Lean module and namespace name.
 */
export const dependentCheckedRecordContracts = (module = "CheckedRecords") => ({
	[`${module}.dependentTotal`]: {
		parameters: [{ ...plain, refinement: dependentSelection(module) }]
		, result: plain
	}
	, [`${module}.dependentRoundtrip`]: {
		parameters: [{ ...plain, refinement: dependentSelection(module) }]
		, result: plain
	}
	, [`${module}.dependentResult`]: {
		parameters: [plain], result: plain
	}
});

/**
 * Independently authored Binding IR for retained dependent runtime fields.
 *
 * @param root0 - Fixture identity.
 * @param root0.module - Lean module and namespace name.
 * @param root0.component - Component name.
 */
export const dependentCheckedRecordReview = ({ module = "CheckedRecords", component = "checkedrecords" } = {}) => {
	const signatures = [
		{ name: `${module}.dependentTotal`, parameters: [{ record: `${module}.Dependent`, fields: { bound: "nat", below: "nat" } }], result: "nat" }
		, { name: `${module}.dependentRoundtrip`, parameters: [{ record: `${module}.Dependent`, fields: { bound: "nat", below: "nat" } }], result: { record: `${module}.Dependent`, fields: { bound: "nat", below: "nat" } } }
		, { name: `${module}.dependentResult`, parameters: ["nat"], result: { record: `${module}.Dependent`, fields: { bound: "nat", below: "nat" } } }
	];
	const ir = corpusReviewedIr({ id: component }, signatures);
	const record = ir.types.find(item => item.name === "Dependent");
	record.source.extensions[erasedProofsKey] = { fields: ["valid"] };
	record.source.extensions[nominalRefinementsKey] = {
		kind: "record", fields: [null, structuredClone(dependentFin)]
	};
	for(const declaration of ir.declarations)
	{
		const input = declaration.name === "dependentResult"
			? null : dependentParameter(module);
		const output = declaration.name === "dependentTotal"
			? null : dependentResult(module);
		declaration.source.extensions[refinementsKey] = {
			parameters: declaration.parameters.map((_, index) => index === 0 ? input : null)
			, result: output
		};
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
${checkedRecordValueIndexSource}
/-- Open or opaque supported indices and unreviewed scalar kinds remain fail-closed. -/
abbrev SizedN (n : Nat) := Sized n
def openIndex (value : SizedN 3) : Nat := value.data.size
opaque hidden : Nat
abbrev Hidden := Sized hidden
def hiddenIndex (value : Hidden) : Nat := value.data.size
abbrev FlaggedB (flag : Bool) := Flagged flag
def openBoolIndex (value : FlaggedB true) : Nat := value.count
opaque hiddenFlag : Bool
abbrev HiddenFlag := Flagged hiddenFlag
def hiddenBoolIndex (value : HiddenFlag) : Nat := value.count
abbrev LabeledS (label : String) := Labeled label
def openStringIndex (value : LabeledS "ab") : Nat := value.size
opaque hiddenLabel : String
abbrev HiddenLabel := Labeled hiddenLabel
def hiddenStringIndex (value : HiddenLabel) : Nat := value.size
abbrev IntToken := Token Int (-1)
abbrev CharToken := Token Char 'A'
abbrev UInt8Token := Token UInt8 7
abbrev USizeToken := Token USize 7
abbrev ISizeToken := Token ISize 7
def intIndex (value : IntToken) : Nat := value.count
def charIndex (value : CharToken) : Nat := value.count
def uint8Index (value : UInt8Token) : Nat := value.count
def usizeIndex (value : USizeToken) : Nat := value.count
def isizeIndex (value : ISizeToken) : Nat := value.count
structure FinTagged (index : Fin 3) where
  count : Nat
  fixed : index = index
abbrev FinToken := FinTagged ⟨0, by decide⟩
def finIndex (value : FinToken) : Nat := value.count
structure ProofTagged (proof : True) where
  count : Nat
  fixed : proof = proof
abbrev ProofToken := ProofTagged True.intro
def proofIndex (value : ProofToken) : Nat := value.count
structure InstanceTagged [inst : Inhabited Nat] where
  count : Nat
  fixed : True
abbrev InstanceToken := InstanceTagged
def instanceIndex (value : InstanceToken) : Nat := value.count
structure FunctionTagged (function : Nat → Nat) where
  count : Nat
  fixed : function = function
abbrev FunctionToken := FunctionTagged id
def functionIndex (value : FunctionToken) : Nat := value.count
abbrev JoinedToken := Token String ("a" ++ "b")
def joinedStringIndex (value : JoinedToken) : Nat := value.count
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
	, hiddenIndex: [[null], /generic record Nat value arguments must be closed literals/u]
	, openBoolIndex: [[null], /name this instantiation of a generic structure with an abbrev/u]
	, hiddenBoolIndex: [[null], /generic record Bool value arguments must be closed literals/u]
	, openStringIndex: [[null], /name this instantiation of a generic structure with an abbrev/u]
	, hiddenStringIndex: [[null], /generic record String value arguments must be closed literals/u]
	, intIndex: [[null], /generic record value arguments must have type Nat, Bool or String/u]
	, charIndex: [[null], /generic record value arguments must have type Nat, Bool or String/u]
	, uint8Index: [[null], /generic record value arguments must have type Nat, Bool or String/u]
	, usizeIndex: [[null], /generic record value arguments must have type Nat, Bool or String/u]
	, isizeIndex: [[null], /generic record value arguments must have type Nat, Bool or String/u]
	, finIndex: [[null], /generic record value arguments must have type Nat, Bool or String/u]
	, proofIndex: [[null], /generic record value arguments cannot be proofs/u]
	, instanceIndex: [[null], /generic record value arguments cannot be typeclass instances/u]
	, functionIndex: [[null], /generic record value arguments cannot be functions/u]
	, joinedStringIndex: [[null], /generic record String value arguments must be closed literals/u]
	, dependent: [[null], /dependent or unresolved native type/u]
	// A proof-only record is admitted; without a configured constructor its site still fails closed.
	, witnessed: [[null], /checked records require a configured checked constructor/u]
	, digitOf: [["mkDigit"], /checked record payload fields cannot carry refinements yet/u]
	, inArray: [[null], /nested checked records require an exact checked-record selection/u]
	, inOption: [[null], /nested checked records require an exact checked-record selection/u]
	, held: [[null], /nested checked records require an exact checked-record selection/u]
	, chosen: [[null], /nested checked records require an exact checked-record selection/u]
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
