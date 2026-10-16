/**
 * Browser profiles and exact observations for nested checked-record npm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	nestedCheckedRecordNpmExpected,
	nestedCheckedRecordNpmRoutes,
	nestedCheckedRecordNpmSelection
} from "./nested-checked-record-npm-fixture.mjs";

export const nestedCheckedRecordBrowserProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const nestedCheckedRecordBrowserEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);
export const nestedCheckedRecordBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("nestedcheckedrecords");
`;

/**
 * Match one public result to its selected package and execution realm.
 *
 * @param result - Original browser observation.
 * @param profile - Required browser context.
 * @param route - Exact author and API selection.
 */
export const validateNestedCheckedRecordBrowserObservation = (result, profile, route) => {
	assert.ok(nestedCheckedRecordBrowserProfiles.includes(profile));
	assert.ok(nestedCheckedRecordNpmRoutes.includes(route));
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "nestedcheckedrecords"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: "nestedcheckedrecords", route
			, resultOnly: nestedCheckedRecordNpmSelection(route).resultOnly
			, ...nestedCheckedRecordNpmExpected(route)
		}
		, hostVersion: result.hostVersion
	});
};

/**
 * Enumerate every lifecycle phase required in one browser context.
 *
 * @param profile - Required browser context.
 */
export const nestedCheckedRecordBrowserPhases = profile => {
	assert.ok(nestedCheckedRecordBrowserProfiles.includes(profile));
	return profile === "browser-react"
		? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker"
			? ["first", "rerun", "worker-restart", "failure-recovery"]
			: ["first", "rerun", "failure-recovery"];
};

/**
 * Require all engines, variants and lifecycle observations in their exact order.
 *
 * @param observations - Original callbacks from the shared browser harness.
 * @param profile - Required browser context.
 * @param engines - Complete ordered engine selection.
 * @param route - Exact author and API selection.
 */
export const validateNestedCheckedRecordBrowserPhases = (
	observations, profile, engines, route
) => {
	assert.deepEqual(engines, nestedCheckedRecordBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant =>
		nestedCheckedRecordBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({
		engine, variant, phase
	})), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort()
			, ["engine", "observation", "phase", "variant"]);
		validateNestedCheckedRecordBrowserObservation(result.observation, profile, route);
	}
};
