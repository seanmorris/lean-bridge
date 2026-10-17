/**
 * Browser profiles and exact observations for inherited checked-record npm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordNpmExpected,
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";

export const inheritedCheckedRecordBrowserProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const inheritedCheckedRecordBrowserEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);
export const inheritedCheckedRecordBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("inheritedcheckedrecords");
`;

/**
 * Match one public result to its selected package and execution realm.
 *
 * @param result - Original browser observation.
 * @param profile - Required browser context.
 * @param route - Exact author and API selection.
 */
export const validateInheritedCheckedRecordBrowserObservation = (result, profile, route) => {
	assert.ok(inheritedCheckedRecordBrowserProfiles.includes(profile));
	assert.ok(inheritedCheckedRecordNpmRoutes.includes(route));
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "inheritedcheckedrecords"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: "inheritedcheckedrecords", route
			, resultOnly: inheritedCheckedRecordNpmSelection(route).resultOnly
			, ...inheritedCheckedRecordNpmExpected(route)
		}
		, hostVersion: result.hostVersion
	});
};

/**
 * Enumerate every lifecycle phase required in one browser context.
 *
 * @param profile - Required browser context.
 */
export const inheritedCheckedRecordBrowserPhases = profile => {
	assert.ok(inheritedCheckedRecordBrowserProfiles.includes(profile));
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
export const validateInheritedCheckedRecordBrowserPhases = (
	observations, profile, engines, route
) => {
	assert.deepEqual(engines, inheritedCheckedRecordBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant =>
		inheritedCheckedRecordBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({
		engine, variant, phase
	})), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort()
			, ["engine", "observation", "phase", "variant"]);
		validateInheritedCheckedRecordBrowserObservation(result.observation, profile, route);
	}
};
