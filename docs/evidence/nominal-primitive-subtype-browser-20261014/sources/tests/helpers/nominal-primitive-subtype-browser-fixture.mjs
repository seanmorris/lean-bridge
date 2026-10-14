/**
 * Explicit nominal package selections and complete browser lifecycle contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeReview, nominalPrimitiveSubtypeName } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeBrowserRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeBrowserModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const nominalPrimitiveSubtypeBrowserEngines = Object.freeze(["chromium", "firefox", "webkit"]);
export const nominalPrimitiveSubtypeBrowserSources = Object.freeze([
	"fixtures/nominal-primitive-subtype-consumers/browser.mjs"
	, "fixtures/nominal-primitive-subtype-consumers/javascript.mjs"
]);

/**
 * Never enable browser acceptance without real installed npm packages and all engines.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalPrimitiveSubtypeBrowserEnabled = environment => {
	const flag = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST";
	if(environment[flag] !== undefined) assert.ok(["0", "1"].includes(environment[flag]), `Invalid ${flag}`);
	if(environment[flag] !== "1") return false;
	assert.equal(environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST, "1", "Browser acceptance requires installed npm acceptance");
	assert.equal(typeof environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "string", "Select all three browser engines explicitly");
	assert.deepEqual(environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS.split(","), nominalPrimitiveSubtypeBrowserEngines);
	return true;
};

/**
 * Keep author and API choices separate, preserving all selected constructors.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeBrowserSelection = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeBrowserRoutes.includes(route), "Unknown nominal browser route");
	assert.ok(nominalPrimitiveSubtypeBrowserModes.includes(mode), "Unknown nominal browser API mode");
	const resultOnly = mode === "result-only";
	return { route, mode, resultOnly
		, expected: nominalPrimitiveSubtypeReview(resultOnly)
		, configuration: nominalPrimitiveSubtypeConfiguration(route, ["npm"], resultOnly) };
};

/**
 * Count the independent public caller, without treating its oracle as an execution.
 *
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeBrowserExpected = mode => {
	assert.ok(nominalPrimitiveSubtypeBrowserModes.includes(mode));
	return mode === "result-only" ? { checks: 578, rejections: 0, rounds: 256, wordBits: 32 } : { checks: 1213, rejections: 283, rounds: 256, wordBits: 32 };
};

export const nominalPrimitiveSubtypeBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("${nominalPrimitiveSubtypeName}");
`;
export const nominalPrimitiveSubtypeBrowserEntry = 'export { executeCorpus } from "./fixtures/nominal-primitive-subtype-consumers/browser.mjs";\n';

/**
 * Require explicit package, source route, API mode and execution realm.
 *
 * @param result - Original browser observation.
 * @param profile - Required context, independent of the report.
 * @param route - Required author route.
 * @param mode - Required API mode.
 */
export const validateNominalPrimitiveSubtypeBrowserObservation = (result, profile, route, mode) => {
	assert.ok(nominalPrimitiveSubtypeBrowserProfiles.includes(profile));
	const { resultOnly } = nominalPrimitiveSubtypeBrowserSelection(route, mode);
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, { schemaVersion: 1, profile
		, module: nominalPrimitiveSubtypeName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: nominalPrimitiveSubtypeName, route, mode, resultOnly
			, ...nominalPrimitiveSubtypeBrowserExpected(mode) }
		, hostVersion: result.hostVersion });
};

/**
 * Keep recovery, React cleanup and worker restart mandatory in every selected engine.
 *
 * @param profile - Exact browser context.
 */
export const nominalPrimitiveSubtypeBrowserPhases = profile => {
	assert.ok(nominalPrimitiveSubtypeBrowserProfiles.includes(profile));
	return profile === "browser-react" ? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker" ? ["first", "rerun", "worker-restart", "failure-recovery"] : ["first", "rerun", "failure-recovery"];
};

/**
 * Refuse missing, duplicated, reordered or foreign lifecycle records.
 *
 * @param observations - Original browser callback records.
 * @param profile - Required browser context.
 * @param engines - Explicit complete engine list.
 * @param route - Required author route.
 * @param mode - Required API mode.
 */
export const validateNominalPrimitiveSubtypeBrowserPhases = (observations, profile, engines, route, mode) => {
	assert.deepEqual(engines, nominalPrimitiveSubtypeBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant => nominalPrimitiveSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({ engine, variant, phase })), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort(), ["engine", "observation", "phase", "variant"]);
		validateNominalPrimitiveSubtypeBrowserObservation(result.observation, profile, route, mode);
	}
};
