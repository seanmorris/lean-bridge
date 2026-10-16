/**
 * Independent mutual checked-record/variant package contract and constructor choices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const mutualCheckedRecordFixtureRoot
	= "tests/fixtures/onboarding/mutual-checked-records";
export const mutualCheckedRecordModule = "MutualCheckedRecords";
const qualified = name => `${mutualCheckedRecordModule}.${name}`;
const nat = { kind: "primitive", name: "nat" };
const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const documentation = { summary: "Independent mutual checked-record contract.", details: "" };
const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
const field = (name, refinement) => ({ name, refinement });
const subtype = constructor => ({ kind: "subtype"
	, constructor: constructor === null ? null : qualified(constructor) });
const fin = { kind: "fin", bound: "3" };
const checked = (constructor, valueConstructor) => ({
	kind: "checked-record", name: qualified("Envelope")
	, constructor: constructor === null ? null : qualified(constructor)
	, fields: [
		field("value", subtype(valueConstructor))
		, field("mode", structuredClone(fin))
		, field("next", null)]
});
const envelope = named("Envelope"), envelopeAlias = named("EnvelopeAlias"), step = named("Step");
const groups = apply("array", apply("option", envelopeAlias));
const groupTree = (constructor, valueConstructor) => ({
	kind: "array"
	, arguments: [{
		kind: "option", arguments: [checked(constructor, valueConstructor)]
	}]
});
const signatures = [
	["first", [envelope], nat, [checked("mkEnvelope", "plusOne")], null]
	, ["second", [envelope], nat, [checked("normalizeEnvelope", "plusTwo")], null]
	, ["echo", [envelope], envelope, [checked("mkEnvelope", "plusOne")], checked(null, null)]
	, ["groups", [groups], nat, [groupTree("mkEnvelope", "plusOne")], null]
	, ["echoGroups", [groups], groups, [groupTree("normalizeEnvelope", "plusTwo")]
		, groupTree(null, null)]
	, ["produce", [nat], envelope, [null], checked(null, null)]
];

const definition = (name, kind, values) => ({
	id: `lean:${qualified(name)}`, name, kind, representation: "copied"
	, mutability: "immutable", typeParameters: []
	, fields: [], cases: [], target: null
	, resource: null, callable: null, host: null
	, documentation
	, source: { producer: "corpusReview", declaration: qualified(name), extensions: {} }
	, assurance: []
	, ...(kind === "record" ? { fields: values }
		: kind === "variant" ? { cases: values }
			: { target: values })
});

/** Build the independent finite mutual graph and per-site refinements. */
export const mutualCheckedRecordReview = () => {
	const document = corpusReviewedIr({ id: "mutualcheckedrecords" }, signatures.map(([name, parameters]) => ({
		name: qualified(name)
		, parameters: parameters.map(() => "unit")
		, result: "unit"
	})));
	const envelopeDefinition = definition("Envelope", "record", [
		member("value", nat)
		, member("mode", nat)
		, member("next", apply("option", step))
	]);
	envelopeDefinition.source.extensions["lean-lang.org/erased-proofs"] = { fields: ["linked"] };
	envelopeDefinition.source.extensions["lean-lang.org/nominal-refinements"] = {
		kind: "record", fields: [null, structuredClone(fin), null]
	};
	const stepDefinition = definition("Step", "variant", [
		{ name: "stop", fields: [], documentation }
		, { name: "more", fields: [member("packet", envelope)], documentation }
	]);
	document.types = [
		envelopeDefinition
		, definition("EnvelopeAlias", "alias", envelope)
		, stepDefinition
	].sort((left, right) => left.id.localeCompare(right.id));
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, parameterTypes, resultType, parameters, result] = signatures[index];
		declaration.parameters.forEach((parameter, offset) => {
			parameter.type = structuredClone(parameterTypes[offset]);
		});
		declaration.result.type = structuredClone(resultType);
		declaration.source.extensions["lean-lang.org/refinements"]
			= structuredClone({ parameters, result });
	}
	return document;
};

const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null
		? null : { constructor: refinement.constructor };
	if(refinement.kind === "checked-record")
	{
		if(refinement.constructor === null) return null;
		return { kind: "checked-record", name: refinement.name
			, constructor: refinement.constructor
			, fields: refinement.fields.map(item => field(item.name, choice(item.refinement))) };
	}
	const arguments_ = refinement.arguments.map(choice);
	return arguments_.some(Boolean) ? { kind: refinement.kind, arguments: arguments_ } : null;
};
const site = refinement => ({ ownership: "copy", lifetime: null
	, ...choice(refinement) ? { refinement: choice(refinement) } : {} });

/**
 * Select the ordinary contract or an independently reviewed Binding IR.
 *
 * @param route - Source-selection route.
 */
export const mutualCheckedRecordConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const targets = {
		c: { name: "mutualcheckedrecords", version: "1.0.0" }
		, cpp: { name: "mutualcheckedrecords", version: "1.0.0" }
		, "php-wasm": {
			npm: { name: "lean-bridge-mutual-checked-records-wasm", version: "1.0.0" }
			, composer: { name: "lean-bridge-mutual-checked-records/wasm", version: "1.0.0" }
		}
	};
	const base = { schemaVersion: 1, modules: [mutualCheckedRecordModule], targets };
	if(route === "reviewed") return base;
	const contracts = Object.fromEntries(signatures.filter(([, , , parameters, result]) =>
		parameters.some(choice) || choice(result)).map(([name, , , parameters, result]) => [
		qualified(name), { parameters: parameters.map(site), result: site(result) }])
	);
	return { ...base, exports: signatures.map(([name]) => qualified(name)), contracts };
};

export const mutualCheckedRecordRefinements = Object.freeze(Object.fromEntries(
	signatures.map(([name, , , parameters, result]) => [
		qualified(name), structuredClone({ parameters, result })
	])
));
