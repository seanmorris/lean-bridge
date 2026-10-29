/**
 * Closed ordinary/reviewed optional-parameter package matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { optionalParameterProfiles } from "./optional-parameter-fixture.mjs";

export const optionalParameterMatrixWorkflow
	= ".github/workflows/consumer-matrix.yml";
export const optionalParameterFocusedWorkflow
	= ".github/workflows/optional-parameter-complete.yml";
export const optionalParameterMatrixWorkflows = Object.freeze([
	optionalParameterMatrixWorkflow, optionalParameterFocusedWorkflow
]);
export const optionalParameterMatrixRoutes = Object.freeze([
	Object.freeze({ authorPath: "ordinary-source", reportRoute: "ordinary" })
	, Object.freeze({ authorPath: "reviewed-ir", reportRoute: "reviewed" })
]);
export const optionalParameterMatrixCases = Object.freeze({
	omitted: true, explicitDefault: true, explicitNondefault: true
	, optionNone: true, unit: true, invalidHostValue: true
	, explicitHostNull: true, relocatedReplay: true
});
export const optionalParameterMatrixLanes = Object.freeze([
	Object.freeze({
		key: "npm", artifactPrefix: "optional-parameter-node-browser"
		, job: "Node and browser npm consumers", checker: "npm"
		, profiles: Object.freeze([
			"node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"
		])
	})
	, Object.freeze({
		key: "native", artifactPrefix: "optional-parameter-native"
		, job: "Native consumer (c-family)", checker: "native"
		, profiles: Object.freeze(["c", "cpp"])
	})
	, Object.freeze({
		key: "php", artifactPrefix: "optional-parameter-php"
		, job: "PHP-Wasm", checker: "php"
		, profiles: Object.freeze(["php-native", "php-wasm"])
	})
	, ...[
		["perl", "Perl / Perl XS (5.38.2-threaded)"]
		, ["python", "Native consumer (python)"]
		, ["ruby", "Managed consumer (ruby)"]
		, ["rust", "Native consumer (rust)"]
	].map(([profile, job]) => Object.freeze({
		key: `language-${profile}`
		, artifactPrefix: `optional-parameter-language-${profile}`
		, job, checker: "language", profile
		, profiles: Object.freeze([profile])
	}))
	, ...[
		["dotnet", ["dotnet"]]
		, ["jvm", ["java", "kotlin"]]
	].map(([group, profiles]) => Object.freeze({
		key: `managed-${group}`
		, artifactPrefix: `optional-parameter-managed-${group}`
		, job: `Managed consumer (${group})`, checker: "managed", group
		, profiles: Object.freeze(profiles)
	}))
	, Object.freeze({
		key: "wit", artifactPrefix: "optional-parameter-wit"
		, job: "WIT and WASI Component Model", checker: "wit"
		, profiles: Object.freeze(["wit-wasi"])
	})
]);

const profileLanes = new Map();
for(const lane of optionalParameterMatrixLanes)
{
	assert.match(lane.key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
	assert.match(lane.artifactPrefix
		, /^optional-parameter-[a-z0-9]+(?:-[a-z0-9]+)*$/u);
	assert.ok(["language", "managed", "native", "npm", "php", "wit"]
		.includes(lane.checker));
	for(const profile of lane.profiles)
	{
		assert.ok(optionalParameterProfiles.includes(profile), profile);
		assert.equal(profileLanes.has(profile), false, profile);
		profileLanes.set(profile, lane);
	}
}
assert.deepEqual([...profileLanes.keys()].sort(), optionalParameterProfiles);

/**
 * Resolve one consumer profile to its unique installed lane.
 *
 * @param profile - Closed consumer profile name.
 */
export const optionalParameterMatrixLaneFor = profile => {
	const lane = profileLanes.get(profile);
	assert.ok(lane, `Unknown optional-parameter profile: ${profile}`);
	return lane;
};

/**
 * Require one authenticated ordinary and reviewed result for every lane.
 *
 * @param results - Normalized lane/route checker results.
 * @param producerCommit - Exact package producer revision.
 */
export const validateOptionalParameterMatrixResults = (
	results, producerCommit
) => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.ok(Array.isArray(results));
	const expected = optionalParameterMatrixLanes.flatMap(lane =>
		optionalParameterMatrixRoutes.map(route =>
			`${lane.key}/${route.reportRoute}`)).sort();
	assert.deepEqual(results.map(result =>
		`${result.lane}/${result.route}`).sort(), expected);
	const profiles = [];
	for(const result of results)
	{
		const lane = optionalParameterMatrixLanes.find(item =>
			item.key === result.lane);
		assert.ok(lane);
		assert.equal(result.producerCommit, producerCommit);
		assert.deepEqual([...result.profiles].sort(), [...lane.profiles].sort());
		assert.deepEqual(result.cases, optionalParameterMatrixCases);
		profiles.push(...result.profiles.map(profile =>
			`${profile}/${result.route}`));
	}
	assert.equal(results.length, 20);
	assert.equal(new Set(profiles).size, 34);
	return Object.freeze({ lanes: 10, routes: 2, profiles: 17, cells: 34 });
};
