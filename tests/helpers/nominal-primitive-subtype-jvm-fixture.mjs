/**
 * Explicit Maven selections and independent nineteen-base nominal Subtype caller counts for Java and
 * Kotlin. The Lean fixture's `Pair` record collides with the generated tuple class, so the JVM package
 * renames only that nominal name, exactly as the Nat-only JVM acceptance does.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFixture, nominalPrimitiveSubtypeModule, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeJvmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeJvmModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeJvmProfiles = Object.freeze(["java", "kotlin"]);
export const nominalPrimitiveSubtypeJvmMavenName = "org.leanbridge:nominalprimitivesubtypes";
/** Independent caller totals per public API; Java probes null packets, Kotlin nullability is probed separately. */
export const nominalPrimitiveSubtypeJvmCounts = Object.freeze({
	java: Object.freeze({
		full: Object.freeze({ checks: 1231, rejections: 283, hostRejections: 7, snapshotControls: 9, rounds: 256, wordBits: 64 })
		, "result-only": Object.freeze({ checks: 593, rejections: 0, hostRejections: 7, snapshotControls: 9, rounds: 256, wordBits: 64 })
	})
	, kotlin: Object.freeze({
		full: Object.freeze({ checks: 1229, rejections: 283, hostRejections: 6, snapshotControls: 9, rounds: 256, wordBits: 64 })
		, "result-only": Object.freeze({ checks: 591, rejections: 0, hostRejections: 6, snapshotControls: 9, rounds: 256, wordBits: 64 })
	})
});

/** The default producer admission ceiling and the shared local ceiling an explicit run may select. */
export const nominalPrimitiveSubtypeJvmDefaultLoadCeiling = 6;
export const nominalPrimitiveSubtypeJvmMaximumLoadCeiling = 8;

/**
 * Refuse misspelled gates and selections instead of silently skipping packages.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const nominalPrimitiveSubtypeJvmSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal JVM TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal JVM ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal JVM ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal JVM ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal JVM ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", `Explicit ${prefix}OUTPUT requires TEST=1`);
	// The default admission ceiling is 6; an explicit local producer may raise it to the shared ceiling of 8.
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
	{
		assert.equal(flag, "1", `Explicit ${prefix}MAX_LOAD requires TEST=1`);
		assert.ok(["6", "8"].includes(rawLoad), `Invalid ${prefix}MAX_LOAD: only the default 6 or the shared 8`);
	}
	const maxLoad = rawLoad === undefined ? nominalPrimitiveSubtypeJvmDefaultLoadCeiling : Number(rawLoad);
	return { enabled: flag === "1", routes: select("ROUTES", nominalPrimitiveSubtypeJvmRoutes), modes: select("MODES", nominalPrimitiveSubtypeJvmModes), maxLoad };
};

const names = new Map([["Pair", "PacketPair"], ["NominalPrimitiveSubtypes.Pair", "NominalPrimitiveSubtypes.PacketPair"], ["lean:NominalPrimitiveSubtypes.Pair", "lean:NominalPrimitiveSubtypes.PacketPair"]]);
const renamed = value => {
	if(Array.isArray(value)) return value.map(renamed);
	if(value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renamed(item)]));
	if(typeof value !== "string") return value;
	return names.get(value) ?? value;
};

/**
 * Preserve all independent nineteen-base contracts, changing only the colliding nominal name.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeJvmReview = mode => {
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	return renamed(nominalPrimitiveSubtypeReview(mode === "result-only"));
};

/**
 * Retain every ordinary constructor choice and select the Maven target.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeJvmConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	return { ...renamed(nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only"))
		, targets: { maven: { name: nominalPrimitiveSubtypeJvmMavenName, version: "1.0.0" } } };
};

/**
 * Keep the source fixture's complete algorithm and proof surface intact; only the colliding record is renamed.
 */
export const nominalPrimitiveSubtypeJvmLeanSource = async () => {
	const source = await readFile(`${nominalPrimitiveSubtypeFixture}/${nominalPrimitiveSubtypeModule}.lean`, "utf8");
	assert.equal((source.match(/\bPair\b/gu) ?? []).length, 4);
	return source.replaceAll(/\bPair\b/gu, "PacketPair");
};

/**
 * Select compile-time API sections and independent reviewed parameter labels.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Ordinary source or reviewed source.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeJvmCaller = async (profile, route, mode) => {
	assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(profile));
	assert.ok(nominalPrimitiveSubtypeJvmRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	let source = await readFile(`tests/fixtures/nominal-primitive-subtype-consumers/${profile}.${profile === "java" ? "java" : "kt"}`, "utf8");
	for(const section of ["FULL_ONLY", "RESULT_ONLY"])
	{
		const pattern = new RegExp(`^[ \\t]*// BEGIN ${section}\\n([\\s\\S]*?)^[ \\t]*// END ${section}\\n`, "gmu");
		const matches = [...source.matchAll(pattern)];
		assert.ok(matches.length > 0, `Missing ${profile} ${section} caller section`);
		const keep = mode === "full" ? section === "FULL_ONLY" : section === "RESULT_ONLY";
		source = source.replaceAll(pattern, (_, content) => keep ? content : "");
	}
	assert.doesNotMatch(source, /BEGIN (?:FULL|RESULT)_ONLY|END (?:FULL|RESULT)_ONLY/u);
	return route === "ordinary" ? source : source.replaceAll(/arg([01])\./gu, "value$1.");
};

/**
 * Bind the independent Java stand-in to the Java or Kotlin public value classes.
 * This model is only for caller controls and never supplies installed acceptance.
 *
 * @param profile - Java or Kotlin public value namespace.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeJvmModel = async (profile, mode) => {
	assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(profile));
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	let source = await readFile("tests/fixtures/nominal-primitive-subtype-consumers/model.java", "utf8");
	assert.equal(source.split("FIXTURE_NAMESPACE").length, 2);
	source = source.replace("FIXTURE_NAMESPACE", "org.leanbridge.nominalprimitivesubtypes" + (profile === "kotlin" ? ".kotlin" : ""));
	const pattern = /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;
	assert.equal([...source.matchAll(pattern)].length, 1);
	source = source.replace(pattern, (_, content) => mode === "full" ? content : "");
	assert.doesNotMatch(source, /FULL_ONLY|FIXTURE_NAMESPACE/u);
	return source;
};

/**
 * Require the complete independently specified caller totals for each public API.
 *
 * @param stdout - Original caller standard output.
 * @param profile - Java or Kotlin public API.
 * @param mode - Full API or standalone constructor-free results.
 */
export const parseNominalPrimitiveSubtypeJvmResult = (stdout, profile, mode) => {
	assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(profile));
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, nominalPrimitiveSubtypeJvmCounts[profile][mode]);
	return result;
};
