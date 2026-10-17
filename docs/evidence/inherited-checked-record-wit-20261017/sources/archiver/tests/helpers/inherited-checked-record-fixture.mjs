/**
 * Independent inherited checked-record signatures and per-use constructor trees.
 * This review is authored without reading compiler output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const inheritedCheckedRecordFixture
	= "tests/fixtures/onboarding/inherited-checked-records";
export const inheritedCheckedRecordModule = "InheritedCheckedRecords";
export const inheritedCheckedRecordName = "inheritedcheckedrecords";
const qualified = name => `${inheritedCheckedRecordModule}.${name}`;
const nat = "nat";
const spanType = { record: qualified("Span"), fields: { lo: nat, hi: nat } };
const ticketType = {
	record: qualified("Ticket")
	, fields: { toSpan: spanType, word: nat }
};
const stampedType = {
	record: qualified("Stamped")
	, fields: { toTicket: ticketType, mark: nat }
};
const field = (name, refinement) => ({ name, refinement });
const checked = (name, constructor, fields) => ({
	kind: "checked-record", name: qualified(name)
	, constructor: constructor === null ? null : qualified(constructor)
	, fields
});
const subtype = constructor => ({
	kind: "subtype"
	, constructor: constructor === null ? null : qualified(constructor)
});
const fin8 = { kind: "fin", bound: "8" };
const span = constructor => checked("Span", constructor, [
	field("lo", null), field("hi", null)
]);
const ticket = (constructor, parentConstructor, wordConstructor) =>
	checked("Ticket", constructor, [
		field("toSpan", span(parentConstructor))
		, field("word", subtype(wordConstructor))
	]);
const stamped = (constructor, childConstructor, parentConstructor, wordConstructor) =>
	checked("Stamped", constructor, [
		field("toTicket", ticket(childConstructor, parentConstructor, wordConstructor))
		, field("mark", structuredClone(fin8))
	]);

// [name, parameter transports, result transport, parameter refinements, result refinement].
const signatures = [
	["first", [ticketType], nat, [ticket("mkTicket", "mkSpan", "mkWord")], null]
	, ["normalized", [ticketType], nat
		, [ticket("normalizeTicket", "normalizeSpan", "normalizeWord")], null]
	, ["pair", [ticketType, ticketType], nat
		, [ticket("mkTicket", "mkSpan", "mkWord")
			, ticket("normalizeTicket", "normalizeSpan", "normalizeWord")]
		, null]
	, ["aliased", [ticketType], nat
		, [ticket("mkTicket", "normalizeSpan", "normalizeWord")], null]
	, ["nested", [stampedType], nat
		, [stamped("mkStamped", "mkTicket", "mkSpan", "mkWord")], null]
	, ["echo", [ticketType], ticketType
		, [ticket("normalizeTicket", "mkSpan", "normalizeWord")]
		, ticket(null, null, null)]
	, ["produce", [nat], ticketType, [null], ticket(null, null, null)]
	, ["produceStamped", [nat], stampedType, [null]
		, stamped(null, null, null, null)]
];

const documentation = { summary: "Independent inherited checked-record contract.", details: "" };
const source = declaration => ({
	producer: "corpusReview", declaration, extensions: {}
});

/** Return the independently authored public Binding IR. */
export const inheritedCheckedRecordReview = () => {
	const reviewedSignatures = signatures.map(([name, parameters, result]) => ({
		name: qualified(name), parameters, result
	}));
	const document = corpusReviewedIr({ id: inheritedCheckedRecordName }
		, reviewedSignatures);
	const definitions = new Map(document.types.map(type => [type.name, type]));
	definitions.get("Span").source.extensions["lean-lang.org/erased-proofs"]
		= { fields: ["ordered"] };
	definitions.get("Ticket").source.extensions["lean-lang.org/erased-proofs"]
		= { fields: ["linked"] };
	definitions.get("Stamped").source.extensions["lean-lang.org/erased-proofs"]
		= { fields: ["stamped"] };
	definitions.get("Stamped").source.extensions["lean-lang.org/nominal-refinements"]
		= { kind: "record", fields: [null, structuredClone(fin8)] };
	const alias = {
		id: `lean:${qualified("TicketAlias")}`, name: "TicketAlias", kind: "alias"
		, representation: "copied", mutability: "immutable", typeParameters: []
		, fields: [], cases: []
		, target: { kind: "named", id: `lean:${qualified("Ticket")}` }
		, resource: null, callable: null, host: null
		, documentation, source: source(qualified("TicketAlias")), assurance: []
	};
	document.types.push(alias);
	document.types.sort((left, right) => left.id.localeCompare(right.id));
	for(const [index, declaration] of document.declarations.entries())
	{
		const [name, , , parameters, result] = signatures[index];
		declaration.source.extensions["lean-lang.org/refinements"]
			= structuredClone({ parameters, result });
		if(name === "aliased") declaration.parameters[0].type
			= { kind: "named", id: alias.id };
	}
	return document;
};

const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null
		? null : { constructor: refinement.constructor };
	assert.equal(refinement.kind, "checked-record");
	if(refinement.constructor === null) return null;
	return {
		kind: "checked-record", name: refinement.name
		, constructor: refinement.constructor
		, fields: refinement.fields.map(item => field(item.name, choice(item.refinement)))
	};
};
const site = refinement => ({
	ownership: "copy", lifetime: null
	, ...choice(refinement) ? { refinement: choice(refinement) } : {}
});

/**
 * Select ordinary source configuration or independently reviewed input.
 *
 * @param route - Ordinary or reviewed source.
 * @param profiles - Native/component package targets used by this fixture.
 */
export const inheritedCheckedRecordConfiguration = (route, profiles = ["c"]) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(profiles.length && profiles.every(profile => ["c", "cpp", "npm"].includes(profile)));
	assert.equal(new Set(profiles).size, profiles.length);
	const targets = Object.fromEntries(profiles.map(profile => [profile, {
		name: inheritedCheckedRecordName, version: "1.0.0"
	}]));
	const base = { schemaVersion: 1, modules: [inheritedCheckedRecordModule], targets };
	if(route === "reviewed") return base;
	const contracts = Object.fromEntries(signatures.filter(([, , , parameters, result]) =>
		parameters.some(choice) || choice(result)).map(([name, , , parameters, result]) => [
		qualified(name), { parameters: parameters.map(site), result: site(result) }])
	);
	return {
		...base, exports: signatures.map(([name]) => qualified(name)), contracts
	};
};

export const inheritedCheckedRecordRefinements = Object.freeze(Object.fromEntries(
	signatures.map(([name, , , parameters, result]) => [
		qualified(name), structuredClone({ parameters, result })
	])
));
