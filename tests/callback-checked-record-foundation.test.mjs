/**
 * Directional checked-record metadata for host callbacks and returned Lean
 * closures: a host reply and a closure argument select the exact record
 * constructor, a host callback argument and a closure result project the
 * proof-backed payload. These controls stay source-level; target runtimes
 * prove execution separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertRefinement, callbackRefinement, callbackSubtypeDirection } from "../src/abi/refinements.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { assertReviewedSubtypeCallback } from "../src/analyze/reviewed-refinements.mjs";
import { reviewedSubtypeContracts } from "../src/analyze/reviewed-subtypes.mjs";
import { callbackCheckedRecordInterval, callbackCheckedRecordWeighted } from "./helpers/callback-checked-record-fixture.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false };
const boxed = { ...abi, heap: true };
const nativeNat = { kind: "primitive", name: "nat", lean: "Nat", abi };
const module = "CallbackCheckedRecords";
const nativeSubtype = constructor => ({ kind: "refinement", base: nativeNat, predicate: { kind: "subtype", constructor }, abi });
const nativeRecord = (name, fields, erased) => ({
	kind: "record", name: `${module}.${name}`, lean: `${module}.${name}`
	, constructor: `${module}.${name}.mk`
	, fields: fields.map(([field, type]) => ({ name: field, projection: `${module}.${name}.${field}`, type }))
	, erased, abi: boxed
});
const interval = () => nativeRecord("Interval", [["lo", nativeNat], ["hi", nativeNat]], ["ordered"]);
const weighted = produced => nativeRecord("Weighted", [["weight", nativeSubtype(produced ? null : `${module}.checkedPositive`)], ["limit", nativeNat]], ["within"]);
const checkedRecord = (base, constructor) => ({ kind: "refinement", base, predicate: { kind: "checked-record", constructor }, abi: boxed });
const callback = (parameters, result) => ({ kind: "callback", parameters, result, abi });
const option = element => ({ kind: "option", element, abi: boxed });

const transport = { kind: "named", id: `lean:${module}.Interval` };
const weightedTransport = { kind: "named", id: `lean:${module}.Weighted` };
const nat = { kind: "primitive", name: "nat" };
const definition = (name, fields, erased, extensions = {}) => ({
	id: `lean:${module}.${name}`, kind: "record", representation: "copied"
	, fields: fields.map(([field, type]) => ({ name: field, type }))
	, source: {
		declaration: `${module}.${name}`
		, extensions: { "lean-lang.org/erased-proofs": { fields: erased }, ...extensions }
	}
});
const types = [definition("Interval", [["lo", nat], ["hi", nat]], ["ordered"]), definition("Weighted", [["weight", nat], ["limit", nat]], ["within"])];
const consumed = structuredClone(callbackCheckedRecordInterval);
const produced = { ...structuredClone(callbackCheckedRecordInterval), constructor: null };
const consumedWeighted = {
	kind: "checked-record", name: `${module}.Weighted`
	, constructor: `${module}.mkWeighted`
	, fields: [
		{ name: "weight", refinement: { kind: "subtype", constructor: `${module}.checkedPositive` } }
		, { name: "limit", refinement: null }
	]
};
const producedWeighted = { ...structuredClone(consumedWeighted), constructor: null
	, fields: [{ name: "weight", refinement: { kind: "subtype", constructor: null } }, { name: "limit", refinement: null }] };
const refinements = (parameters, result) => structuredClone({ parameters, result });

test("native callback checked records retain opposite checked directions", () => {
	const host = callback([interval()], checkedRecord(interval(), `${module}.mkInterval`));
	const closure = callback([checkedRecord(interval(), `${module}.mkInterval`)], interval());
	assert.equal(validateNativeType(host, 0, false, "parameter"), host);
	assert.equal(validateNativeType(closure, 0, false, "result"), closure);
	// A host reply or closure argument without its constructor would bypass the proof.
	assert.throws(() => validateNativeType(host, 0, false, "result"), /checked records cross only through a parameter constructor or as a result/u);
	assert.throws(() => validateNativeType(closure, 0, false, "parameter"), /checked records require a structural native parameter constructor/u);
	assert.throws(() => validateNativeType(host), /checked records cross only through a parameter constructor/u);
	// The record constructor is never null at a host-produced site.
	assert.throws(() => validateNativeType(callback([interval()], checkedRecord(interval(), null)), 0, false, "parameter"), /invalid checked record constructor/u);
	// Containers keep the direction; a callback nested in a callback stays refused.
	const container = callback([option(interval())], option(checkedRecord(interval(), `${module}.mkInterval`)));
	assert.equal(validateNativeType(container, 0, false, "parameter"), container);
	const nested = callback([callback([interval()], checkedRecord(interval(), `${module}.mkInterval`))], nativeNat);
	assert.throws(() => validateNativeType(nested, 0, false, "parameter"), /checked records cross only through a parameter constructor or as a result/u);
	assert.throws(() => validateNativeType(callback([callback([nativeNat], checkedRecord(interval(), `${module}.mkInterval`))], nativeNat), 0, false, "parameter"), /Fin refinements require a top-level native parameter or result/u);
	// A refined payload field keeps the Subtype direction below the record.
	const hostNested = callback([weighted(true)], checkedRecord(weighted(false), `${module}.mkWeighted`));
	assert.equal(validateNativeType(hostNested, 0, false, "parameter"), hostNested);
	assert.throws(() => validateNativeType(callback([weighted(false)], checkedRecord(weighted(false), `${module}.mkWeighted`)), 0, false, "parameter"), /invalid Subtype refinement/u);
});

test("callback refinement trees authenticate exactly one checked-record direction", () => {
	const signature = { parameters: [transport], result: transport };
	const host = refinements([null], consumed);
	const closure = refinements([consumed], null);
	assert.deepEqual(callbackRefinement(signature, host, types, "host"), host);
	assert.deepEqual(callbackRefinement(signature, closure, types, "closure"), closure);
	assert.equal(callbackSubtypeDirection(signature, host, types), "host");
	assert.equal(callbackSubtypeDirection(signature, closure, types), "closure");
	assert.throws(() => callbackRefinement(signature, host, types, "closure"), /direction/u);
	assert.throws(() => callbackRefinement(signature, closure, types, "host"), /direction/u);
	assert.throws(() => callbackRefinement(signature, refinements([consumed], consumed), types), /direction/u);
	assert.throws(() => callbackRefinement(signature, refinements([produced], produced), types), /direction/u);
	// A projected record inside a container names the direction without a constructor.
	const containers = { parameters: [{ kind: "apply", constructor: "option", arguments: [transport] }], result: { kind: "apply", constructor: "option", arguments: [transport] } };
	const projectedHost = refinements([{ kind: "option", arguments: [produced] }], { kind: "option", arguments: [consumed] });
	assert.equal(callbackSubtypeDirection(containers, projectedHost, types), "host");
	assert.throws(() => callbackRefinement(containers, refinements([{ kind: "option", arguments: [consumed] }], { kind: "option", arguments: [consumed] }), types), /direction/u);
	// Payload fields follow the record direction: a Lean-produced record projects its Subtype field.
	const weightedSignature = { parameters: [weightedTransport], result: weightedTransport };
	assert.equal(callbackSubtypeDirection(weightedSignature, refinements([producedWeighted], consumedWeighted), types), "host");
	assert.equal(callbackSubtypeDirection(weightedSignature, refinements([consumedWeighted], producedWeighted), types), "closure");
	const leaked = { ...producedWeighted, fields: [{ name: "weight", refinement: { kind: "subtype", constructor: `${module}.checkedPositive` } }, { name: "limit", refinement: null }] };
	assert.throws(() => callbackRefinement(weightedSignature, refinements([leaked], consumedWeighted), types), /direction/u);
	// The record constructor must be a Lean name at a host-produced site.
	assert.throws(() => callbackRefinement(signature, refinements([null], { ...consumed, constructor: "" }), types), /Refinement does not match|direction/u);
});

test("owned and generic checked records stay outside callback refinements", () => {
	const signature = { parameters: [transport], result: transport };
	const owned = structuredClone(types);
	owned[0].representation = "owned";
	assert.throws(() => callbackRefinement(signature, refinements([null], consumed), owned, "host"), /Refinement does not match its transport type/u);
	assert.throws(() => callbackRefinement(signature, refinements([null], consumed), owned), /direction/u);
	const generic = structuredClone(types);
	generic[0].source.extensions["lean-lang.org/instantiation"] = { structure: `${module}.Sized`, arguments: [] };
	assert.throws(() => callbackRefinement(signature, refinements([null], consumed), generic, "host"), /Refinement does not match its transport type/u);
	// Outside a callback the same generic record still validates at its top-level site.
	assert.doesNotThrow(() => assertRefinement(consumed, transport, 0, true, generic));
});

test("reviewed callback checked records preserve their directional identity", () => {
	const copied = { type: transport, ownership: "copy", lifetime: null };
	const definition = {
		kind: "callback"
		, callable: { parameters: [copied], result: copied }
		, source: { extensions: { "lean-lang.org/refinements": refinements([null], consumed) } }
	};
	assert.equal(assertReviewedSubtypeCallback(definition, types), "host");
	definition.source.extensions["lean-lang.org/refinements"] = refinements([consumed], null);
	assert.equal(assertReviewedSubtypeCallback(definition, types), "closure");
	definition.source.extensions["lean-lang.org/refinements"] = refinements([produced], consumed);
	assert.equal(assertReviewedSubtypeCallback(definition, types), "host");
	definition.source.extensions["lean-lang.org/refinements"].result.constructor = null;
	assert.throws(() => assertReviewedSubtypeCallback(definition, types), /direction/u);
});

test("reviewed callback checked records become exact compiler callback contracts", () => {
	const copied = { type: transport, ownership: "copy", lifetime: null };
	const plain = { type: nat, ownership: "copy", lifetime: null };
	const callbackDefinition = (id, value, parameters = [copied]) => ({
		id, kind: "callback"
		, callable: { parameters, result: copied }
		, source: { declaration: id.slice(7)
			, extensions: { "lean-lang.org/refinements": value } }
	});
	const hostDefinition = callbackDefinition("bridge:Host", refinements([null], consumed));
	const closureDefinition = callbackDefinition("bridge:Closure", refinements([consumed, null], null), [copied, plain]);
	const named = id => ({ kind: "named", id });
	const declarations = [
		{
			source: { declaration: `${module}.callHost`, extensions: {} }
			, parameters: [{ type: named(hostDefinition.id), ownership: "borrow"
				, lifetime: { scope: "call", anchor: null } }]
			, result: plain
		}
		, {
			source: { declaration: `${module}.makeClosure`, extensions: {} }
			, parameters: [plain]
			, result: { type: named(closureDefinition.id), ownership: "lease"
				, lifetime: { scope: "explicit", anchor: null } }
		}
	];
	const contracts = reviewedSubtypeContracts({ declarations
		, types: [...types, hostDefinition, closureDefinition] });
	const selection = { ownership: "copy", lifetime: null, refinement: structuredClone(callbackCheckedRecordInterval) };
	assert.deepEqual(contracts, {
		[`${module}.callHost`]: {
			parameters: [{ ownership: "borrow"
				, lifetime: { scope: "call", anchor: null }
				, callable: { parameters: [{ ownership: "copy", lifetime: null }], result: selection } }]
			, result: { ownership: "copy", lifetime: null }
		}
		, [`${module}.makeClosure`]: {
			parameters: [{ ownership: "copy", lifetime: null }]
			, result: { ownership: "lease"
				, lifetime: { scope: "explicit", anchor: null }
				, callable: { parameters: [selection, { ownership: "copy", lifetime: null }]
					, result: { ownership: "copy", lifetime: null } } }
		}
	});
	// A Subtype payload field is selected below the record in the same contract shape.
	const weightedCopied = { type: weightedTransport, ownership: "copy", lifetime: null };
	const nestedDefinition = {
		id: "bridge:Nested", kind: "callback"
		, callable: { parameters: [weightedCopied], result: weightedCopied }
		, source: {
			declaration: "Nested"
			, extensions: { "lean-lang.org/refinements": refinements([producedWeighted], consumedWeighted) }
		}
	};
	const nested = reviewedSubtypeContracts({
		types: [...types, nestedDefinition]
		, declarations: [{
			source: { declaration: `${module}.callHostNested`, extensions: {} }
			, parameters: [{ type: named(nestedDefinition.id), ownership: "borrow"
				, lifetime: { scope: "call", anchor: null } }]
			, result: plain
		}]
	});
	assert.deepEqual(nested[`${module}.callHostNested`].parameters[0].callable
		, { parameters: [{ ownership: "copy", lifetime: null }]
			, result: { ownership: "copy", lifetime: null, refinement: structuredClone(callbackCheckedRecordWeighted) } });
});
