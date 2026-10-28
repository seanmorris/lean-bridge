/**
 * Independent structural Subtype signatures and per-site choices for installed packages.
 * No generated compiler report or native model supplies this review.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const structuralSubtypeFixture = "tests/fixtures/onboarding/structural-subtypes";
export const structuralSubtypeModule = "StructuralSubtypes";
export const structuralSubtypeName = "structuralsubtypes";
const constructor = name => ({ kind: "subtype", constructor: `${structuralSubtypeModule}.${name}` });
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const positive = constructor("checkedPositive"), normalized = constructor("normalizePositive"), word = constructor("checkedWord");
const array = type => ({ array: type }), list = type => ({ list: type }), option = type => ({ option: type });
const group = array(option("nat")), positiveGroup = tree("array", tree("option", positive));
const normalizedGroup = tree("array", tree("option", normalized));
const wide = { kind: "fin", bound: "184467440737095516170" };
const bytePairs = array(option({ tuple: ["uint8", "nat"] }));
const byteChecks = tree("array", tree("option", tree("tuple", constructor("checkedByte"), positive)));
const nestedChecks = tree("array", tree("list", tree("option", tree("tuple", positive, wide))));
const produced = refinement => {
	if(refinement === null) return null;
	if(["subtype", "checked-record"].includes(refinement.kind)) return {
		...structuredClone(refinement), constructor: null
		, ...refinement.fields ? { fields: refinement.fields.map(field => ({ ...field, refinement: produced(field.refinement) })) } : {}
	};
	if(refinement.fields) return { ...structuredClone(refinement)
		, fields: refinement.fields.map(field => ({ ...field, refinement: produced(field.refinement) })) };
	if(refinement.cases) return { ...structuredClone(refinement)
		, cases: refinement.cases.map(branch => ({ ...branch
			, fields: branch.fields.map(field => ({ ...field, refinement: produced(field.refinement) })) })) };
	if(refinement.arguments) return { ...structuredClone(refinement)
		, arguments: refinement.arguments.map(produced) };
	return structuredClone(refinement);
};

// [name, parameter transports, result transport, parameter refinements, result refinement].
const signatures = [
	["scalar", ["nat"], "nat", [positive], positive]
	, ["arrays", [array("nat")], array("nat"), [tree("array", positive)], tree("array", positive)]
	, ["lists", [list("nat")], list("nat"), [tree("list", positive)], tree("list", positive)]
	, ["options", [option("nat")], option("nat"), [tree("option", positive)], tree("option", positive)]
	, ["product", [{ tuple: ["nat", "string"] }], { tuple: ["nat", "string"] }, [tree("tuple", positive, word)], tree("tuple", positive, word)]
	, ["branch", [{ result: ["nat", "string"] }], { result: ["nat", "string"] }, [tree("result", positive, word)], tree("result", positive, word)]
	, ["byteBranches", [bytePairs], bytePairs, [byteChecks], byteChecks]
	, ["nested", [array(list(option({ tuple: ["nat", "nat"] })))], "nat", [nestedChecks], null]
	, ["aliasPair", [{ tuple: [group, group] }], { tuple: [group, group] }, [tree("tuple", positiveGroup, normalizedGroup)], tree("tuple", positiveGroup, normalizedGroup)]
	, ["aliasArguments", [group, group], group, [positiveGroup, normalizedGroup], positiveGroup]
	, ["plainFin", [group], "nat", [tree("array", tree("option", { kind: "fin", bound: "10" }))], null]
	, ["specialized", [list("nat")], list("nat"), [tree("list", positive)], tree("list", positive)]
];

/** Independently specified source API, including the closed generic instance. */
export const structuralSubtypeReview = () => {
	const document = corpusReviewedIr({ id: structuralSubtypeName }, signatures.map(([name, parameters, result]) => ({ name: `${structuralSubtypeModule}.${name}`, parameters, result })));
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, , , parameters, result] = signatures[index];
		declaration.source.extensions["lean-lang.org/refinements"] = structuredClone({ parameters, result: produced(result) });
		if(declaration.name === "specialized")
		{
			declaration.source.declaration = `${structuralSubtypeModule}.generic`;
			declaration.source.extensions["lean-lang.org/specialization"] = {
				name: `${structuralSubtypeModule}.specialized`
				, declaration: `${structuralSubtypeModule}.generic`
				, types: [`${structuralSubtypeModule}.Positive`]
				, application: "(@_root_.StructuralSubtypes.generic (@_root_.StructuralSubtypes.Positive))"
			};
		}
	}
	return document;
};

// Derive ordinary author choices from this hand-authored fixture, not production derivation code.
const choices = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null
		? null : { constructor: refinement.constructor };
	const arguments_ = refinement.arguments.map(choices);
	return arguments_.some(Boolean) ? tree(refinement.kind, ...arguments_) : null;
};
const site = refinement => ({ ownership: "copy", lifetime: null, ...choices(refinement) ? { refinement: choices(refinement) } : {} });

/**
 * The selected ordinary or reviewed author's complete export configuration.
 *
 * @param route - Ordinary source or independently reviewed source.
 * @param profiles - Explicit package targets in this acceptance run.
 */
export const structuralSubtypeConfiguration = (route, profiles) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(profiles.length && profiles.every(profile => ["c", "cpp", "npm"].includes(profile)));
	const targets = Object.fromEntries(profiles.map(profile => [profile, { name: structuralSubtypeName, version: "1.0.0" }]));
	const base = { schemaVersion: 1, modules: [structuralSubtypeModule], targets };
	if(route === "reviewed") return base;
	const contracts = Object.fromEntries(signatures.map(([name, , , parameters, result]) => [`${structuralSubtypeModule}.${name}`, { parameters: parameters.map(site), result: site(produced(result)) }]));
	return { ...base, exports: Object.keys(contracts), contracts
		, specializations: [{ name: `${structuralSubtypeModule}.specialized`, declaration: `${structuralSubtypeModule}.generic`, types: [`${structuralSubtypeModule}.Positive`] }] };
};
