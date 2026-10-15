/**
 * Independent recursive checked-Subtype package contract for copied graph hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const recursiveSubtypeFixtureRoot = "tests/fixtures/onboarding/recursive-subtypes";
export const recursiveSubtypeModule = "RecursiveSubtypes";
const qualified = name => `${recursiveSubtypeModule}.${name}`;
const nat = { kind: "primitive", name: "nat" };
const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const documentation = { summary: "Independent recursive checked-Subtype contract.", details: "" };
const member = (name, type) => ({ name, type, mutability: "immutable", documentation });
const field = (name, refinement) => ({ name, refinement });
const branch = (name, ...fields) => ({ name, fields });
const subtype = constructor => ({ kind: "subtype", constructor: constructor === null ? null : qualified(constructor) });
const fin = { kind: "fin", bound: "3" };
const chainTree = constructor => ({
	kind: "variant", name: qualified("Chain")
	, cases: [
		branch("empty")
		, branch("node", field("value", subtype(constructor)), field("digit", fin), field("tail", null))
	]
});
const groupTree = constructor => ({ kind: "array", arguments: [{ kind: "option", arguments: [chainTree(constructor)] }] });
const chain = named("Chain"), chainAlias = named("ChainAlias");
// Lean's checked structural transport unfolds the outer Groups abbreviation while
// retaining the nominal ChainAlias edge that closes the recursive graph.
const groups = apply("array", apply("option", chainAlias));
const signatures = [
	["first", [chain], nat, [chainTree("plusOne")], null]
	, ["second", [chain], nat, [chainTree("plusTwo")], null]
	, ["echo", [chain], chain, [chainTree("plusOne")], chainTree(null)]
	, ["groups", [groups], nat, [groupTree("plusOne")], null]
	, ["echoGroups", [groups], groups, [groupTree("plusOne")], groupTree(null)]
	, ["produce", [nat], chain, [null], chainTree(null)]
];

const definition = (name, kind, values) => ({
	id: `lean:${qualified(name)}`, name, kind, representation: "copied"
	, mutability: "immutable", typeParameters: []
	, fields: [], cases: [], target: null
	, resource: null, callable: null, host: null
	, documentation
	, source: { producer: "corpusReview", declaration: qualified(name), extensions: {} }
	, assurance: []
	, ...(kind === "variant" ? { cases: values } : { target: values })
});

/** Build the independently authored recursive type graph and directional selections. */
export const recursiveSubtypeReview = () => {
	const document = corpusReviewedIr({ id: "recursivesubtypes" }, signatures.map(([name, parameters]) => ({
		name: qualified(name)
		, parameters: parameters.map(() => "unit"), result: "unit"
	})));
	const chainDefinition = definition("Chain", "variant", [
		{ name: "empty", fields: [], documentation }
		, { name: "node"
			, fields: [member("value", nat), member("digit", nat), member("tail", chain)]
			, documentation }
	]);
	chainDefinition.source.extensions["lean-lang.org/nominal-refinements"] = {
		kind: "variant", cases: [[], [null, structuredClone(fin), null]]
	};
	document.types = [
		chainDefinition
		, definition("ChainAlias", "alias", chain)
	].sort((left, right) => left.id.localeCompare(right.id));
	for(const [index, declaration] of document.declarations.entries())
	{
		const [, parameterTypes, resultType, parameters, result] = signatures[index];
		declaration.parameters.forEach((parameter, offset) => { parameter.type = structuredClone(parameterTypes[offset]); });
		declaration.result.type = structuredClone(resultType);
		declaration.source.extensions["lean-lang.org/refinements"] = structuredClone({ parameters, result });
	}
	return document;
};

const choice = refinement => {
	if(refinement === null || refinement.kind === "fin") return null;
	if(refinement.kind === "subtype") return refinement.constructor === null ? null : { constructor: refinement.constructor };
	if(refinement.kind === "variant")
	{
		const cases = refinement.cases.map(item => ({ name: item.name
			, fields: item.fields.map(member => field(member.name, choice(member.refinement))) }));
		return cases.some(item => item.fields.some(member => member.refinement))
			? { kind: "variant", name: refinement.name, cases } : null;
	}
	const arguments_ = refinement.arguments.map(choice);
	return arguments_.some(Boolean) ? { kind: refinement.kind, arguments: arguments_ } : null;
};
const site = refinement => ({ ownership: "copy", lifetime: null
	, ...choice(refinement) ? { refinement: choice(refinement) } : {} });

/**
 * Select the ordinary contract or leave every decision to a reviewed Binding IR.
 *
 * @param route - Ordinary source or reviewed Binding IR.
 */
export const recursiveSubtypeConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const targets = { "php-wasm": {
		npm: { name: "lean-bridge-recursive-subtypes-wasm", version: "1.0.0" }
		, composer: { name: "lean-bridge-recursive-subtypes/wasm", version: "1.0.0" }
	} };
	const base = { schemaVersion: 1, modules: [recursiveSubtypeModule], targets };
	if(route === "reviewed") return base;
	const contracts = Object.fromEntries(signatures.filter(([, , , parameters, result]) => parameters.some(choice) || choice(result))
		.map(([name, , , parameters, result]) => [qualified(name), { parameters: parameters.map(site), result: site(result) }]));
	return { ...base, exports: signatures.map(([name]) => qualified(name)), contracts };
};

/**
 * Shared package-harness inputs for ordinary and reviewed PHP-Wasm runs.
 *
 * @param route - Ordinary source or reviewed Binding IR.
 */
export const recursiveSubtypePhpWasmFixture = route => {
	const configuration = recursiveSubtypeConfiguration(route);
	return {
		root: recursiveSubtypeFixtureRoot
		, consumer: "tests/fixtures/recursive-subtype-consumers/php-wasm.php"
		, module: recursiveSubtypeModule
		, namespace: "LeanRecursivesubtypes", operation: "first"
		, settings: configuration.targets["php-wasm"]
		, exports: configuration.exports ?? []
		, contracts: configuration.contracts
		, review: recursiveSubtypeReview
		, modelSchemas: { ordinary: 4, reviewed: 5 }
	};
};

export const recursiveSubtypeRefinements = Object.freeze(Object.fromEntries(signatures.map(([name, , , parameters, result]) => [
	qualified(name), structuredClone({ parameters, result })
])));
