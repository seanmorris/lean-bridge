/**
 * Independent author selections and exact installed observations for closed value indices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const checkedRecordValueIndexFixtureRoot
	= "tests/fixtures/onboarding/checked-record-value-indices";
export const checkedRecordValueIndexModule = "CheckedRecordValueIndices";
export const checkedRecordValueIndexPackage = "checkedrecordvalueindices";
export const checkedRecordValueIndexBrowserRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
export const checkedRecordValueIndexBrowserProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const checkedRecordValueIndexBrowserEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);

const erasedProofsKey = "lean-lang.org/erased-proofs";
const instantiationKey = "lean-lang.org/instantiation";
const refinementsKey = "lean-lang.org/refinements";
const primitive = name => ({ kind: "primitive", name });
const valueIndex = (name, value) => ({
	kind: "value", type: primitive(name), value
});
const records = Object.freeze({
	On: {
		fields: { count: "nat" }, erased: ["set"], structure: "Flagged"
		, arguments: [valueIndex("bool", "true")]
	}
	, Off: {
		fields: { count: "nat" }, erased: ["set"], structure: "Flagged"
		, arguments: [valueIndex("bool", "false")]
	}
	, Ab: {
		fields: { size: "nat" }, erased: ["named"], structure: "Labeled"
		, arguments: [valueIndex("string", "ab")]
	}
	, EmptySized: {
		fields: { data: { array: "nat" } }, erased: ["sized"], structure: "Sized"
		, arguments: [valueIndex("nat", "0")]
	}
	, ZeroToken: {
		fields: { count: "nat" }, erased: ["fixed"], structure: "Token"
		, arguments: [primitive("nat"), valueIndex("nat", "0")]
	}
	, WideToken: {
		fields: { count: "nat" }, erased: ["fixed"], structure: "Token"
		, arguments: [primitive("nat")
			, valueIndex("nat", "340282366920938463463374607431768211457")]
	}
	, EmptyToken: {
		fields: { count: "nat" }, erased: ["fixed"], structure: "Token"
		, arguments: [primitive("string"), valueIndex("string", "")]
	}
	, UnicodeToken: {
		fields: { count: "nat" }, erased: ["fixed"], structure: "Token"
		, arguments: [primitive("string"), valueIndex("string", "λ🌱")]
	}
});
const inputs = Object.freeze({
	trueBoolIndex: { record: "On", constructor: "mkOn" }
	, falseBoolIndex: { record: "Off", constructor: "mkOff" }
	, abStringIndex: { record: "Ab", constructor: "mkAb" }
	, emptyStringIndex: { record: "EmptyToken", constructor: "mkEmptyToken" }
	, unicodeStringIndex: { record: "UnicodeToken", constructor: "mkUnicodeToken" }
	, emptySizedIndex: { record: "EmptySized", constructor: "mkEmptySized" }
	, zeroNatIndex: { record: "ZeroToken", constructor: "mkZeroToken" }
	, wideNatIndex: { record: "WideToken", constructor: "mkWideToken" }
});
const results = Object.freeze({
	produceTrueBool: { parameters: [], record: "On" }
	, produceFalseBool: { parameters: [], record: "Off" }
	, produceAb: { parameters: [], record: "Ab" }
	, produceEmptyString: { parameters: ["nat"], record: "EmptyToken" }
	, produceUnicodeString: { parameters: ["nat"], record: "UnicodeToken" }
	, produceEmptySized: { parameters: [], record: "EmptySized" }
	, produceZeroNat: { parameters: ["nat"], record: "ZeroToken" }
	, produceWideNat: { parameters: ["nat"], record: "WideToken" }
});
export const checkedRecordValueIndexInputNames = Object.freeze(Object.keys(inputs));
export const checkedRecordValueIndexResultNames = Object.freeze(Object.keys(results));

const plain = { ownership: "copy", lifetime: null };
const site = constructor => ({
	ownership: "copy", lifetime: null, refinement: { constructor }
});

/** Exact contracts: constructors occur only at host-to-Lean checked-record sites. */
export const checkedRecordValueIndexContracts = () => {
	const module = checkedRecordValueIndexModule;
	return {
		...Object.fromEntries(Object.entries(inputs).map(([name, item]) => [
			`${module}.${name}`, {
				parameters: [site(`${module}.${item.constructor}`)], result: plain
			}
		]))
		, ...Object.fromEntries(Object.entries(results).map(([name, item]) => [
			`${module}.${name}`, {
				parameters: item.parameters.map(() => plain), result: plain
			}
		]))
	};
};

const type = name => name === "nat" ? "nat" : {
	record: `${checkedRecordValueIndexModule}.${name}`
	, fields: records[name].fields
};

/**
 * Independently authored Binding IR, never copied from compiler output.
 *
 * @param root0 - Review selection.
 * @param root0.resultOnly - Retain only constructor-free result producers.
 */
