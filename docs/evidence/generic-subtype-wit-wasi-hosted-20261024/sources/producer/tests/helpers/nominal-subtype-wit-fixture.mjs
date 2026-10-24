/**
 * Independent WIT nominal contracts and complete public C callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypeWitRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeWitModes = Object.freeze(["full", "result-only"]);
// Full: 3,130 shared result checks plus 7,296 input checks, counted by call arity.
export const nominalSubtypeWitCounts = Object.freeze({
	full: Object.freeze({ checks: 10426, rejections: 1033, hostRejections: 15, snapshotControls: 15 })
	, "result-only": Object.freeze({ checks: 3134, rejections: 0, hostRejections: 2, snapshotControls: 15 })
});

/**
 * Require an explicit gate for nonempty, nonduplicated installed selections.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypeWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1");
	const enabled = flag === "1";
	const select = (name, allowed) => {
		const raw = environment[prefix + name]; if(raw === undefined) return [...allowed];
		assert.ok(enabled, "Explicit WIT selection requires the installed gate"); assert.equal(typeof raw, "string");
		const selected = raw.split(",");
		assert.ok(selected.length && selected.every(item => allowed.includes(item)));
		assert.equal(new Set(selected).size, selected.length); return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
	{
		assert.ok(enabled); assert.equal(typeof environment[prefix + "OUTPUT"], "string");
		assert.ok(environment[prefix + "OUTPUT"].length > 0);
	}
	return { enabled, routes: select("ROUTES", nominalSubtypeWitRoutes), modes: select("MODES", nominalSubtypeWitModes) };
};

/**
 * Keep all original nominal identities and directional refinement decisions.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypeWitReview = mode => {
	assert.ok(nominalSubtypeWitModes.includes(mode)); return nominalSubtypeInstalledReview(mode === "result-only");
};

/**
 * Select WIT packaging without deriving ordinary decisions from compiler output.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypeWitConfiguration = (route, mode) => {
	assert.ok(nominalSubtypeWitRoutes.includes(route)); assert.ok(nominalSubtypeWitModes.includes(mode));
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only")
		, targets: { "wit-wasi": { name: "nominalsubtypes", version: "1.0.0" } } };
};

/**
 * Inline the independent value and input helpers so consumers need no repository files.
 *
 * @param route - Ordinary or independently reviewed diagnostic names.
 * @param mode - Explicit API selection.
 */
export const nominalSubtypeWitCaller = async (route, mode) => {
	assert.ok(nominalSubtypeWitRoutes.includes(route)); assert.ok(nominalSubtypeWitModes.includes(mode));
	const root = "tests/fixtures/nominal-subtype-consumers/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	for(const name of ["wit-values.h", "wit-inputs.h"])
	{
		const include = `#include "${name}"`; assert.equal(source.split(include).length, 2);
		const header = await readFile(root + name, "utf8"); source = source.replace(include, () => header);
	}
	if(mode === "result-only") source = "#define NOMINAL_RESULT_ONLY\n" + source;
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Refuse incomplete observations, missing refusals or altered caller counts.
 *
 * @param stdout - Complete original caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNominalSubtypeWitResult = (stdout, mode) => {
	assert.ok(nominalSubtypeWitModes.includes(mode)); const result = JSON.parse(stdout);
	assert.deepEqual(result, nominalSubtypeWitCounts[mode]); return result;
};
