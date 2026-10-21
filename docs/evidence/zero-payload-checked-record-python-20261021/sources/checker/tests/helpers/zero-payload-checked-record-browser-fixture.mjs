/**
 * Author selections and exact execution totals for zero-payload npm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadCheckedRecordContracts
	, zeroPayloadCheckedRecordReview
} from "./zero-payload-checked-record-fixture.mjs";

export const zeroPayloadBrowserName = "zeropayloadcheckedrecords";
export const zeroPayloadBrowserRoutes = Object.freeze([
	"ordinary-source"
	, "reviewed-ir"
	, "result-only-ordinary-source"
	, "result-only-reviewed-ir"
]);
export const zeroPayloadBrowserProfiles = Object.freeze([
	"browser-javascript"
	, "browser-react"
	, "browser-worker"
]);
export const zeroPayloadBrowserEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);
export const zeroPayloadBrowserInputNames = Object.freeze([
	"witnessCount", "absentCount", "tokenTag", "markerCount", "markCount"
]);
export const zeroPayloadBrowserResultNames = Object.freeze([
	"produceWitness", "produceToken", "witnesses", "maybeWitness", "produceMarker"
	, "produceMark"
]);
const callerPath
	= "tests/fixtures/zero-payload-checked-record-browser/javascript.mjs";

/**
 * Load the immutable public caller with only the reviewed parameter label changed.
 *
 * @param route - Exact ordinary/reviewed and full/result-only selection.
 * @param reader - Optional historical Git-backed source reader.
 */
export const zeroPayloadBrowserCaller = async (
	route, reader = path => readFile(path, "utf8")
) => {
	assert.ok(zeroPayloadBrowserRoutes.includes(route));
	const source = String(await reader(callerPath));
	const reviewed = route.endsWith("reviewed-ir");
	const current = "absentCount.arg0 was rejected";
	assert.equal(source.split(current).length, 2);
	return reviewed ? source.replace(current
		, "absentCount.value0 was rejected") : source;
};
/**
 * Return exact independent-caller totals for one route.
 *
 * @param route - Exact ordinary/reviewed and full/result-only selection.
 */
export const zeroPayloadBrowserExpected = route => {
	assert.ok(zeroPayloadBrowserRoutes.includes(route));
	return route.startsWith("result-only-")
		? { checks: 28, rejections: 0, calls: 8, snapshots: 8, recoveries: 0 }
		: { checks: 73, rejections: 10, calls: 33, snapshots: 33, recoveries: 10 };
};

export const zeroPayloadBrowserPackageSource
	= `import request from "./request.json";
export { request };
export const loadApi = () => import("zeropayloadcheckedrecords");
`;

/**
 * Validate one exact real-browser observation.
 *
 * @param result - Original observation.
 * @param profile - Browser execution context.
 * @param route - Exact author route.
 */
export const validateZeroPayloadBrowserObservation = (result, profile, route) => {
	assert.ok(zeroPayloadBrowserProfiles.includes(profile));
	assert.ok(zeroPayloadBrowserRoutes.includes(route));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: zeroPayloadBrowserName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: zeroPayloadBrowserName, route
			, resultOnly: route.startsWith("result-only-")
			, ...zeroPayloadBrowserExpected(route)
		}
		, hostVersion: result.hostVersion
	});
};

/**
 * Enumerate every lifecycle observation required for one browser context.
 *
 * @param profile - Browser execution context.
 */
export const zeroPayloadBrowserPhases = profile => {
	assert.ok(zeroPayloadBrowserProfiles.includes(profile));
	return profile === "browser-react"
		? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker"
			? ["first", "rerun", "worker-restart", "failure-recovery"]
			: ["first", "rerun", "failure-recovery"];
};

/**
 * Require every engine, variant and lifecycle observation in exact order.
 *
 * @param observations - Original lifecycle observations.
 * @param profile - Browser execution context.
 * @param engines - Complete ordered engine selection.
 * @param route - Exact author route.
 */
export const validateZeroPayloadBrowserPhases = (
	observations, profile, engines, route
) => {
	assert.deepEqual(engines, zeroPayloadBrowserEngines);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant =>
		zeroPayloadBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({
		engine, variant, phase
	})), expected);
	for(const item of observations)
	{
		assert.deepEqual(Object.keys(item).sort()
			, ["engine", "observation", "phase", "variant"]);
		validateZeroPayloadBrowserObservation(item.observation, profile, route);
	}
};

/**
 * Select a complete or result-only ordinary/reviewed API.
 *
 * @param route - Exact ordinary/reviewed and full/result-only selection.
 */
export const zeroPayloadBrowserSelection = route => {
	assert.ok(zeroPayloadBrowserRoutes.includes(route), "Unknown zero-payload browser route");
	const resultOnly = route.startsWith("result-only-");
	const reviewed = route.endsWith("reviewed-ir");
	const resultNames = new Set(zeroPayloadBrowserResultNames);
	const expected = zeroPayloadCheckedRecordReview();
	if(resultOnly)
	{
		expected.declarations = expected.declarations.filter(item => resultNames.has(item.name));
		const retained = new Set(expected.declarations.flatMap(item => {
			const names = [];
			const visit = value => {
				if(value?.kind === "named") names.push(value.id.replace(/^lean:/u, ""));
				for(const argument of value?.arguments ?? []) visit(argument);
			};
			visit(item.result.type); return names;
		}));
		expected.types = expected.types.filter(item => retained.has(
			`ZeroPayloadCheckedRecords.${item.name}`
		));
	}
	const contracts = zeroPayloadCheckedRecordContracts();
	const exports = resultOnly
		? Object.keys(contracts).filter(name => resultNames.has(name.split(".").at(-1)))
		: Object.keys(contracts);
	return {
		resultOnly, reviewed, expected
		, configuration: {
			schemaVersion: 1
			, modules: ["ZeroPayloadCheckedRecords"]
			, targets: { npm: { name: zeroPayloadBrowserName, version: "1.0.0" } }
			, ...reviewed ? {} : {
				exports
				, contracts: Object.fromEntries(exports.map(name => [name, contracts[name]]))
			}
		}
	};
};