export const checkedRecordValueIndexReview = ({ resultOnly = false } = {}) => {
	assert.equal(typeof resultOnly, "boolean");
	const signatures = [
		...(!resultOnly ? Object.entries(inputs).map(([name, item]) => ({
			name: `${checkedRecordValueIndexModule}.${name}`
			, parameters: [type(item.record)], result: "nat"
		})) : [])
		, ...Object.entries(results).map(([name, item]) => ({
			name: `${checkedRecordValueIndexModule}.${name}`
			, parameters: item.parameters.map(type), result: type(item.record)
		}))
	];
	const ir = corpusReviewedIr({ id: checkedRecordValueIndexPackage }, signatures);
	for(const definition of ir.types)
	{
		const record = records[definition.name];
		definition.source.extensions[erasedProofsKey] = { fields: [...record.erased] };
		definition.source.extensions[instantiationKey] = {
			structure: `${checkedRecordValueIndexModule}.${record.structure}`
			, arguments: structuredClone(record.arguments)
		};
	}
	if(!resultOnly) for(const declaration of ir.declarations)
	{
		const input = inputs[declaration.name];
		if(!input) continue;
		declaration.source.extensions[refinementsKey] = {
			parameters: [
				{
					kind: "checked-record"
					, constructor: `${checkedRecordValueIndexModule}.${input.constructor}`
				}
			]
			, result: null
		};
	}
	return ir;
};

/**
 * Keep ordinary/reviewed and full/result-only author routes independent.
 *
 * @param route - Exact author route.
 */
export const checkedRecordValueIndexBrowserSelection = route => {
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(route)
		, "Unknown value-index browser route");
	const resultOnly = route.startsWith("result-only-");
	const reviewed = route.endsWith("reviewed-ir");
	const contracts = checkedRecordValueIndexContracts();
	const names = resultOnly ? checkedRecordValueIndexResultNames
		: [...checkedRecordValueIndexInputNames, ...checkedRecordValueIndexResultNames];
	const exports = names.map(name => `${checkedRecordValueIndexModule}.${name}`);
	return {
		route, resultOnly, reviewed
		, expected: checkedRecordValueIndexReview({ resultOnly })
		, configuration: {
			schemaVersion: 1, modules: [checkedRecordValueIndexModule]
			, targets: {
				npm: { name: checkedRecordValueIndexPackage, version: "1.0.0" }
			}
			, ...reviewed ? {} : {
				exports
				, contracts: Object.fromEntries(
					exports.map(name => [name, contracts[name]]))
			}
		}
	};
};

const encodedCount = value => ["object", [["count", ["bigint", value]]]];
const encodedSize = value => ["object", [["size", ["bigint", value]]]];
const encodedEmptyArray = ["object", [["data", [
	"array", [["length", ["number", "0"]]]
]]]];
const produced = Object.freeze({
	trueBool: encodedCount("0"), falseBool: encodedCount("1")
	, ab: encodedSize("2"), emptyString: encodedCount("23")
	, unicodeString: encodedCount("24"), emptySized: encodedEmptyArray
	, zeroNat: encodedCount("25")
	, wideNat: encodedCount("1267650600228229401496703205393")
});

/**
 * Exact JSON-safe result of the immutable public caller.
 *
 * @param route - Exact author route.
 */
export const checkedRecordValueIndexBrowserExpected = route => {
	const { resultOnly } = checkedRecordValueIndexBrowserSelection(route);
	return {
		checks: resultOnly ? 32 : 72, rejections: resultOnly ? 0 : 6
		, calls: resultOnly ? 8 : 28, snapshots: resultOnly ? 8 : 28
		, recoveries: resultOnly ? 0 : 6
		, observed: resultOnly ? {} : {
			trueBool: "0", falseBool: "1", ab: "2", emptyString: "9"
			, unicodeString: "10", emptySized: "0", zeroNat: "11"
			, wideNat: "1267650600228229401496703205393"
		}
		, produced: structuredClone(produced)
	};
};

export const checkedRecordValueIndexBrowserPackageSource
	= `import request from "./request.json";
export { request };
export const loadApi = () => import("checkedrecordvalueindices");
`;

/**
 * Validate one exact real-browser observation.
 *
 * @param result - Original observation.
 * @param profile - Browser execution context.
 * @param route - Exact author route.
 */
export const validateCheckedRecordValueIndexBrowserObservation = (
	result, profile, route
) => {
	assert.ok(checkedRecordValueIndexBrowserProfiles.includes(profile));
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(route));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: checkedRecordValueIndexPackage
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: checkedRecordValueIndexPackage, route
			, resultOnly: route.startsWith("result-only-")
			, ...checkedRecordValueIndexBrowserExpected(route)
		}
		, hostVersion: result.hostVersion
	});
};

/**
 * Enumerate every lifecycle observation required for one context.
 *
 * @param profile - Browser execution context.
 */
export const checkedRecordValueIndexBrowserPhases = profile => {
	assert.ok(checkedRecordValueIndexBrowserProfiles.includes(profile));
	return profile === "browser-react"
		? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker"
			? ["first", "rerun", "worker-restart", "failure-recovery"]
			: ["first", "rerun", "failure-recovery"];
};

/**
 * Require every engine, variant and lifecycle observation in exact order.
 *
 * @param observations - Original lifecycle observations.
 * @param profile - Browser execution context.
 * @param engines - Complete ordered engine selection.
 * @param route - Exact author route.
 */
export const validateCheckedRecordValueIndexBrowserPhases = (
	observations, profile, engines, route
) => {
	assert.deepEqual(engines, checkedRecordValueIndexBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant => {
		const phases = checkedRecordValueIndexBrowserPhases(profile);
		return phases.map(phase => ({ engine, variant, phase }));
	}));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({
		engine, variant, phase
	})), expected);
	for(const item of observations)
	{
		assert.deepEqual(Object.keys(item).sort()
			, ["engine", "observation", "phase", "variant"]);
		validateCheckedRecordValueIndexBrowserObservation(
			item.observation, profile, route);
	}
};
