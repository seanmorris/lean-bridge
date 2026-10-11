/**
 * Four independent author selections and shared browser execution requirements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { checkedRecordContracts, checkedRecordReview } from "./checked-record-fixture.mjs";

export const checkedRecordBrowserRoutes = Object.freeze(["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"]);
export const checkedRecordBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const checkedRecordBrowserName = "checkedrecords";
export const checkedRecordBrowserEngines = Object.freeze(["chromium", "firefox", "webkit"]);

/**
 * Require complete counts for the independently selected full or result-only corpus.
 *
 * @param route - Exact author selection.
 */
export const checkedRecordBrowserExpected = route => {
	assert.ok(checkedRecordBrowserRoutes.includes(route));
	return route.startsWith("result-only-")
		? { checks: 2011, rejections: 0, calls: 1002, snapshots: 1002, recoveries: 0 }
		: { checks: 16176, rejections: 3031, calls: 8088, snapshots: 8088, recoveries: 3031 };
};

/**
 * Keep full and result-only author routes distinct before any compiler runs.
 *
 * @param route - One exact author selection.
 */
export const checkedRecordBrowserSelection = route => {
	assert.ok(checkedRecordBrowserRoutes.includes(route), "Unknown checked-record browser route");
	const resultOnly = route.startsWith("result-only-"), reviewed = route.endsWith("reviewed-ir");
	const expected = checkedRecordReview();
	if(resultOnly)
	{
		expected.declarations = expected.declarations.filter(item => item.name === "repeated");
		expected.types = expected.types.filter(item => item.name === "Triple");
	}
	const contracts = checkedRecordContracts();
	const exports = resultOnly ? ["CheckedRecords.repeated"] : Object.keys(contracts);
	return { resultOnly, reviewed, expected
		, configuration: { schemaVersion: 1, modules: ["CheckedRecords"]
			, targets: { npm: { name: checkedRecordBrowserName, version: "1.0.0" } }
			, ...reviewed ? {} : { exports, contracts: Object.fromEntries(exports.map(name => [name, contracts[name]])) } } };
};

export const checkedRecordBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("checkedrecords");
`;

/**
 * Match the complete public corpus to its selected package, route and execution realm.
 *
 * @param result - Original browser observation.
 * @param profile - Required browser context.
 * @param route - Exact author selection.
 */
export const validateCheckedRecordBrowserObservation = (result, profile, route) => {
	assert.ok(checkedRecordBrowserProfiles.includes(profile));
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: checkedRecordBrowserName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: checkedRecordBrowserName, route, resultOnly: route.startsWith("result-only-"), ...checkedRecordBrowserExpected(route) }
		, hostVersion: result.hostVersion });
};

/**
 * Enumerate every required lifecycle observation for one context.
 *
 * @param profile - Required browser context.
 */
export const checkedRecordBrowserPhases = profile => {
	assert.ok(checkedRecordBrowserProfiles.includes(profile));
	return profile === "browser-react" ? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker" ? ["first", "rerun", "worker-restart", "failure-recovery"] : ["first", "rerun", "failure-recovery"];
};

/**
 * Require all three engines and every production, strict and recovery phase.
 *
 * @param observations - Original callbacks from the shared browser harness.
 * @param profile - Required browser context.
 * @param engines - Complete ordered engine selection.
 * @param route - Exact author selection.
 */
export const validateCheckedRecordBrowserPhases = (observations, profile, engines, route) => {
	assert.deepEqual(engines, checkedRecordBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant => checkedRecordBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({ engine, variant, phase })), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort(), ["engine", "observation", "phase", "variant"]);
		validateCheckedRecordBrowserObservation(result.observation, profile, route);
	}
};
