/**
 * Four author selections and browser requirements for dependent checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	dependentCheckedRecordContracts, dependentCheckedRecordReview
} from "./checked-record-fixture.mjs";

export const dependentCheckedRecordRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
export const dependentCheckedRecordProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const dependentCheckedRecordEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);
export const dependentCheckedRecordName = "dependentrecords";
export const dependentCheckedRecordFixture
	= "tests/fixtures/onboarding/dependent-checked-records";

/**
 * Return exact public-caller counts for one author selection.
 *
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordExpected = route => {
	assert.ok(dependentCheckedRecordRoutes.includes(route));
	return route.startsWith("result-only-")
		? { checks: 513, rejections: 0, calls: 513
			, snapshots: 513, recoveries: 0 }
		: { checks: 777, rejections: 260, calls: 1036
			, snapshots: 258, recoveries: 260 };
};

/**
 * Build an ordinary or independently reviewed author selection.
 *
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordSelection = route => {
	assert.ok(dependentCheckedRecordRoutes.includes(route)
		, "Unknown dependent checked-record route");
	const resultOnly = route.startsWith("result-only-");
	const reviewed = route.endsWith("reviewed-ir");
	const expected = dependentCheckedRecordReview({
		module: "DependentRecords", component: dependentCheckedRecordName
	});
	if(resultOnly) expected.declarations = expected.declarations.filter(
		item => item.name === "dependentResult"
	);
	const contracts = dependentCheckedRecordContracts("DependentRecords");
	const exports = resultOnly
		? ["DependentRecords.dependentResult"] : Object.keys(contracts);
	return {
		resultOnly, reviewed, expected
		, configuration: {
			schemaVersion: 1, modules: ["DependentRecords"]
			, targets: { npm: {
				name: dependentCheckedRecordName, version: "1.0.0"
			} }
			, ...(reviewed ? {} : {
				exports
				, contracts: Object.fromEntries(
					exports.map(name => [name, contracts[name]])
				)
			})
		}
	};
};

export const dependentCheckedRecordBrowserPackage
	= `import request from "./request.json";
export { request };
export const loadApi = () => import("dependentrecords");
`;

/**
 * Validate one exact browser observation.
 *
 * @param result - Complete browser observation.
 * @param profile - Selected browser context.
 * @param route - Exact author selection.
 */
export const validateDependentCheckedRecordObservation = (
	result, profile, route
) => {
	assert.ok(dependentCheckedRecordProfiles.includes(profile));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: dependentCheckedRecordName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: dependentCheckedRecordName, route
			, resultOnly: route.startsWith("result-only-")
			, ...dependentCheckedRecordExpected(route)
		}
		, hostVersion: result.hostVersion
	});
};

const phases = profile => profile === "browser-react"
	? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
	: profile === "browser-worker"
		? ["first", "rerun", "worker-restart", "failure-recovery"]
		: ["first", "rerun", "failure-recovery"];

/**
 * Require every selected engine, lifecycle and React strict-mode variant.
 *
 * @param observations - Ordered lifecycle observations.
 * @param profile - Selected browser context.
 * @param engines - Exact browser-engine selection.
 * @param route - Exact author selection.
 */
export const validateDependentCheckedRecordPhases = (
	observations, profile, engines, route
) => {
	assert.deepEqual(engines, dependentCheckedRecordEngines);
	const variants = profile === "browser-react"
		? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant =>
		phases(profile).map(phase => ({ engine, variant, phase }))
	));
	assert.deepEqual(observations.map(
		({ engine, variant, phase }) => ({ engine, variant, phase })
	), expected);
	for(const item of observations)
		validateDependentCheckedRecordObservation(
			item.observation, profile, route
		);
};
