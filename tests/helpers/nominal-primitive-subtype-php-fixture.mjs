/**
 * Closed native PHP selections and independent nineteen-base nominal caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypePhpRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypePhpModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypePhpCounts = Object.freeze({
	full: Object.freeze({ checks: 1821, rejections: 283, hostRejections: 8
		, snapshotControls: 12, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 612, rejections: 0, hostRejections: 8
		, snapshotControls: 12, rounds: 256, wordBits: 64 })
});

/**
 * Reject disabled explicit selections, unknown values and duplicated runs.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalPrimitiveSubtypePhpSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1", "Invalid primitive-base nominal PHP TEST");
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal PHP ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal PHP ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value)), `Invalid primitive-base nominal PHP ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal PHP ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "VERSION", "COMPOSER_VERSION", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined) assert.equal(flag, "1", `Explicit primitive-base nominal PHP ${name} requires TEST=1`);
	return { enabled: flag === "1"
		, routes: select("ROUTES", nominalPrimitiveSubtypePhpRoutes)
		, modes: select("MODES", nominalPrimitiveSubtypePhpModes) };
};

/**
 * Keep the complete common contract and select the native Composer package.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePhpRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypePhpModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { "php-native": { name: "example/nominalprimitivesubtypes", version: "1.0.0" } } };
};

/**
 * Preserve the independently authored reviewed contract.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpReview = mode => {
	assert.ok(nominalPrimitiveSubtypePhpModes.includes(mode));
	return nominalPrimitiveSubtypeReview(mode === "result-only");
};

/**
 * Preserve one caller for both routes and select only the API mode.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpCaller = async (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePhpRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypePhpModes.includes(mode));
	let source = await readFile("tests/fixtures/nominal-primitive-subtype-consumers/php-native.php", "utf8");
	assert.equal((source.match(/const NOMINAL_PRIMITIVE_RESULT_ONLY = false;/gu) ?? []).length, 1);
	if(mode === "result-only") source = source.replace("const NOMINAL_PRIMITIVE_RESULT_ONLY = false;", "const NOMINAL_PRIMITIVE_RESULT_ONLY = true;");
	return source;
};

/**
 * Require exact complete totals for the selected public caller.
 *
 * @param stdout - Original caller standard output.
 * @param mode - Full or constructor-free result-only API.
 */
export const parseNominalPrimitiveSubtypePhpResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypePhpModes.includes(mode));
	const result = JSON.parse(stdout), expected = nominalPrimitiveSubtypePhpCounts[mode];
	assert.deepEqual(result, expected);
	return result;
};
