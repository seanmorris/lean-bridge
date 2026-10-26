/**
 * Explicit nominal package selections and complete browser lifecycle contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview, nominalSubtypeName } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypeBrowserRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeBrowserModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypeBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const nominalSubtypeBrowserEngines = Object.freeze(["chromium", "firefox", "webkit"]);
export const nominalSubtypeBrowserSources = Object.freeze([
	"fixtures/nominal-subtype-consumers/browser.mjs"
	, "fixtures/nominal-subtype-consumers/javascript.mjs"
	, "fixtures/structural-subtype-consumers/javascript.mjs"
]);

/**
 * Never enable browser acceptance without real installed npm packages and all engines.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypeBrowserEnabled = environment => {
	const flag = "LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST";
	if(environment[flag] !== undefined) assert.ok(["0", "1"].includes(environment[flag]), `Invalid ${flag}`);
	if(environment[flag] !== "1") return false;
	assert.equal(environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST, "1", "Browser acceptance requires installed npm acceptance");
	assert.equal(typeof environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "string", "Select all three browser engines explicitly");
	assert.deepEqual(environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS.split(","), nominalSubtypeBrowserEngines);
	return true;
};

/**
 * Keep author and API choices separate, preserving all selected constructors.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalSubtypeBrowserSelection = (route, mode) => {
	assert.ok(nominalSubtypeBrowserRoutes.includes(route), "Unknown nominal browser route");
	assert.ok(nominalSubtypeBrowserModes.includes(mode), "Unknown nominal browser API mode");
	const resultOnly = mode === "result-only";
	return { route, mode, resultOnly
		, expected: nominalSubtypeInstalledReview(resultOnly)
		, configuration: nominalSubtypeInstalledConfiguration(route, ["npm"], resultOnly) };
};

/**
 * Count the independent public caller, without treating its oracle as an execution.
 *
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalSubtypeBrowserExpected = mode => {
	assert.ok(nominalSubtypeBrowserModes.includes(mode));
	return mode === "result-only" ? { checks: 2078, rejections: 0 } : { checks: 3172, rejections: 1032 };
};

export const nominalSubtypeBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("${nominalSubtypeName}");
`;
export const nominalSubtypeBrowserEntry = 'export { executeCorpus } from "./fixtures/nominal-subtype-consumers/browser.mjs";\n';

/**
 * Require explicit package, source route, API mode and execution realm.
 *
 * @param result - Original browser observation.
 * @param profile - Required context, independent of the report.
 * @param route - Required author route.
 * @param mode - Required API mode.
 */
export const validateNominalSubtypeBrowserObservation = (result, profile, route, mode) => {
	assert.ok(nominalSubtypeBrowserProfiles.includes(profile));
	const { resultOnly } = nominalSubtypeBrowserSelection(route, mode);
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, { schemaVersion: 1, profile
		, module: nominalSubtypeName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: nominalSubtypeName, route, mode, resultOnly
			, ...nominalSubtypeBrowserExpected(mode) }
		, hostVersion: result.hostVersion });
};

/**
 * Keep recovery, React cleanup and worker restart mandatory in every selected engine.
 *
 * @param profile - Exact browser context.
 */
export const nominalSubtypeBrowserPhases = profile => {
	assert.ok(nominalSubtypeBrowserProfiles.includes(profile));
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
export const validateNominalSubtypeBrowserPhases = (observations, profile, engines, route, mode) => {
	assert.deepEqual(engines, nominalSubtypeBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant => nominalSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({ engine, variant, phase })), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort(), ["engine", "observation", "phase", "variant"]);
		validateNominalSubtypeBrowserObservation(result.observation, profile, route, mode);
	}
};
