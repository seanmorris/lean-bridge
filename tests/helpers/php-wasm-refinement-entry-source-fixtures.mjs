/**
 * Independent authored-entry selections for the #1824 probe families.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";

const nominalConstructors = Object.freeze([
	...nominalPrimitiveSubtypeFields.flatMap(item => [item.constructor + "A", item.constructor + "B"])
	, "unitReject"
]);
const nominalInputSources = Object.freeze([
	"echoA", "echoB", "refuseUnit", "combine", "echoPair"
	, "echoEventA", "echoEventB", "aliases"
]);
const nominalResultSources = Object.freeze([
	"produce", "produceGroup", "producePair"
	, "produceEvent", "produceChoices", "wordBits"
]);

export const phpWasmRefinementEntrySourceFamilies = Object.freeze([
	"nominal-full", "nominal-result-only"
	, "recursive-subtype", "recursive-checked-record"
]);
export const phpWasmRefinementEntryRoutes = Object.freeze(["ordinary", "reviewed"]);

/**
 * Require explicit producer enablement before permitting a narrowed hosted matrix.
 *
 * @param environment - Producer environment.
 */
export const phpWasmRefinementEntryHostedSelection = environment => {
	const prefix = "LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid refinement entry TEST");
	const choose = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined) assert.equal(flag, "1", `Explicit refinement entry ${name} requires TEST=1`);
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value)), `Invalid refinement entry ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate refinement entry ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1", "Explicit refinement entry OUTPUT requires TEST=1");
	return {
		enabled: flag === "1"
		, families: choose("FAMILIES", phpWasmRefinementEntrySourceFamilies)
		, routes: choose("ROUTES", phpWasmRefinementEntryRoutes)
	};
};

/**
 * Return one closed source-marker selection.
 *
 * @param family - Explicit #1824 fixture family.
 */
export const phpWasmRefinementEntrySourceFixture = family => {
	assert.ok(phpWasmRefinementEntrySourceFamilies.includes(family));
	if(family.startsWith("nominal-"))
	{
		const full = family === "nominal-full";
		return {
			path: "tests/fixtures/onboarding/nominal-primitive-subtypes/NominalPrimitiveSubtypes.lean"
			, namespace: "NominalPrimitiveSubtypes"
			, prefix: `lb_${family.replaceAll("-", "_")}_probe`
			, constructors: full ? [...nominalConstructors] : []
			, sources: full ? [...nominalInputSources, ...nominalResultSources] : [...nominalResultSources]
			, wrappers: {}
		};
	}
	if(family === "recursive-subtype") return {
		path: "tests/fixtures/onboarding/recursive-subtypes/RecursiveSubtypes.lean"
		, namespace: "RecursiveSubtypes", prefix: "lb_recursive_subtype_probe"
		, constructors: ["plusOne", "plusTwo"]
		, sources: ["first", "second", "echo", "groups", "echoGroups", "produce"]
		, wrappers: {
			first: "(value : Chain) : Nat := firstBody value"
			, second: "(value : Chain) : Nat := secondBody value"
		}
	};
	return {
		path: "tests/fixtures/onboarding/recursive-checked-records/RecursiveCheckedRecords.lean"
		, namespace: "RecursiveCheckedRecords"
		, prefix: "lb_recursive_checked_record_probe"
		, constructors: ["plusOne", "plusTwo", "mkPacket", "normalizePacket"]
		, sources: ["first", "second", "echo", "groups", "echoGroups", "produce"]
		, wrappers: {}
	};
};
