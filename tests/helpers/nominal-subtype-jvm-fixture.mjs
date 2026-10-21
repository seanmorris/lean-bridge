/**
 * Independent Maven contracts and public callers for nominal Subtype packages.
 * The nested record uses EnvelopePair because Pair is the JVM product carrier.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeFixture, nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypeJvmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeJvmModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypeJvmProfiles = Object.freeze(["java", "kotlin"]);
export const nominalSubtypeJvmCounts = Object.freeze({
	java: Object.freeze({
		full: Object.freeze({ checks: 4226, rejections: 1032
			, hostRejections: 7, snapshotControls: 8 })
		, "result-only": Object.freeze({ checks: 2088, rejections: 0
			, hostRejections: 1, snapshotControls: 8 })
	})
	, kotlin: Object.freeze({
		full: Object.freeze({ checks: 4220, rejections: 1032
			, hostRejections: 4, snapshotControls: 8 })
		, "result-only": Object.freeze({ checks: 2088, rejections: 0
			, hostRejections: 1, snapshotControls: 8 })
	})
});

/**
 * Refuse disabled explicit work, duplicate routes and incomplete selections.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypeJvmSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1");
	const enabled = flag === "1";
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw === undefined) return [...allowed];
		assert.ok(enabled, "Explicit JVM selection requires the installed gate");
		assert.equal(typeof raw, "string");
		const selected = raw.split(",");
		assert.ok(selected.length > 0 && selected.every(item => allowed.includes(item)));
		assert.equal(new Set(selected).size, selected.length);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.ok(enabled);
	return { enabled, routes: select("ROUTES", nominalSubtypeJvmRoutes)
		, modes: select("MODES", nominalSubtypeJvmModes) };
};

/**
 * Require the complete independently specified caller totals for each public API.
 *
 * @param stdout - Original caller standard output.
 * @param profile - Java or Kotlin public API.
 * @param mode - Full API or standalone constructor-free results.
 */
export const parseNominalSubtypeJvmResult = (stdout, profile, mode) => {
	assert.ok(nominalSubtypeJvmProfiles.includes(profile));
	assert.ok(nominalSubtypeJvmModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, nominalSubtypeJvmCounts[profile][mode]);
	return result;
};

const names = new Map([["Pair", "EnvelopePair"], ["NominalSubtypes.Pair", "NominalSubtypes.EnvelopePair"], ["lean:NominalSubtypes.Pair", "lean:NominalSubtypes.EnvelopePair"]]);
const renamed = value => {
	if(Array.isArray(value)) return value.map(renamed);
	if(value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renamed(item)]));
	if(typeof value !== "string") return value;
	return names.get(value) ?? value;
};

/**
 * Preserve all independent contracts, changing only the colliding nominal name.
 *
 * @param mode - Full API or standalone constructor-free results.
 * @param options - Optional generic-composition selection.
 * @param options.genericCompositions - Include the closed generic surface.
 */
export const nominalSubtypeJvmReview = (mode, { genericCompositions = false } = {}) => {
	assert.ok(nominalSubtypeJvmModes.includes(mode));
	return renamed(nominalSubtypeInstalledReview(mode === "result-only", { genericCompositions }));
};

/**
 * Retain every ordinary constructor choice and select the Maven target.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 * @param options - Optional generic-composition selection.
 * @param options.genericCompositions - Include the closed generic surface.
 */
export const nominalSubtypeJvmConfiguration = (route, mode, { genericCompositions = false } = {}) => {
	assert.ok(nominalSubtypeJvmModes.includes(mode));
	return { ...renamed(nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only", { genericCompositions }))
		, targets: { maven: { name: "org.leanbridge:nominalsubtypes", version: "1.0.0" } } };
};

/**
 * Keep the source fixture's complete algorithm and proof surface intact.
 */
export const nominalSubtypeJvmLeanSource = async () => {
	const source = await readFile(`${nominalSubtypeFixture}/NominalSubtypes.lean`, "utf8");
	assert.equal((source.match(/\bPair\b/gu) ?? []).length, 2);
	return source.replaceAll(/\bPair\b/gu, "EnvelopePair");
};

/**
 * Select compile-time API sections and independent reviewed parameter labels.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Ordinary source or reviewed source.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypeJvmCaller = async (profile, route, mode) => {
	assert.ok(nominalSubtypeJvmProfiles.includes(profile));
	assert.ok(nominalSubtypeJvmRoutes.includes(route));
	assert.ok(nominalSubtypeJvmModes.includes(mode));
	let source = await readFile(`tests/fixtures/nominal-subtype-consumers/${profile}.${profile === "java" ? "java" : "kt"}`, "utf8");
	for(const section of ["FULL_ONLY", "RESULT_ONLY"])
	{
		const pattern = new RegExp(`^[ \\t]*// BEGIN ${section}\\n([\\s\\S]*?)^[ \\t]*// END ${section}\\n`, "gmu");
		const matches = [...source.matchAll(pattern)];
		assert.ok(matches.length > 0, `Missing ${profile} ${section} caller section`);
		const keep = mode === "full" ? section === "FULL_ONLY" : section === "RESULT_ONLY";
		source = source.replaceAll(pattern, (_, content) => keep ? content : "");
	}
	assert.doesNotMatch(source, /BEGIN (?:FULL|RESULT)_ONLY|END (?:FULL|RESULT)_ONLY/u);
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Bind the independent Java stand-in to Java or Kotlin public value classes.
 * This model is only for caller controls and never supplies installed acceptance.
 *
 * @param profile - Java or Kotlin public value namespace.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypeJvmModel = async (profile, mode) => {
	assert.ok(nominalSubtypeJvmProfiles.includes(profile));
	assert.ok(nominalSubtypeJvmModes.includes(mode));
	let source = await readFile("tests/fixtures/nominal-subtype-consumers/model.java", "utf8");
	assert.equal(source.split("FIXTURE_NAMESPACE").length, 2);
	source = source.replace("FIXTURE_NAMESPACE", "org.leanbridge.nominalsubtypes" + (profile === "kotlin" ? ".kotlin" : ""));
	const pattern = /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;
	assert.equal([...source.matchAll(pattern)].length, 1);
	source = source.replace(pattern, (_, content) => mode === "full" ? content : "");
	assert.doesNotMatch(source, /FULL_ONLY|FIXTURE_NAMESPACE/u);
	return source;
};
