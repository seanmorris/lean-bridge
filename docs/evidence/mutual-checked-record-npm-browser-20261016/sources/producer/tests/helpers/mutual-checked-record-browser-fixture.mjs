/**
 * Browser profiles and exact observations for mutual checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mutualCheckedRecordNpmExpected, mutualCheckedRecordNpmRoutes
} from "./mutual-checked-record-npm-fixture.mjs";

export const mutualCheckedRecordBrowserProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const mutualCheckedRecordBrowserEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);
export const mutualCheckedRecordBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("mutualcheckedrecords");
`;

/**
 * Validate one original result from a browser execution realm.
 *
 * @param result - Original browser observation.
 * @param profile - Required browser context.
 * @param route - Ordinary or reviewed author route.
 */
export const validateMutualCheckedRecordBrowserObservation = (result, profile, route) => {
	assert.ok(mutualCheckedRecordBrowserProfiles.includes(profile));
	assert.ok(mutualCheckedRecordNpmRoutes.includes(route));
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "mutualcheckedrecords"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: "mutualcheckedrecords", route
			, ...mutualCheckedRecordNpmExpected(route)
		}
		, hostVersion: result.hostVersion
	});
};

/**
 * Enumerate every lifecycle phase required by one browser profile.
 *
 * @param profile - Required browser context.
 */
export const mutualCheckedRecordBrowserPhases = profile => {
	assert.ok(mutualCheckedRecordBrowserProfiles.includes(profile));
	return profile === "browser-react"
		? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker"
			? ["first", "rerun", "worker-restart", "failure-recovery"]
			: ["first", "rerun", "failure-recovery"];
};

/**
 * Require every engine, variant and lifecycle observation in exact order.
 *
 * @param observations - Original callbacks from the shared browser harness.
 * @param profile - Required browser context.
 * @param engines - Complete ordered browser-engine selection.
 * @param route - Ordinary or reviewed author route.
 */
export const validateMutualCheckedRecordBrowserPhases = (
	observations, profile, engines, route
) => {
	assert.deepEqual(engines, mutualCheckedRecordBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant =>
		mutualCheckedRecordBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({
		engine, variant, phase
	})), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort()
			, ["engine", "observation", "phase", "variant"]);
		validateMutualCheckedRecordBrowserObservation(result.observation, profile, route);
	}
};
