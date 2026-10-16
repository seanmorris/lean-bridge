/**
 * Independent nested checked-record signatures, complete refinement trees and author choices.
 * This fixture never reads compiler output when describing the reviewed package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const nestedCheckedRecordFixture = "tests/fixtures/onboarding/nested-checked-records";
export const nestedCheckedRecordModule = "NestedCheckedRecords";
export const nestedCheckedRecordName = "nestedcheckedrecords";
const qualified = name => `${nestedCheckedRecordModule}.${name}`;
const packet = { record: qualified("Packet"), fields: { digit: "nat", word: "nat" } };
const holder = { record: qualified("Holder"), fields: { packet, tag: "nat" } };
const choiceType = { record: qualified("Choice"), fields: {} };
const array = type => ({ array: type }), list = type => ({ list: type }), option = type => ({ option: type });
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const field = (name, refinement) => ({ name, refinement });
const fin = { kind: "fin", bound: "10" };
const subtype = constructor => ({ kind: "subtype"
	, constructor: constructor === null ? null : qualified(constructor) });
const checked = (constructor, word) => ({
	kind: "checked-record", name: qualified("Packet")
	, constructor: constructor === null ? null : qualified(constructor)
	, fields: [field("digit", structuredClone(fin)), field("word", subtype(word))] });
const selectedRecord = (name, ...fields) => ({ kind: "record", name: qualified(name), fields });
const selectedChoice = (constructor, word) => ({
	kind: "variant", name: qualified("Choice")
	, cases: [
		{ name: "empty", fields: [] }
		, { name: "packet", fields: [field("value", checked(constructor, word))] }
	]
});

// [name, parameter transports, result transport, parameter refinements, result refinement].
const signatures = [
	["first", [packet], "nat", [checked("mkPacket", "mkWord")], null]
	, ["second", [packet], "nat", [checked("normalizePacket", "normalizeWord")], null]
	, ["pair", [packet, packet], "nat"
		, [checked("mkPacket", "mkWord"), checked("normalizePacket", "normalizeWord")]
		, null]
	, ["inArray", [array(packet)], "nat", [tree("array", checked("mkPacket", "mkWord"))], null]
	, ["inList", [list(packet)], "nat", [tree("list", checked("normalizePacket", "normalizeWord"))], null]
	, ["inOption", [option(packet)], "nat", [tree("option", checked("mkPacket", "normalizeWord"))], null]
	, ["inProduct", [{ tuple: [packet, packet] }], "nat"
		, [tree("tuple"
			, checked("mkPacket", "mkWord"), checked("normalizePacket", "normalizeWord"))]
		, null]
	, ["inExcept", [{ result: [packet, packet] }], "nat"
		, [tree("result"
			, checked("normalizePacket", "mkWord"), checked("mkPacket", "normalizeWord"))]
		, null]
	, ["inHolder", [holder], "nat"
		, [selectedRecord("Holder"
			, field("packet", checked("normalizePacket", "mkWord")), field("tag", null))]
		, null]
	, ["inChoice", [choiceType], "nat", [selectedChoice("mkPacket", "normalizeWord")], null]
	, ["echoArray", [array(packet)], array(packet)
		, [tree("array", checked("mkPacket", "mkWord"))]
		, tree("array", checked(null, null))]
	, ["produceOption", ["nat"], option(packet), [null], tree("option", checked(null, null))]
	, ["produceArray", ["nat"], array(packet), [null], tree("array", checked(null, null))]
];
const selectedSignatures = selection => {
	assert.ok(["full", "result-only"].includes(selection));
	return selection === "full" ? signatures : signatures.filter(([name]) => name.startsWith("produce"));
};

/**
 * Return the independently authored Binding IR for one package selection.
 *
 * @param selection - Full or result-only public API.
 */
export const nestedCheckedRecordReview = (selection = "full") => {
	const selected = selectedSignatures(selection);
	const document = corpusReviewedIr({ id: nestedCheckedRecordName }, selected.map(([name, parameters, result]) => ({
		name: qualified(name), parameters, result
	})));
	const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
	const documentation = { summary: "Independent nested checked-record contract.", details: "" };
	const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
	const choice = document.types.find(type => type.name === "Choice");
	if(choice)
	{
		choice.kind = "variant";
		choice.fields = [];
		choice.cases = [
			{ name: "empty", fields: [], documentation }
			, { name: "packet", fields: [member("value", named("Packet"))], documentation }
		];
	}
	const packetDefinition = document.types.find(type => type.name === "Packet");
	packetDefinition.source.extensions["lean-lang.org/erased-proofs"] = { fields: ["linked"] };
	packetDefinition.source.extensions["lean-lang.org/nominal-refinements"] = {
		kind: "record", fields: [structuredClone(fin), null]
	};
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, , , parameters, result] = selected[index];
		declaration.source.extensions["lean-lang.org/refinements"] = structuredClone({ parameters, result });
	}
	return document;
};

// Ordinary choices come from this hand-authored fixture. Fin bounds and every
// Lean-produced projection are compiler-owned and therefore absent from author input.
const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null ? null : { constructor: refinement.constructor };
	if(refinement.kind === "checked-record")
	{
		if(refinement.constructor === null) return null;
		return { kind: "checked-record", name: refinement.name
			, constructor: refinement.constructor
			, fields: refinement.fields.map(member => field(member.name, choice(member.refinement))) };
	}
	if(refinement.kind === "record")
	{
		const fields = refinement.fields.map(member => field(member.name, choice(member.refinement)));
		return fields.some(member => member.refinement) ? { kind: "record", name: refinement.name, fields } : null;
	}
	if(refinement.kind === "variant")
	{
		const cases = refinement.cases.map(branch => ({ name: branch.name
			, fields: branch.fields.map(member => field(member.name, choice(member.refinement))) }));
		return cases.some(branch => branch.fields.some(member => member.refinement))
			? { kind: "variant", name: refinement.name, cases } : null;
	}
	const arguments_ = refinement.arguments.map(choice);
	return arguments_.some(Boolean) ? tree(refinement.kind, ...arguments_) : null;
};
const site = refinement => {
	const selected = choice(refinement);
	return { ownership: "copy", lifetime: null, ...(selected === null ? {} : { refinement: selected }) };
};

/**
 * Select the ordinary source contracts or the independently reviewed package.
 *
 * @param route - Ordinary source or reviewed source.
 * @param profiles - Explicit package targets.
 * @param selection - Full API or the independently selected result-only API.
 */
export const nestedCheckedRecordConfiguration = (route, profiles, selection = "full") => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(profiles.length && profiles.every(profile => ["c", "cpp", "npm"].includes(profile)));
	assert.equal(new Set(profiles).size, profiles.length);
	const selected = selectedSignatures(selection);
	const targets = Object.fromEntries(profiles.map(profile => [profile, {
		name: nestedCheckedRecordName, version: "1.0.0"
	}]));
	const base = { schemaVersion: 1, modules: [nestedCheckedRecordModule], targets };
	if(route === "reviewed") return base;
	const contracts = Object.fromEntries(selected.map(([name, , , parameters, result]) => [
		qualified(name)
		, { parameters: parameters.map(site), result: site(result) }
	]));
	return { ...base, exports: selected.map(([name]) => qualified(name)), contracts };
};
