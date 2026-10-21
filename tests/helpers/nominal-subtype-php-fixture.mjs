/**
 * Independent native PHP contracts and callers for nominal Subtype packages.
 * Only the export named echo changes, because echo is a PHP keyword.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeFixture, nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypePhpRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypePhpModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypePhpCounts = Object.freeze({
	full: Object.freeze({ checks: 4254, rejections: 1032
		, hostRejections: 20, snapshotControls: 8 })
	, "result-only": Object.freeze({ checks: 2112, rejections: 0
		, hostRejections: 12, snapshotControls: 8 })
});

/**
 * Require explicit, nonempty and nonduplicated installed selections.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypePhpSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1");
	const enabled = flag === "1";
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw === undefined) return [...allowed];
		assert.ok(enabled, "Explicit PHP selection requires the installed gate");
		assert.equal(typeof raw, "string");
		const selected = raw.split(",");
		assert.ok(selected.length && selected.every(item => allowed.includes(item)));
		assert.equal(new Set(selected).size, selected.length);
		return selected;
	};
	for(const name of ["OUTPUT", "VERSION", "COMPOSER_VERSION"])
		if(environment[prefix + name] !== undefined) assert.ok(enabled);
	return { enabled, routes: select("ROUTES", nominalSubtypePhpRoutes)
		, modes: select("MODES", nominalSubtypePhpModes) };
};

const names = new Map([["echo", "echoEnvelope"], ["NominalSubtypes.echo", "NominalSubtypes.echoEnvelope"], ["lean:NominalSubtypes.echo", "lean:NominalSubtypes.echoEnvelope"]]);
const renamed = value => {
	if(Array.isArray(value)) return value.map(renamed);
	if(value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [names.get(key) ?? key, renamed(item)]));
	return typeof value === "string" ? names.get(value) ?? value : value;
};

/**
 * Preserve every independent reviewed type and per-site constructor choice.
 *
 * @param mode - Full API or standalone constructor-free results.
 * @param options - Optional generic-composition selection.
 * @param options.genericCompositions - Include the closed generic surface.
 */
export const nominalSubtypePhpReview = (mode, { genericCompositions = false } = {}) => {
	assert.ok(nominalSubtypePhpModes.includes(mode));
	return renamed(nominalSubtypeInstalledReview(mode === "result-only", { genericCompositions }));
};

/**
 * Select the Composer target without deriving ordinary choices from the compiler.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 * @param options - Optional generic-composition selection.
 * @param options.genericCompositions - Include the closed generic surface.
 */
export const nominalSubtypePhpConfiguration = (route, mode, { genericCompositions = false } = {}) => {
	assert.ok(nominalSubtypePhpModes.includes(mode));
	return { ...renamed(nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only", { genericCompositions }))
		, targets: { "php-native": { name: "example/nominalsubtypes", version: "1.0.0" } } };
};

/** Change one reserved export name, retaining its definition and all other source. */
export const nominalSubtypePhpLeanSource = async () => {
	const source = await readFile(`${nominalSubtypeFixture}/NominalSubtypes.lean`, "utf8");
	assert.equal((source.match(/\becho\b/gu) ?? []).length, 1);
	assert.ok(!source.includes("echoEnvelope"));
	return source.replace("def echo (", "def echoEnvelope (");
};

/**
 * Select the API at runtime and preserve the independently reviewed error labels.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypePhpCaller = async (route, mode) => {
	assert.ok(nominalSubtypePhpRoutes.includes(route));
	assert.ok(nominalSubtypePhpModes.includes(mode));
	let source = await readFile("tests/fixtures/nominal-subtype-consumers/php-native.php", "utf8");
	assert.equal((source.match(/const NOMINAL_RESULT_ONLY = false;/gu) ?? []).length, 1);
	if(mode === "result-only") source = source.replace("const NOMINAL_RESULT_ONLY = false;", "const NOMINAL_RESULT_ONLY = true;");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require exact complete totals for the selected original public caller.
 *
 * @param stdout - Original caller standard output.
 * @param mode - Full API or standalone constructor-free results.
 */
export const parseNominalSubtypePhpResult = (stdout, mode) => {
	assert.ok(nominalSubtypePhpModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalSubtypePhpCounts[mode]);
	return result;
};
